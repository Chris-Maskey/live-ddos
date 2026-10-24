# DDoS Atlas tasks

Status: Completed on 2026-10-21 with the verification limits recorded below. See [plan.md](plan.md) and [SPEC.md](../SPEC.md).
Check off a task only after its acceptance criteria and verification pass.
Record failures and blocked checks under that task; do not mark them passed.

## Task 1: Verify production startup and live snapshots

Build and run the existing application. Check the highest-risk external path
before changing behavior.

Acceptance criteria:

- [x] The production build succeeds and `/` loads through `pnpm start`.
- [x] Authenticated requests for `1d` and `7d` return valid snapshots with
  correct range, timestamps, percentages, and resolved country coordinates.
- [x] Record provider or environment failures without exposing credentials;
  distinguish blocked live checks from successful local verification.

Verification:

- [x] Run `pnpm build`, then `pnpm start`.
- [x] Request `curl -sS -i 'http://localhost:3000/api/attacks?range=1d'` and the
  equivalent `range=7d`; inspect their bodies with `isAttackSnapshot`.
- [x] Open `/` in a real browser; confirm data reaches both list and globe.

Dependencies: None. Live checks require a configured server token.

Files likely touched: `tasks/todo.md` for results. No source change planned.
Estimated scope: Small, one file.

Results: Production build and startup passed. Both live ranges returned HTTP
200, 40 validated routes, and 40 mapped routes. Repeated requests reused their
pair fetch timestamps. The production browser loaded the real list and globe.

## Task 2: Cover data-boundary edge cases

Extend the existing Node tests where the spec's validation rules lack coverage.
Keep the current normalizer and validator unless a test exposes a defect.

Acceptance criteria:

- [x] Cover empty results, all-invalid pair rows, and the 40-route limit for
  normalization and browser validation.
- [x] Cover percentage bounds, invalid coordinates, and zero or reversed time
  windows; valid routes with missing coordinates remain available.
- [x] Each new case asserts specified behavior. Any necessary correction has
  a regression test that fails before the fix.

Verification:

- [x] Run `pnpm test:data`.
- [x] If TypeScript changes, run `pnpm typecheck` and `pnpm lint`.

Dependencies: None.

Files likely touched: `lib/attack-data.test.mjs`, `lib/attack-data.ts` only if
needed, and `tasks/todo.md`.
Estimated scope: Medium, up to three files.

Results: All 15 data tests pass. A new regression first failed because an empty
latitude became zero. Blank coordinate strings are now discarded while valid
routes remain unmapped. Type checking and lint passed. An inverted validation
condition in a temporary copy was caught by the suite; repository code was
not modified for that mutation check.

## Checkpoint: Data path

- [x] Task 1 results distinguish live success, failure, and blocked checks.
- [x] Data tests pass and any changed source passes type checking and lint.
- [x] Review results before proceeding; keep independently verifiable work
  moving if provider access is blocked.

## Task 3: Verify API responses and cache behavior

Exercise the running API against the documented contract. Use controlled
failures in an isolated local process when needed; do not alter shared token
configuration or production data to force an error.

Acceptance criteria:

- [x] Omitted range uses `1d`; unsupported ranges return `400 INVALID_RANGE`.
  All API responses include `Cache-Control: no-store`.
- [x] Verify missing-token, permission, rate-limit, upstream, and malformed-data
  responses against the spec, including numeric `Retry-After` forwarding.
- [x] Confirm range-separated snapshot caching, two-code location batches,
  configured cache intervals, and ten-second request timeouts. Separate
  observed runtime behavior from configuration inspected in source.

Verification:

- [x] Run `curl -sS -i 'http://localhost:3000/api/attacks'` and
  `curl -sS -i 'http://localhost:3000/api/attacks?range=invalid'`.
- [x] Record response status, error code, and headers for controlled failures.
  Mark failure paths that cannot be exercised as unverified.
- [x] Compare repeated same-range and cross-range requests. Inspect server
  cache behavior across a revalidation interval; do not infer provider calls
  from matching response bodies alone.

Dependencies: Task 1 production startup; Task 2. Live cache checks require
provider access. Unverified required cases remain open.

Files likely touched: `tasks/todo.md`. If a defect is reproduced,
`app/api/attacks/route.ts`, `lib/cloudflare-radar.ts`, and one focused regression
check may also change. Decide the smallest runnable check before editing.
Estimated scope: Medium, up to four files.

Results: Default/invalid ranges, no-store headers, permission failures, rate
limits, upstream/network failures, malformed JSON/data, and recovery pass
controlled checks. Numeric Retry-After forwarding and rejection of a date
header were verified. A controlled request aborted at ten seconds and produced
502 UPSTREAM. These checks did not use or expose the real token.

