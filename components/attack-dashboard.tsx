"use client"

import { useEffect, useMemo, useState } from "react"
import { Pause, Play } from "lucide-react"
import { AttackGlobe } from "@/components/attack-globe"
import { DashboardHeader } from "@/components/dashboard-header"
import { RouteLedger } from "@/components/route-ledger"
import { type GlobeArc } from "@/components/ui/globe"
import {
  isAttackSnapshot,
  type AttackSnapshot,
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

const makeArcs = (snapshot: AttackSnapshot | undefined): GlobeArc[] =>
  (snapshot?.routes ?? []).flatMap((route, order) => {
    const { latitude: startLat, longitude: startLng } = route.origin
    const { latitude: endLat, longitude: endLng } = route.target
    if (
      startLat === null ||
      startLng === null ||
      endLat === null ||
      endLng === null
    ) {
      return []
    }

    const weight = Math.sqrt(route.percent)
    return [
      {
        routeId: route.id,
        order,
        startLat,
        startLng,
        endLat,
        endLng,
        arcAlt: Math.min(0.52, 0.12 + weight * 0.035),
        color: "#64CDBF",
        stroke: Math.min(0.62, 0.12 + weight * 0.055),
      },
    ]
  })

export function AttackDashboard() {
  const [range, setRange] = useState<RadarRange>("1d")
  const [snapshots, setSnapshots] = useState<
    Partial<Record<RadarRange, AttackSnapshot>>
  >({})
  const [errors, setErrors] = useState<Partial<Record<RadarRange, string>>>({})
  const [fetching, setFetching] = useState<
    Partial<Record<RadarRange, boolean>>
  >({})
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const snapshot = snapshots[range]
  const error = errors[range]
  const isFetching = fetching[range] ?? false
  const view = getDashboardViewState({ snapshot, error, isFetching })
  const arcs = useMemo(() => makeArcs(snapshot), [snapshot])

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

        if (!isAttackSnapshot(body)) {
          throw new Error("Cloudflare Radar returned an unexpected response.")
        }
        const nextSnapshot = body
        setSnapshots((current) => ({ ...current, [range]: nextSnapshot }))
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
    <main className="min-h-svh bg-atlas-water px-4 py-6 text-atlas-main sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-screen-2xl">
        <DashboardHeader
          range={range}
          view={view}
          onRangeChange={setRange}
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />

        <section
          aria-label="Country-pair map and route details"
          aria-busy={isFetching}
          className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-6"
        >
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-atlas-line pb-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-atlas-route uppercase">
                  Route map
                </p>
                <p className="mt-1 text-xs text-atlas-secondary">
                  Country-level routes · drag to rotate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMotionEnabled((enabled) => !enabled)}
                disabled={prefersReducedMotion}
                aria-pressed={motionEnabled && !prefersReducedMotion}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-atlas-line bg-atlas-panel px-3 text-xs font-medium text-atlas-main hover:border-atlas-route/60 hover:text-atlas-route focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75 motion-safe:transition-colors"
              >
                {motionEnabled && !prefersReducedMotion ? (
                  <Pause aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
                {prefersReducedMotion
                  ? "Reduced motion"
                  : motionEnabled
                    ? "Pause motion"
                    : "Resume motion"}
              </button>
            </div>

            <AttackGlobe
              arcs={arcs}
              motionEnabled={motionEnabled && !prefersReducedMotion}
              selectedRouteId={selectedRouteId}
            />
            <p className="mt-2 text-xs leading-5 text-atlas-secondary">
              {prefersReducedMotion
                ? "System reduced motion is on. Drag the globe to rotate it manually."
                : "Arc motion is a display effect. Drag the globe to rotate it manually."}
            </p>
          </div>

          <RouteLedger
            view={view}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
          />
        </section>

        <footer className="mt-6 flex flex-col gap-3 border-t border-atlas-line pt-4 text-xs leading-5 text-atlas-secondary sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl">
            Each arc summarizes an aggregate country pair during the selected
            reporting window. Motion illustrates route direction and does not
            represent individual attacks. Locations are country-level
            approximations.
          </p>
          <p className="shrink-0">
            <a
              href="https://radar.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="text-atlas-route underline decoration-atlas-route/40 underline-offset-4 hover:text-atlas-main focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none"
            >
              Data by Cloudflare Radar
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-atlas-secondary/50 underline-offset-4 hover:text-atlas-main focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none"
            >
              CC BY-NC 4.0
            </a>
          </p>
        </footer>
      </div>
    </main>
  )
}
