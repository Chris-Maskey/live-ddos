import type { AttackReport } from "@/lib/attack-data"

export type DashboardViewState =
  | { kind: "loading"; isFetching: boolean }
  | { kind: "unavailable"; error: string; isFetching: boolean }
  | { kind: "empty"; report: AttackReport; isFetching: boolean }
  | { kind: "ready"; report: AttackReport; isFetching: boolean }
  | {
      kind: "stale"
      report: AttackReport
      error: string
      isFetching: boolean
    }

type DashboardViewInput = {
  report: AttackReport | undefined
  error: string | undefined
  isFetching: boolean
}

export function getDashboardViewState({
  report,
  error,
  isFetching,
}: DashboardViewInput): DashboardViewState {
  if (error) {
    return report
      ? { kind: "stale", report, error, isFetching }
      : { kind: "unavailable", error, isFetching }
  }

  if (!report) return { kind: "loading", isFetching }
  if (report.current.routes.length === 0)
    return { kind: "empty", report, isFetching }
  return { kind: "ready", report, isFetching }
}
