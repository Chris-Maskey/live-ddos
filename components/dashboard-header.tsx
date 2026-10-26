"use client"

import { StatusButton } from "@/components/ui/status-button"
import type { RadarRange } from "@/lib/attack-data"
import type { DashboardViewState } from "@/lib/dashboard-view-state"

type DashboardHeaderProps = {
  range: RadarRange
  view: DashboardViewState
  onRangeChange: (range: RadarRange) => void
  onRefresh: () => Promise<void>
}

const formatTimestamp = (timestamp: string) =>
  `${new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`

const formatWindow = (startTime: string, endTime: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })

  return `${formatter.format(new Date(startTime))}–${formatter.format(new Date(endTime))} UTC`
}

export function DashboardHeader({
  range,
  view,
  onRangeChange,
  onRefresh,
}: DashboardHeaderProps) {
  const report =
    view.kind === "ready" || view.kind === "empty" || view.kind === "stale"
      ? view.report
      : undefined
  const snapshot = report?.current
  const isFetching = view.isFetching
  const statusLabel = snapshot
    ? view.kind === "stale" && !isFetching
      ? `Delayed · retrieved ${formatTimestamp(snapshot.fetchedAt)}`
      : `Retrieved ${formatTimestamp(snapshot.fetchedAt)}`
    : view.kind === "unavailable"
      ? isFetching
        ? "Checking Radar"
        : "Radar unavailable"
      : isFetching
        ? "Loading Radar report"
        : "Waiting for Radar"
  const statusColor =
    view.kind === "stale" && !isFetching
      ? "bg-atlas-warning"
      : view.kind === "unavailable" && !isFetching
        ? "bg-atlas-danger"
        : "bg-atlas-route"

  return (
    <header className="mb-4 border-b border-atlas-line/70 pb-4 sm:mb-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-atlas-main">
          DDoS Atlas
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-atlas-secondary">
          <p
            role="status"
            aria-live="polite"
            className="inline-flex min-h-5 items-center gap-2 text-[11px] tabular-nums"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${statusColor}`}
            />
            {statusLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h1 className="font-heading text-balance text-atlas-main">
            HTTP DDoS routes
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-atlas-secondary">
            Share of all reported Layer 7 DDoS requests by country pair.
          </p>
          {snapshot ? (
            <p className="mt-1 font-mono text-[11px] leading-normal text-atlas-secondary">
              <span className="font-sans">Window · </span>
              {formatWindow(snapshot.window.startTime, snapshot.window.endTime)}
            </p>
          ) : view.kind === "loading" ? (
            <p className="mt-1 font-mono text-[11px] leading-normal text-atlas-secondary">
              <span className="font-sans">Window · </span>
              {range === "1d" ? "Last 24 hours" : "Last 7 days"} · Loading
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <fieldset className="min-w-0 rounded-xl border border-atlas-line bg-atlas-panel p-1">
            <legend className="sr-only">Window</legend>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Last 24 hours"
                aria-pressed={range === "1d"}
                onClick={() => onRangeChange("1d")}
                className={`dashboard-control min-h-10 min-w-11 px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none ${range === "1d" ? "text-atlas-water" : "text-atlas-secondary"}`}
              >
                24 hours
              </button>
              <button
                type="button"
                aria-label="Last 7 days"
                aria-pressed={range === "7d"}
                onClick={() => onRangeChange("7d")}
                className={`dashboard-control min-h-10 min-w-11 px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none ${range === "7d" ? "text-atlas-water" : "text-atlas-secondary"}`}
              >
                7 days
              </button>
            </div>
          </fieldset>
          <StatusButton
            onClick={onRefresh}
            ariaLabel="Refresh Radar report"
            className="dashboard-control inline-flex min-h-11 items-center justify-center gap-2 px-1 text-xs text-atlas-secondary focus-visible:ring-2 focus-visible:ring-atlas-route focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-water focus-visible:outline-none"
          />
        </div>
      </div>
    </header>
  )
}
