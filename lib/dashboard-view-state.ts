import type { AttackSnapshot } from "@/lib/attack-data"

export type DashboardViewState =
  | { kind: "loading"; isFetching: boolean }
  | { kind: "unavailable"; error: string; isFetching: boolean }
  | { kind: "empty"; snapshot: AttackSnapshot; isFetching: boolean }
  | { kind: "ready"; snapshot: AttackSnapshot; isFetching: boolean }
  | {
      kind: "stale"
      snapshot: AttackSnapshot
      error: string
      isFetching: boolean
    }

type DashboardViewInput = {
  snapshot: AttackSnapshot | undefined
  error: string | undefined
  isFetching: boolean
}

export function getDashboardViewState({
  snapshot,
  error,
  isFetching,
}: DashboardViewInput): DashboardViewState {
  if (error) {
    return snapshot
      ? { kind: "stale", snapshot, error, isFetching }
      : { kind: "unavailable", error, isFetching }
  }

  if (!snapshot) return { kind: "loading", isFetching }
  if (snapshot.routes.length === 0)
    return { kind: "empty", snapshot, isFetching }
  return { kind: "ready", snapshot, isFetching }
}
