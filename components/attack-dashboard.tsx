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
    <main className="min-h-svh bg-atlas-water px-4 py-4 text-atlas-main sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1120px]">
        <DashboardHeader
          range={range}
          view={view}
          onRangeChange={setRange}
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />

        <section
          aria-label="Ranked routes and globe visualization"
          aria-busy={isFetching}
          className="route-index-enter route-index-layout grid min-w-0 gap-3 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] lg:items-start lg:gap-8"
        >
          <RouteLedger
            view={view}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
          />

          <div className="route-index-globe min-w-0">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
              <p className="text-xs text-atlas-secondary">Drag to rotate</p>
              <button
                type="button"
                onClick={() => setMotionEnabled((enabled) => !enabled)}
                disabled={prefersReducedMotion}
                aria-pressed={motionEnabled && !prefersReducedMotion}
                className="dashboard-control inline-flex min-h-11 items-center gap-2 px-1 text-xs text-atlas-secondary focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75"
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
          </div>
        </section>

        <footer className="mt-4 flex flex-col gap-x-8 gap-y-2 border-t border-atlas-line/70 pt-3 text-xs leading-5 text-atlas-secondary sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl">
            Routes show country-level shares of normalized HTTP requests for the
            selected window. Locations are country-level approximations. Arc
            direction and motion are illustrative, not individual attacks.
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
        </footer>
      </div>
    </main>
  )
}
