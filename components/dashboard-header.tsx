"use client"

import { RefreshCw } from "lucide-react"
import type { RadarRange } from "@/lib/attack-data"
import type { DashboardViewState } from "@/lib/dashboard-view-state"

type DashboardHeaderProps = {
  range: RadarRange
  view: DashboardViewState
  onRangeChange: (range: RadarRange) => void
  onRefresh: () => void
}

export function DashboardHeader({
  range,
  view,
  onRangeChange,
  onRefresh,
}: DashboardHeaderProps) {
  const snapshot =
    view.kind === "ready" || view.kind === "empty" || view.kind === "stale"
      ? view.snapshot
      : undefined
  const isFetching = view.isFetching
  const statusLabel =
    view.kind === "stale"
      ? isFetching
        ? "Checking for updates"
        : "Delayed update"
      : view.kind === "unavailable"
        ? isFetching
          ? "Checking Radar"
          : "Radar unavailable"
        : view.kind === "loading"
          ? isFetching
            ? "Checking Radar"
            : "Waiting for Radar"
          : isFetching
            ? "Checking for updates"
            : "Snapshot loaded"
  const statusColor =
    (view.kind === "stale" && !isFetching) ||
    (view.kind === "unavailable" && !isFetching)
      ? "bg-atlas-amber"
      : "bg-atlas-route"

  return (
    <header className="mb-5 flex flex-col gap-5 border-b border-atlas-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.2em] text-atlas-route uppercase">
          HTTP DDoS · country pairs
        </p>
        <h1 className="mt-2 font-heading text-3xl leading-tight tracking-tight text-atlas-main sm:text-4xl">
          Network attack map
        </h1>
        <p className="mt-2 text-sm text-atlas-secondary">
          Cloudflare Radar{" "}
          <span aria-hidden="true" className="px-1 text-atlas-secondary/70">
            ·
          </span>{" "}
          aggregated HTTP DDoS routes
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] sm:text-xs">
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 font-mono tracking-wide text-atlas-secondary uppercase"
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${statusColor} ${view.kind === "loading" && isFetching ? "motion-safe:animate-pulse" : ""}`}
            />
            {statusLabel}
          </p>
          {snapshot && (
            <p className="font-mono text-atlas-secondary">
              Last dataset update{" "}
              <time
                dateTime={snapshot.lastUpdated}
                className="text-atlas-main tabular-nums"
              >
                {new Date(snapshot.lastUpdated).toLocaleString()}
              </time>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:flex sm:items-end">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 font-mono text-[10px] tracking-widest text-atlas-secondary uppercase">
            Reporting window
          </legend>
          <div
            role="group"
            aria-label="Reporting window"
            className="flex rounded-md border border-atlas-line bg-atlas-panel p-1"
          >
            <button
              type="button"
              aria-pressed={range === "1d"}
              onClick={() => onRangeChange("1d")}
              className={`min-h-9 flex-1 rounded px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none motion-safe:transition-colors ${range === "1d" ? "bg-atlas-route/15 text-atlas-route" : "text-atlas-secondary hover:text-atlas-main"}`}
            >
              24 hours
            </button>
            <button
              type="button"
              aria-pressed={range === "7d"}
              onClick={() => onRangeChange("7d")}
              className={`min-h-9 flex-1 rounded px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none motion-safe:transition-colors ${range === "7d" ? "bg-atlas-route/15 text-atlas-route" : "text-atlas-secondary hover:text-atlas-main"}`}
            >
              7 days
            </button>
          </div>
        </fieldset>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh Radar snapshot"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-atlas-line bg-atlas-panel px-3 text-xs font-medium text-atlas-main hover:border-atlas-route/60 hover:text-atlas-route focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none motion-safe:transition-colors"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </button>
      </div>
    </header>
  )
}
