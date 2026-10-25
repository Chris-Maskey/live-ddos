"use client"

import {
  compareAttackRoute,
  getAttackRouteKey,
  type AttackReport,
} from "@/lib/attack-data"
import type { DashboardViewState } from "@/lib/dashboard-view-state"

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

export function RouteLedger({
  view,
  selectedRouteKey,
  onSelectRoute,
}: RouteLedgerProps) {
  const report =
    view.kind === "ready" || view.kind === "empty" || view.kind === "stale"
      ? view.report
      : undefined
  const snapshot = report?.current
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
        <h2
          id="route-ledger-title"
          className="text-sm font-semibold text-atlas-main"
        >
          Top routes
        </h2>
        <span className="ml-auto max-w-[75%] min-w-0 text-right text-[10px] leading-tight text-atlas-secondary">
          {`Reported share · change${comparisonPeriod ? ` vs ${comparisonPeriod}` : ""}`}
        </span>
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
        <p className="mt-4 shrink-0 text-sm leading-normal text-atlas-secondary">
          {view.isFetching ? "Checking Radar…" : "Waiting for Radar…"}
        </p>
      )}

      {snapshot && (
        <>
          {snapshot.routes.length > 0 ? (
            <div
              role="region"
              aria-labelledby="route-ledger-title"
              tabIndex={0}
              className="route-ledger-rows mt-1"
            >
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
                      : "Change unknown"
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
                        aria-label={`${routeLabel(route)}, ${route.percent.toFixed(2)} percent normalized reported share, ${accessibleComparison}${unmapped ? ", coordinates unavailable" : ""}`}
                        className={`route-index-row grid min-h-11 w-full grid-cols-[1.5rem_minmax(0,1fr)_5rem] items-center gap-2 border-b border-atlas-line/70 py-2.5 pr-2 pl-3 text-left text-atlas-main focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none focus-visible:ring-inset ${selected ? "bg-atlas-route-subtle" : ""}`}
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
                        <span className="w-20 text-right font-mono text-xs tabular-nums">
                          <span className="block text-atlas-route">
                            {route.percent.toFixed(2)}%
                          </span>
                          <span className="block text-[10px] text-atlas-secondary">
                            {comparisonLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
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
