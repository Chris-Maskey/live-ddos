import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { SourceTextModule, SyntheticModule, createContext } from "node:vm"
import ts from "typescript"

globalThis.AsyncLocalStorage = AsyncLocalStorage
const { unstable_cache } = await import("next/cache.js")
const { createPatchedFetcher } =
  await import("next/dist/server/lib/patch-fetch.js")
const { workAsyncStorage } =
  await import("next/dist/server/app-render/work-async-storage.external.js")
const { workUnitAsyncStorage } =
  await import("next/dist/server/app-render/work-unit-async-storage.external.js")

test("reuses daily country lookups and preserves API failure responses", async () => {
  let now = 0
  const entries = new Map()
  const calls = { pairs: 0, locations: 0 }
  let failure = null
  // Use Next's real cache scopes and fetch behavior with an in-memory storage backend.
  const incrementalCache = {
    generateSimpleCacheKey: async (key) => key,
    generateCacheKey: async (url, options) => JSON.stringify([url, options]),
    lock: async () => () => {},
    get: async (key) => {
      const entry = entries.get(key)
      return entry
        ? {
            value: entry.value,
            isStale: now - entry.time > entry.value.revalidate * 1000,
          }
        : null
    },
    set: async (key, value) => {
      entries.set(key, { value, time: now })
    },
  }
  const fetcher = createPatchedFetcher(
    async (input) => {
      if (failure === "network") throw new Error("Controlled network failure")
      if (failure === "json") return new Response("not json")
      if (failure === "data") return Response.json({ success: false })
      if (typeof failure === "number") {
        return new Response("", {
          status: failure,
          headers: { "Retry-After": "120" },
        })
      }
      const url = new URL(input)
      if (url.pathname.endsWith("/entities/locations")) {
        calls.locations++
        assert.ok(url.searchParams.get("location").split(",").length <= 2)
        return Response.json({
          success: true,
          result: {
            locations: [
              { alpha2: "US", latitude: "37", longitude: "-95" },
              { alpha2: "FR", latitude: "46", longitude: "2" },
            ],
          },
        })
      }
      calls.pairs++
      return Response.json({
        success: true,
        result: {
          meta: {
            dateRange: [
              {
                startTime: "2026-10-20T00:00:00Z",
                endTime: "2026-10-21T00:00:00Z",
              },
            ],
            lastUpdated: "2026-10-21T00:00:00Z",
            normalization: "PERCENTAGE",
            units: [],
          },
          top_0: [
            {
              originCountryAlpha2: "US",
              originCountryName: "United States",
              targetCountryAlpha2: "FR",
              targetCountryName: "France",
              value: "4",
            },
          ],
        },
      })
    },
    { workAsyncStorage, workUnitAsyncStorage }
  )
  const context = createContext({
    fetch: fetcher,
    URL,
    URLSearchParams,
    AbortSignal,
    Response,
    Headers,
    process: { env: { CLOUDFLARE_API_TOKEN: "test-token" } },
  })
  const modules = new Map()
  for (const [name, exports] of [
    ["server-only", {}],
    ["next/cache", { unstable_cache }],
  ]) {
    modules.set(
      name,
      new SyntheticModule(
        Object.keys(exports),
        function () {
          for (const [key, value] of Object.entries(exports))
            this.setExport(key, value)
        },
        { context }
      )
    )
  }
  for (const name of ["attack-data", "cloudflare-radar"]) {
    const source = await readFile(
      new URL(`./${name}.ts`, import.meta.url),
      "utf8"
    )
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    modules.set(`@/lib/${name}`, new SourceTextModule(outputText, { context }))
  }
  const radar = modules.get("@/lib/cloudflare-radar")
  await radar.link((name) => modules.get(name))
  await radar.evaluate()
  const load = (range) => {
    const store = { route: "/api/attacks", incrementalCache }
    return workAsyncStorage.run(store, async () => {
      const snapshot = await radar.namespace.getRadarSnapshot(range)
      await Promise.all(Object.values(store.pendingRevalidates ?? {}))
      assert.equal(snapshot.range, range)
      assert.equal(snapshot.routes[0].target.latitude, 46)
      return snapshot
    })
  }

  await load("1d")
  await load("1d")
  assert.deepEqual(calls, { pairs: 1, locations: 1 })
  await load("7d")
  assert.deepEqual(
    calls,
    { pairs: 2, locations: 1 },
    "country lookups must be shared across ranges"
  )
  now += 301_000
  await load("1d")
  assert.deepEqual(
    calls,
    { pairs: 3, locations: 1 },
    "pair refresh must not refresh country coordinates"
  )
  now += 86_400_000
  await load("1d")
  assert.deepEqual(
    calls,
    { pairs: 4, locations: 2 },
    "country coordinates must refresh after one day"
  )

  const routeSource = await readFile(
    new URL("../app/api/attacks/route.ts", import.meta.url),
    "utf8"
  )
  const route = new SourceTextModule(
    ts.transpileModule(routeSource, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { context }
  )
  await route.link((name) => modules.get(name))
  await route.evaluate()
  const request = (query = "") => {
    const store = { route: "/api/attacks", incrementalCache }
    return workAsyncStorage.run(store, async () => {
      const response = await route.namespace.GET(
        new Request(`http://localhost/api/attacks${query}`)
      )
      await Promise.all(Object.values(store.pendingRevalidates ?? {}))
      assert.equal(response.headers.get("cache-control"), "no-store")
      return response
    })
  }
  assert.equal((await (await request()).json()).range, "1d")
  assert.equal((await request("?range=invalid")).status, 400)
  for (const [scenario, status, code] of [
    [401, 503, "UNAUTHORIZED"],
    [403, 503, "UNAUTHORIZED"],
    [429, 429, "RATE_LIMITED"],
    [500, 502, "UPSTREAM"],
    ["network", 502, "UPSTREAM"],
    ["json", 503, "INVALID_DATA"],
    ["data", 503, "INVALID_DATA"],
    ["missing-token", 503, "MISSING_TOKEN"],
  ]) {
    entries.clear()
    failure = scenario
    context.process.env.CLOUDFLARE_API_TOKEN =
      scenario === "missing-token" ? "" : "test-token"
    const response = await request()
    assert.equal(response.status, status, String(scenario))
    assert.equal((await response.json()).error.code, code)
    if (scenario === 429)
      assert.equal(response.headers.get("retry-after"), "120")
    failure = null
    context.process.env.CLOUDFLARE_API_TOKEN = "test-token"
    assert.equal(
      (await request()).status,
      200,
      "failed responses must not poison the cache"
    )
  }
})
