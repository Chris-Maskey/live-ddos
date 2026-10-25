"use client"

import { useEffect, useMemo, useState } from "react"
import { Pause, Play } from "lucide-react"
import { AttackGlobe, type GlobeScene } from "@/components/attack-globe"
import { DashboardHeader } from "@/components/dashboard-header"
import { RouteLedger } from "@/components/route-ledger"
import {
  getAttackRouteKey,
  isAttackReport,
  type AttackReport,
  type RadarRange,
} from "@/lib/attack-data"
import { getDashboardViewState } from "@/lib/dashboard-view-state"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const responseError = (body: unknown): string | null => {
  if (!isRecord(body)) return null
  const error = body.error
  if (!isRecord(error)) return null
  return typeof error.message === "string" ? error.message : null
}

const makeGlobeScene = (snapshot: AttackReport["current"] | undefined): GlobeScene => {
  const arcs: GlobeScene["arcs"] = []
  const locations: GlobeScene["locations"] = []
  const seenCountries = new Set<GlobeScene["locations"][number]["code"]>()

  for (const [order, route] of (snapshot?.routes ?? []).entries()) {
    for (const endpoint of [route.origin, route.target]) {
      const { code, latitude, longitude } = endpoint
      if (
        latitude === null ||
        longitude === null ||
        seenCountries.has(code)
      ) {
        continue
      }

      seenCountries.add(code)
      locations.push({ code, lat: latitude, lng: longitude })
    }

    const { latitude: startLat, longitude: startLng } = route.origin
    const { latitude: endLat, longitude: endLng } = route.target
    if (
      startLat === null ||
      startLng === null ||
      endLat === null ||
      endLng === null
    ) {
      continue
    }

    const weight = Math.sqrt(route.percent)
    arcs.push({
      routeId: route.id,
      order,
      startLat,
      startLng,
      endLat,
      endLng,
      arcAlt: Math.min(0.52, 0.12 + weight * 0.035),
      stroke: Math.min(0.62, 0.12 + weight * 0.055),
    })
  }

  return { arcs, locations }
}

export function AttackDashboard() {
  const [range, setRange] = useState<RadarRange>("1d")
  const [reports, setReports] = useState<
    Partial<Record<RadarRange, AttackReport>>
  >({})
  const [errors, setErrors] = useState<Partial<Record<RadarRange, string>>>({})
  const [fetching, setFetching] = useState<
    Partial<Record<RadarRange, boolean>>
  >({})
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<
    boolean | null
  >(null)
  const report = reports[range]
  const error = errors[range]
  const isFetching = fetching[range] ?? false
  const view = getDashboardViewState({ report, error, isFetching })
  const scene = useMemo(() => makeGlobeScene(report?.current), [report])
  const selectedRoute = report?.current.routes.find(
    (route) =>
      getAttackRouteKey(route.origin.code, route.target.code) ===
      selectedRouteKey,
  )
  const effectiveMotionEnabled =
    motionEnabled && prefersReducedMotion === false

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener("change", updatePreference)
    return () => preference.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    let stopped = false
    let inFlight = false
    let refreshOnVisibility = false
    let retryDelay = POLL_INTERVAL_MS
    let timer: number | null = null
    let controller: AbortController | null = null

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }

    const schedule = (delay: number) => {
      clearTimer()
      if (!stopped) timer = window.setTimeout(() => void poll(), delay)
    }

    const poll = async () => {
      if (stopped) return
      if (document.visibilityState !== "visible") {
        schedule(POLL_INTERVAL_MS)
        return
      }
      if (inFlight) {
        refreshOnVisibility = true
        return
      }

      inFlight = true
      controller = new AbortController()
      setFetching((current) => ({ ...current, [range]: true }))
      try {
        const response = await fetch(`/api/attacks?range=${range}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const body: unknown = await response.json()
        if (!response.ok) {
          throw new Error(
            responseError(body) ?? "Cloudflare Radar could not be reached."
          )
        }

        if (!isAttackReport(body)) {
          throw new Error("Cloudflare Radar returned an unexpected response.")
        }
        const nextReport = body
        setReports((current) => ({ ...current, [range]: nextReport }))
        setErrors((current) => {
          const next = { ...current }
          delete next[range]
          return next
        })
        retryDelay = POLL_INTERVAL_MS
      } catch (cause) {
        if (!controller.signal.aborted) {
          setErrors((current) => ({
            ...current,
            [range]:
              cause instanceof Error
                ? cause.message
                : "Cloudflare Radar could not be reached.",
          }))
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
        }
      } finally {
        inFlight = false
        if (stopped) return
        setFetching((current) => ({ ...current, [range]: false }))
        if (refreshOnVisibility && document.visibilityState === "visible") {
          refreshOnVisibility = false
          schedule(0)
        } else {
          schedule(retryDelay)
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer()
        return
      }
      if (inFlight) {
        refreshOnVisibility = true
      } else {
        void poll()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    void poll()

    return () => {
      stopped = true
      clearTimer()
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [range, refreshKey])

  return (
    <main className="dashboard-page bg-atlas-water text-atlas-main">
      <div className="dashboard-content mx-auto w-full max-w-[1120px]">
        <DashboardHeader
          range={range}
          view={view}
          onRangeChange={setRange}
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />

        <section
          aria-label="Ranked routes and globe visualization"
          aria-busy={isFetching}
          className="route-index-enter route-index-layout grid min-h-0 min-w-0 gap-4 sm:gap-5"
        >
          <div className="route-index-globe mx-auto w-full max-w-[760px] min-w-0">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
              <p className="text-xs text-atlas-secondary">Drag to rotate</p>
              <button
                type="button"
                onClick={() => setMotionEnabled((enabled) => !enabled)}
                disabled={prefersReducedMotion !== false}
                aria-pressed={effectiveMotionEnabled}
                className="dashboard-control inline-flex min-h-11 items-center gap-2 px-1 text-xs text-atlas-secondary focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75"
              >
                {effectiveMotionEnabled ? (
                  <Pause aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
                {prefersReducedMotion === null
                  ? "Checking motion preference"
                  : prefersReducedMotion
                    ? "Reduced motion"
                    : motionEnabled
                      ? "Pause motion"
                      : "Resume motion"}
              </button>
            </div>

            <AttackGlobe
              scene={scene}
              motionEnabled={effectiveMotionEnabled}
              selectedRouteId={selectedRoute?.id ?? null}
            />
          </div>

          <RouteLedger
            view={view}
            selectedRouteKey={selectedRouteKey}
            onSelectRoute={setSelectedRouteKey}
          />
        </section>
      </div>

      <footer className="dashboard-footer border-t border-atlas-line/70 bg-atlas-water text-xs leading-normal text-atlas-secondary">
        <div className="dashboard-footer-content mx-auto flex w-full max-w-[1120px] flex-col gap-x-8 gap-y-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-pretty">
            Routes show Cloudflare Radar&apos;s normalized reported share for each
            country pair in the selected window. Locations are country-level
            approximations. Arc direction and motion are illustrative, not
            individual attack events.
          </p>
          <p className="shrink-0">
            <a
              href="https://radar.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="dashboard-link text-atlas-route underline decoration-atlas-route/40 underline-offset-4 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none"
            >
              Data by Cloudflare Radar
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc/4.0/"
              target="_blank"
              rel="noreferrer"
              className="dashboard-link underline decoration-atlas-secondary/50 underline-offset-4 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none"
            >
              CC BY-NC 4.0
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}
