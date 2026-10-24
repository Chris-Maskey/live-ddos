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
    view.kind === "stale" && !isFetching
      ? "bg-atlas-warning"
      : view.kind === "unavailable" && !isFetching
        ? "bg-atlas-danger"
        : "bg-atlas-route"

  return (
    <header className="mb-4 border-b border-atlas-line/70 pb-4 sm:mb-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-atlas-main uppercase">
          Liveddos
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-atlas-secondary">
          <p
            role="status"
            aria-live="polite"
            className="inline-flex h-5 items-center gap-2 text-[11px]"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${statusColor}`}
            />
            {statusLabel}
          </p>
          {snapshot && (
            <p className="min-w-0 border-l border-atlas-line/70 pl-3">
              <time
                dateTime={snapshot.lastUpdated}
                aria-label="Snapshot last updated"
                className="inline-block max-w-[10.5rem] truncate text-right font-mono text-[11px] tabular-nums"
              >
                {new Date(snapshot.lastUpdated).toLocaleString()}
              </time>
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-heading text-[clamp(1.5rem,2.5vw,1.9rem)] leading-[1.1] font-semibold tracking-tight text-balance text-atlas-main">
          HTTP DDoS routes
        </h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <fieldset className="min-w-0">
            <legend className="sr-only">Window</legend>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Last 24 hours"
                aria-pressed={range === "1d"}
                onClick={() => onRangeChange("1d")}
                className={`dashboard-control min-h-11 min-w-11 border-b-2 px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none ${range === "1d" ? "border-atlas-route text-atlas-main" : "border-transparent text-atlas-secondary"}`}
              >
                24h
              </button>
              <button
                type="button"
                aria-label="Last 7 days"
                aria-pressed={range === "7d"}
                onClick={() => onRangeChange("7d")}
                className={`dashboard-control min-h-11 min-w-11 border-b-2 px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none ${range === "7d" ? "border-atlas-route text-atlas-main" : "border-transparent text-atlas-secondary"}`}
              >
                7d
              </button>
            </div>
          </fieldset>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh Radar snapshot"
            className="dashboard-control inline-flex min-h-11 items-center justify-center gap-2 px-1 text-xs text-atlas-secondary focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Refresh
          </button>
        </div>
      </div>
    </header>
  )
}