The new `pnpm test:radar` check uses installed Next.js cache scopes and patched
fetch, controlled provider responses, and in-memory cache storage. It first
failed when switching ranges repeated a country lookup. Separate pair/location
cache scopes now pass reuse across ranges, five-minute pair refreshes, daily
location expiry, and API error recovery. Production cache files confirm two
300-second pair entries and 29 86400-second location entries. Before the fix,
only snapshot entries existed; their background refresh after five minutes was
also observed. See ADR 0002 for the cache correction.

## Task 4: Verify dashboard interactions and recovery

Exercise the full user flow in a real browser. Use controlled API responses
for deterministic failure and empty states when live data cannot provide them.

Acceptance criteria:

- [x] Both ranges, manual refresh, route selection, unmapped routes, and empty
  results work; the list and globe use the same selected snapshot.
- [x] Polling stops while hidden, resumes on visibility, backs off to at most
  30 minutes, and cancels requests on range change or unmount. Failed updates
  retain snapshots and expose the documented error state.
- [x] Keyboard controls, pause/resume, system reduced motion, narrow-screen
  layout, attribution, and globe fallback work without uncaught errors.

Verification:

- [x] Use the production app through `pnpm start` and inspect page state, network
  activity, and console errors with the collaborative browser tools.
- [x] Test success → refresh failure → recovery, rapid range changes, hidden
  → visible transitions, and keyboard route selection. Observe retry timing
  with a controlled clock where available; do not change production delays.
- [x] Test desktop and narrow layouts, reduced-motion settings, and a forced
  globe render failure. For any behavior fix, leave a runnable regression
  check and rerun the relevant scenario.

Dependencies: Task 3, except live-provider-only checks may remain blocked.
Do not change stale-list visibility or timestamp presentation without a
decision on the spec's open questions.

Files likely touched: `tasks/todo.md`; if required by reproduced defects,
`components/attack-dashboard.tsx`, `components/attack-globe.tsx`,
`components/ui/globe.tsx`, and one focused regression check.
Estimated scope: Medium, up to five files. Split unrelated fixes.

Results: Live range switching, keyboard route selection, and motion controls
passed. Controlled browser responses verified unmapped routes, empty results,
refresh failure followed by recovery, and aborting obsolete requests during
rapid 1d → 7d → 1d changes. The retained globe remained available on refresh
failure; list visibility was left as specified by the unresolved question.

Controlled poll delays were 5 minutes after success, then 10, 20, 30, and 30
minutes after failures, returning to 5 after recovery. A simulated hidden state
cleared the timer; visibility restoration issued one update. Reduced motion
disabled the motion toggle. Forced WebGL creation failure showed the fallback
with both route rows intact. A real 375-pixel browser frame rendered the globe
and list without horizontal overflow or uncaught errors.

Verification limits: T3 locks the native visibility property, so the temporary
proxy supplied a simulated visibility input and controlled long timers without
changing production source or delays. Range-change cleanup was exercised;
unmount uses that same cleanup and was checked in source. Native preview resize
and some screenshot calls failed; the narrow frame provided the mobile layout
check. A pre-existing R3F/Drei numeric-useFrame-priority deprecation warning
remains. Expected renderer error logs occurred only in the forced failure test.
No permanent browser-test dependency or test proxy was added to the repository.

## Checkpoint: User flow

- [x] API and dashboard results trace to the spec's acceptance criteria.
- [x] Reproduced defects are fixed and regression checks pass.
- [x] `pnpm test:data`, `pnpm test:radar`, `pnpm typecheck`, `pnpm lint`, and
  `pnpm build` pass.
- [x] Review remaining failures, blocked checks, and product decisions before
  closing the baseline.

## Task 5: Reconcile documentation and final evidence

Align the specification and operating instructions with verified behavior.
Keep unresolved choices explicit; do not turn them into approved requirements.

Acceptance criteria:

- [x] The spec, README, and recorded checks agree on commands, data meaning,
  cache behavior, and known limits.
- [x] Each acceptance criterion has test or runtime evidence, or an explicit
  unresolved result. The baseline remains incomplete if required checks fail
  or remain blocked.
- [x] Review the final diff for scope, secrets, unnecessary changes, and
  weakened checks. No deployment or commit is performed by this task.

Verification:

- [x] Check local document links and run `git diff --check`.
- [x] Confirm the latest full-check results from the preceding checkpoint;
  rerun affected checks only if source changes afterward.
- [x] Record the final result and outstanding decisions here for review.

Dependencies: Tasks 1–4. Documentation can record a blocked result, but cannot
declare the baseline complete without the required evidence.

Files likely touched: `SPEC.md`, `README.md`, `tasks/todo.md`.
Estimated scope: Medium, up to three files.

Results: Specification and README now describe the independent provider cache
scopes and both test commands. ADR 0002 records the cause, decision, sources,
and trade-off. Final document links, whitespace, source review, tests, type
checking, lint, and production build passed. No dependency was added, no secret
was written to source, and no commit or deployment was performed.

## Unresolved questions

- Retain the route list visibly during failed updates?
- Display the actual reporting window and fetch time?
- Primary audience and next product change?
