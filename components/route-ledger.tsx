"use client"

import { useState } from "react"
import {
  compareAttackRoute,
  getAttackRouteKey,
  type AttackReport,
} from "@/lib/attack-data"
import type { DashboardViewState } from "@/lib/dashboard-view-state"
import LoadingState from "@/components/loading-state"

type Route = AttackReport["current"]["routes"][number]

type RouteLedgerProps = {
  view: DashboardViewState
  selectedRouteKey: string | null
  onSelectRoute: (routeKey: string) => void
}

const routeLabel = (route: Route) =>
  `${route.origin.name} → ${route.target.name}`

const hasMissingCoordinates = (route: Route) =>
  route.origin.latitude === null ||
  route.origin.longitude === null ||
  route.target.latitude === null ||
  route.target.longitude === null

const formatPpChange = (changePp: number) =>
  `${changePp > 0 ? "+" : ""}${changePp.toFixed(2)} pp`

const skeletonRows = Array.from({ length: 10 }, (_, index) => index)

export function RouteLedger({
  view,
  selectedRouteKey,
  onSelectRoute,
}: RouteLedgerProps) {
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const report =
    view.kind === "ready" || view.kind === "empty" || view.kind === "stale"
      ? view.report
      : undefined
  const snapshot = report?.current
  const routeCount = snapshot?.routes.length ?? 0
  const renderRouteListToggle = (expanded: boolean) => (
    <button
      type="button"
      aria-controls="route-ledger-rows"
      aria-expanded={expanded}
      onClick={() => setShowAllRoutes((current) => !current)}
      className="route-list-toggle"
    >
      {expanded ? "Show fewer routes" : `Show all ${routeCount} routes`}
    </button>
  )
  const renderColumnHeading = () => (
    <div
      aria-hidden="true"
      className="route-ledger-grid route-ledger-column-head"
    >
      <span />
      <span>Route</span>
      <span className="text-right">Share</span>
      <span className="text-right">Change</span>
    </div>
  )
  const comparisonPeriod =
    snapshot?.range === "1d"
      ? "same weekday last week"
      : snapshot?.range === "7d"
        ? "prior 7 days"
        : undefined

  return (
    <aside
      aria-labelledby="route-ledger-title"
      className="route-ledger flex min-h-0 min-w-0 flex-col"
    >
      <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-atlas-line/70 pb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              id="route-ledger-title"
              className="text-base font-semibold text-atlas-main"
            >
              Top routes
            </h2>
            {snapshot && (
              <span className="text-[11px] leading-tight text-atlas-secondary tabular-nums">
                {snapshot.routes.length} pairs
                <span className="route-ledger-scroll-cue">
                  {" · scroll this list to view all"}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-caption leading-snug text-atlas-secondary">
            {`Change in percentage points${comparisonPeriod ? ` vs ${comparisonPeriod}` : ""}`}
          </p>
        </div>
      </div>

      {view.kind === "stale" && (
        <div
          role="alert"
          aria-label="Delayed update"
          className="mt-3 shrink-0 text-sm text-atlas-main"
        >
          <p className="font-semibold text-atlas-warning">Delayed update</p>
          <p className="mt-1 leading-normal break-words">{view.error}</p>
          <p className="mt-1 text-xs leading-normal text-atlas-secondary">
            Showing the previous report.
          </p>
        </div>
      )}

      {view.kind === "unavailable" && (
        <div
          role="alert"
          aria-label="Radar unavailable"
          className="mt-3 shrink-0 text-sm text-atlas-main"
        >
          <p className="font-semibold text-atlas-danger">Radar unavailable</p>
          <p className="mt-1 leading-normal break-words">{view.error}</p>
        </div>
      )}

      {view.kind === "loading" && (
        <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 py-3">
            <LoadingState
              label={view.isFetching ? "Checking Radar…" : "Waiting for Radar…"}
              announce={false}
              showElapsed={false}
            />
          </div>
          <div aria-hidden="true" className="min-h-0 overflow-hidden">
            {skeletonRows.map((index) => (
              <div
                key={index}
                className="grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_6rem] items-center gap-2 border-b border-atlas-line/70 py-2.5 pr-2 pl-3"
              >
                <span className="h-3 w-5 animate-pulse rounded bg-atlas-line motion-reduce:animate-none" />
                <span
                  className={`h-3 animate-pulse rounded bg-atlas-line motion-reduce:animate-none ${index % 3 === 0 ? "w-3/4" : index % 3 === 1 ? "w-1/2" : "w-2/3"}`}
                />
                <span className="ml-auto h-3 w-[3.5rem] animate-pulse rounded bg-atlas-line motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot && (
        <>
          {snapshot.routes.length > 0 ? (
            <>
              {snapshot.routes.length > 6 && showAllRoutes && (
                <div className="route-list-expanded-actions">
                  <div className="route-list-expanded-action-buttons">
                    {renderRouteListToggle(true)}
                    <a href="#route-map" className="route-list-map-link">
                      View map
                    </a>
                  </div>
                  {renderColumnHeading()}
                  <p className="route-list-comparison-note">
                    Change vs {comparisonPeriod} · percentage points
                  </p>
                </div>
              )}
              <div
                id="route-ledger-rows"
                role="region"
                aria-labelledby="route-ledger-title"
                tabIndex={0}
                data-expanded={showAllRoutes}
                className="route-ledger-rows mt-1"
              >
                {renderColumnHeading()}
                <ul className="flex flex-col gap-0">
                  {snapshot.routes.map((route, index) => {
                    const routeKey = getAttackRouteKey(
                      route.origin.code,
                      route.target.code
                    )
                    const selected = selectedRouteKey === routeKey
                    const unmapped = hasMissingCoordinates(route)
                    const comparison = report
                      ? compareAttackRoute(route, report.comparison)
                      : { kind: "not-ranked" as const }
                    const comparisonLabel =
                      comparison.kind === "ranked"
                        ? formatPpChange(comparison.changePp)
                        : "Not in prior top 40"
                    const accessibleComparison =
                      comparison.kind === "ranked"
                        ? `change ${formatPpChange(comparison.changePp)} from the previous reporting window`
                        : "previous share unknown because this pair was not ranked in the previous top 40"

                    return (
                      <li key={route.id}>
                        <button
                          type="button"
                          onClick={() => onSelectRoute(routeKey)}
                          aria-pressed={selected}
                          aria-label={`${routeLabel(route)}, ${route.percent.toFixed(2)} percent share of all reported Layer 7 DDoS requests, ${accessibleComparison}${unmapped ? ", coordinates unavailable" : ""}`}
                          className={`route-index-row route-ledger-grid grid min-h-11 w-full items-center border-b border-atlas-line/70 py-2.5 pr-2 pl-3 text-left text-atlas-main focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none focus-visible:ring-inset ${selected ? "bg-atlas-route-subtle" : ""}`}
                        >
                          <span
                            className={`font-mono text-xs tabular-nums ${selected ? "text-atlas-main" : "text-atlas-secondary"}`}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm leading-normal font-medium break-words">
                              {routeLabel(route)}
                            </span>
                            {unmapped && (
                              <span className="mt-0.5 block text-xs leading-normal text-atlas-secondary">
                                Coordinates unavailable
                              </span>
                            )}
                          </span>
                          <span className="text-right font-mono text-xs text-atlas-route tabular-nums">
                            {route.percent.toFixed(2)}%
                          </span>
                          <span className="text-right font-mono text-caption leading-tight tabular-nums">
                            <span
                              title={
                                comparison.kind === "not-ranked"
                                  ? "This pair was outside Radar's prior top 40, so its previous share is unknown."
                                  : undefined
                              }
                              className={
                                comparison.kind === "ranked" &&
                                comparison.changePp > 0
                                  ? "text-atlas-warning"
                                  : "text-atlas-secondary"
                              }
                            >
                              {comparisonLabel}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {snapshot.routes.length > 6 &&
                !showAllRoutes &&
                renderRouteListToggle(false)}
            </>
          ) : (
            <p className="mt-3 shrink-0 text-sm leading-normal text-atlas-secondary">
              No ranked routes in this window.
            </p>
          )}
        </>
      )}
    </aside>
  )
}
