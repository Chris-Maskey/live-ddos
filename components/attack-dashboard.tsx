"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { AttackGlobe, type GlobeScene } from "@/components/attack-globe"
import { DashboardHeader } from "@/components/dashboard-header"
import { RouteLedger } from "@/components/route-ledger"
import { IconSwap } from "@/components/ui/icon-swap"
import {
  getAttackRouteKey,
  isAttackReport,
  type AttackReport,
  type RadarRange,
} from "@/lib/attack-data"
import { getDashboardViewState } from "@/lib/dashboard-view-state"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000
type PollOutcome = "success" | "failure" | "cancelled"
type RouteSelection =
  | { kind: "default" }
  | { kind: "route"; key: string }
  | { kind: "none" }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const responseError = (body: unknown): string | null => {
  if (!isRecord(body)) return null
  const error = body.error
  if (!isRecord(error)) return null
  return typeof error.message === "string" ? error.message : null
}

const makeGlobeScene = (
  snapshot: AttackReport["current"] | undefined
): GlobeScene => {
  const arcs: GlobeScene["arcs"] = []
  const locations: GlobeScene["locations"] = []
  const seenCountries = new Set<GlobeScene["locations"][number]["code"]>()

  for (const [order, route] of (snapshot?.routes ?? []).entries()) {
    for (const endpoint of [route.origin, route.target]) {
      const { code, latitude, longitude } = endpoint
      if (latitude === null || longitude === null || seenCountries.has(code)) {
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
      startName: route.origin.name,
      startCode: route.origin.code,
      startLat,
      startLng,
      endName: route.target.name,
      endCode: route.target.code,
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
  const [routeSelection, setRouteSelection] = useState<RouteSelection>({
    kind: "default",
  })
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<
    boolean | null
  >(null)
  const pollRef = useRef<(() => Promise<PollOutcome>) | null>(null)
  const report = reports[range]
  const error = errors[range]
  const isFetching = fetching[range] ?? false
  const view = getDashboardViewState({ report, error, isFetching })
  const scene = useMemo(() => makeGlobeScene(report?.current), [report])
  const firstMappedCrossBorderRoute = report?.current.routes.find(
    (route) =>
      route.origin.code !== route.target.code &&
      route.origin.latitude !== null &&
      route.origin.longitude !== null &&
      route.target.latitude !== null &&
      route.target.longitude !== null
  )
  const defaultRoute = firstMappedCrossBorderRoute ?? report?.current.routes[0]
  const selectedRoute =
    routeSelection.kind === "none"
      ? undefined
      : routeSelection.kind === "route"
        ? (report?.current.routes.find(
            (route) =>
              getAttackRouteKey(route.origin.code, route.target.code) ===
              routeSelection.key
          ) ?? defaultRoute)
        : defaultRoute
  const activeSelectedRouteKey = selectedRoute
    ? getAttackRouteKey(selectedRoute.origin.code, selectedRoute.target.code)
    : null
  const effectiveMotionEnabled = motionEnabled && prefersReducedMotion === false

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
    let activePoll: Promise<PollOutcome> | null = null
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

    const poll = (): Promise<PollOutcome> => {
      if (stopped) return Promise.resolve("cancelled")
      if (document.visibilityState !== "visible") {
        schedule(POLL_INTERVAL_MS)
        return Promise.resolve("cancelled")
      }
      if (inFlight) {
        return activePoll ?? Promise.resolve("cancelled")
      }

      inFlight = true
      const requestController = new AbortController()
      controller = requestController
      setFetching((current) => ({ ...current, [range]: true }))
      const request = (async (): Promise<PollOutcome> => {
        let outcome: PollOutcome = "cancelled"
        try {
          const response = await fetch(`/api/attacks?range=${range}`, {
            cache: "no-store",
            signal: requestController.signal,
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
          outcome = "success"
        } catch (cause) {
          if (!requestController.signal.aborted) {
            setErrors((current) => ({
              ...current,
              [range]:
                cause instanceof Error
                  ? cause.message
                  : "Cloudflare Radar could not be reached.",
            }))
            retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
            outcome = "failure"
          }
        } finally {
          inFlight = false
          if (controller === requestController) controller = null
          if (!stopped) {
            setFetching((current) => ({ ...current, [range]: false }))
            if (refreshOnVisibility && document.visibilityState === "visible") {
              refreshOnVisibility = false
              schedule(0)
            } else {
              schedule(retryDelay)
            }
          }
        }
        return outcome
      })()
      activePoll = request
      void request.then(() => {
        if (activePoll === request) activePoll = null
      })
      return request
    }

    pollRef.current = poll

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
      if (pollRef.current === poll) pollRef.current = null
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [range])

  const handleRefresh = async () => {
    const poll = pollRef.current
    if (!poll) throw new Error("The dashboard is still loading.")

    const outcome = await poll()
    if (outcome !== "success") {
      throw new Error("Cloudflare Radar could not be refreshed.")
    }
  }

  return (
    <main className="dashboard-page bg-atlas-water text-atlas-main">
      <div className="dashboard-content mx-auto w-full max-w-[1120px]">
        <DashboardHeader
          range={range}
          view={view}
          onRangeChange={setRange}
          onRefresh={handleRefresh}
        />

        <section
          aria-label="Top routes and globe visualization"
          aria-busy={isFetching}
          className="route-index-enter route-index-layout grid min-h-0 min-w-0 gap-4 sm:gap-5"
        >
          <RouteLedger
            view={view}
            selectedRouteKey={activeSelectedRouteKey}
            onSelectRoute={(key) => setRouteSelection({ kind: "route", key })}
          />

          <div
            id="route-map"
            className="route-index-globe mx-auto w-full max-w-[760px] min-w-0"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">Route map</h2>
                <p className="mt-1 text-xs leading-tight text-[color:var(--atlas-map-muted)]">
                  Drag or use ← / → to rotate.
                </p>
                {selectedRoute && (
                  <button
                    type="button"
                    onClick={() => setRouteSelection({ kind: "none" })}
                    className="mt-1 inline-flex min-h-8 items-center rounded text-xs font-medium text-[color:var(--atlas-map-route)] underline underline-offset-2 hover:text-white focus-visible:ring-2 focus-visible:ring-atlas-map-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-map-water focus-visible:outline-none"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMotionEnabled((enabled) => !enabled)}
                disabled={prefersReducedMotion !== false}
                aria-pressed={effectiveMotionEnabled}
                className="dashboard-control inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-medium text-[color:var(--atlas-map-muted)] focus-visible:ring-2 focus-visible:ring-atlas-map-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-map-water focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75"
              >
                <IconSwap
                  state={effectiveMotionEnabled ? "pause" : "play"}
                  className="inline-flex size-16 shrink-0 items-center justify-center"
                >
                  {effectiveMotionEnabled ? (
                    <Pause aria-hidden="true" className="size-16 shrink-0" />
                  ) : (
                    <Play aria-hidden="true" className="size-16 shrink-0" />
                  )}
                </IconSwap>
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
        </section>
      </div>

      <footer className="dashboard-footer border-t border-atlas-line/70 bg-atlas-water text-xs leading-normal text-atlas-secondary">
        <div className="dashboard-footer-content mx-auto flex w-full max-w-[1120px] flex-col gap-x-8 gap-y-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-pretty">
            Country locations are approximate. Moving arcs illustrate reported
            country pairs, not individual attack events.
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
