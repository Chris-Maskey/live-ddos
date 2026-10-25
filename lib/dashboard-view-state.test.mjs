import assert from "node:assert/strict"
import test from "node:test"
import { getDashboardViewState } from "./dashboard-view-state.ts"

const report = {
  current: {
    range: "1d",
    window: {
      startTime: "2026-10-20T00:00:00Z",
      endTime: "2026-10-21T00:00:00Z",
    },
    lastUpdated: "2026-10-21T00:00:00Z",
    fetchedAt: "2026-10-21T00:05:00Z",
    normalization: "PERCENTAGE",
    units: ["requests"],
    routes: [
      {
        id: "US-FR",
        origin: {
          code: "US",
          name: "United States",
          latitude: 38,
          longitude: -97,
        },
        target: { code: "FR", name: "France", latitude: 46, longitude: 2 },
        percent: 12.34,
        sameCountry: false,
      },
    ],
  },
  comparison: {
    window: {
      startTime: "2026-10-13T00:00:00Z",
      endTime: "2026-10-14T00:00:00Z",
    },
    shares: [{ originCode: "US", targetCode: "FR", percent: 10 }],
  },
}

test("shows a checking state before the first snapshot arrives", () => {
  assert.deepEqual(
    getDashboardViewState({
      report: undefined,
      error: undefined,
      isFetching: true,
    }),
    { kind: "loading", isFetching: true }
  )
})

test("shows an unavailable state when the first snapshot request fails", () => {
  assert.deepEqual(
    getDashboardViewState({
      report: undefined,
      error: "Radar is unavailable.",
      isFetching: false,
    }),
    { kind: "unavailable", error: "Radar is unavailable.", isFetching: false }
  )
})

test("distinguishes an empty snapshot from a missing snapshot", () => {
  const emptyReport = { ...report, current: { ...report.current, routes: [] } }
  const state = getDashboardViewState({
    report: emptyReport,
    error: undefined,
    isFetching: false,
  })

  assert.equal(state.kind, "empty")
  assert.strictEqual(state.report, emptyReport)
})

test("keeps the last route list available while a refresh error is shown", () => {
  const state = getDashboardViewState({
    report,
    error: "Radar could not be reached.",
    isFetching: false,
  })

  assert.equal(state.kind, "stale")
  assert.strictEqual(state.report, report)
  assert.equal(state.report.current.routes[0].id, "US-FR")
  assert.equal(state.error, "Radar could not be reached.")
})

test("returns to the ready state after a successful refresh clears the error", () => {
  const refreshedReport = {
    ...report,
    current: { ...report.current, fetchedAt: "2026-10-21T00:10:00Z" },
  }
  const state = getDashboardViewState({
    report: refreshedReport,
    error: undefined,
    isFetching: false,
  })

  assert.equal(state.kind, "ready")
  assert.strictEqual(state.report, refreshedReport)
})
