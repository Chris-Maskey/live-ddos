"use client"

import type { AttackSnapshot } from "@/lib/attack-data"
import type { DashboardViewState } from "@/lib/dashboard-view-state"

type Route = AttackSnapshot["routes"][number]

type RouteLedgerProps = {
  view: DashboardViewState
  selectedRouteId: string | null
  onSelectRoute: (routeId: string) => void
}

const routeLabel = (route: Route) =>
  `${route.origin.name} → ${route.target.name}`

const hasMissingCoordinates = (route: Route) =>
  route.origin.latitude === null ||
  route.origin.longitude === null ||
  route.target.latitude === null ||
  route.target.longitude === null

export function RouteLedger({
  view,
  selectedRouteId,
  onSelectRoute,
}: RouteLedgerProps) {
  const snapshot =
    view.kind === "ready" || view.kind === "empty" || view.kind === "stale"
      ? view.snapshot
      : undefined
  const selectedRoute = snapshot?.routes.find(
    (route) => route.id === selectedRouteId
  )

  return (
    <aside
      aria-labelledby="route-ledger-title"
      className="min-w-0 rounded-md border border-atlas-line bg-atlas-panel p-4 sm:p-5"
    >
      <div className="border-b border-atlas-line pb-4">
        <p className="font-mono text-[10px] tracking-[0.2em] text-atlas-route uppercase">
          Route ledger
        </p>
        <h2
          id="route-ledger-title"
          className="mt-1 font-heading text-lg tracking-wide text-atlas-main uppercase"
        >
          Top country pairs
        </h2>
      </div>

      {view.kind === "stale" && (
        <div
          role="alert"
          aria-label="Delayed update"
          className="mt-4 rounded border border-atlas-amber/45 bg-atlas-amber/10 p-3 text-sm text-atlas-main"
        >
          <p className="font-mono text-[10px] font-semibold tracking-widest text-atlas-amber uppercase">
            Delayed update
          </p>
          <p className="mt-1 leading-5 break-words">{view.error}</p>
          <p className="mt-2 text-xs leading-5 text-atlas-secondary">
            Showing the previous Radar snapshot while the next update is
            unavailable.
          </p>
        </div>
      )}

      {view.kind === "unavailable" && (
        <div
          role="alert"
          aria-label="Radar unavailable"
          className="mt-4 rounded border border-atlas-amber/45 bg-atlas-amber/10 p-3 text-sm text-atlas-main"
        >
          <p className="font-mono text-[10px] font-semibold tracking-widest text-atlas-amber uppercase">
            Radar unavailable
          </p>
          <p className="mt-1 leading-5 break-words">{view.error}</p>
        </div>
      )}

      {view.kind === "loading" && (
        <p className="mt-4 text-sm leading-6 text-atlas-secondary">
          {view.isFetching
            ? "Checking Cloudflare Radar…"
            : "Waiting for Cloudflare Radar…"}
        </p>
      )}

      {snapshot && (
        <>
          <p className="mt-4 text-xs leading-5 text-atlas-secondary">
            Share of normalized HTTP request traffic in this window. Routes
            without mapped coordinates remain listed.
          </p>

          {snapshot.routes.length > 0 ? (
            <ul className="mt-3 divide-y divide-atlas-line lg:max-h-[min(54vh,560px)] lg:overflow-y-auto lg:pr-1">
              {snapshot.routes.map((route, index) => {
                const selected = selectedRouteId === route.id
                const unmapped = hasMissingCoordinates(route)

                return (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRoute(route.id)}
                      aria-pressed={selected}
                      aria-label={`${routeLabel(route)}; ${route.percent.toFixed(2)} percent normalized share${unmapped ? "; coordinates unavailable" : ""}`}
                      className={`grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-l-2 px-2 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:outline-none focus-visible:ring-inset motion-safe:transition-colors ${selected ? "border-atlas-amber bg-atlas-amber/10 text-atlas-amber" : "border-transparent text-atlas-main hover:bg-atlas-water/70 hover:text-atlas-route"}`}
                    >
                      <span
                        className={`font-mono text-[10px] tabular-nums ${selected ? "text-atlas-amber" : "text-atlas-secondary"}`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs font-medium sm:text-sm">
                            {routeLabel(route)}
                          </span>
                          {selected && (
                            <span className="shrink-0 rounded-sm border border-atlas-amber/50 px-1 py-0.5 font-mono text-[8px] tracking-wide text-atlas-amber uppercase">
                              Selected
                            </span>
                          )}
                        </span>
                        {unmapped && (
                          <span className="mt-1 block font-mono text-[9px] tracking-wide text-atlas-secondary uppercase">
                            Coordinates unavailable
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-xs tabular-nums ${selected ? "text-atlas-amber" : "text-atlas-route"}`}
                      >
                        {route.percent.toFixed(2)}%
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-5 rounded border border-atlas-line bg-atlas-water/40 px-3 py-4 text-sm leading-6 text-atlas-secondary">
              No ranked country pairs in this reporting window.
            </p>
          )}

          {selectedRoute && (
            <div
              aria-live="polite"
              className="mt-4 border-t border-atlas-line pt-4"
            >
              <p className="font-mono text-[10px] tracking-widest text-atlas-amber uppercase">
                Selected route
              </p>
              <p className="mt-1 text-sm break-words text-atlas-main">
                {routeLabel(selectedRoute)}
              </p>
              <p className="mt-1 font-mono text-xs text-atlas-amber tabular-nums">
                {selectedRoute.percent.toFixed(2)}% normalized share
              </p>
              {hasMissingCoordinates(selectedRoute) && (
                <p className="mt-1 text-xs text-atlas-secondary">
                  This route has no mapped position on the globe.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
