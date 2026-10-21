# Live DDoS map plan

Status: Approved for execution on 2026-10-21. See the task list for results.

## Objective

Verify the existing dashboard against [SPEC.md](../SPEC.md), add focused data
checks, and correct only reproduced failures of agreed requirements. Most
features already exist. Do not rebuild them or introduce new product features.

## Assumptions

- The request to plan authorizes using the spec as the planning baseline.
  Its open product questions remain unresolved.
- Keep the current stack, API contract, provider, cache lifetimes, and WebGL renderer.
- Use installed tools and Node's test runner. No new dependencies are planned.
- No deployment, commits, or external tracker changes are included.

## Dependencies and order

The runtime path is Radar response → validated snapshot → cached API response
→ dashboard state → list and globe. Verify the production/provider path early
because token permissions, response shape, and rendering are the main unknowns.

Task 1 → Task 3 → Task 4 → Task 5. Task 2 → Task 3.
Tasks 1 and 2 are independent; execute sequentially for this small project.
Missing live-provider access blocks that evidence only, not local checks.

## Task index

The authoritative checklist is [todo.md](todo.md).

1. Verify production startup and live snapshots.
2. Cover data-boundary edge cases.
3. Verify API responses and cache behavior.
4. Verify dashboard interactions and recovery.
5. Reconcile documentation and final evidence.

Review checkpoints follow Tasks 1–2 and Tasks 3–4. Task 5 closes the baseline
only when required evidence is available. Existing code is complete only where
verified; unchecked tasks must not be treated as completed implementation.

## Working rules

- Start with verification. If existing behavior passes, leave it alone.
- For a reproduced defect, inspect its callers, add a failing runnable check,
  fix the shared cause, and rerun the relevant checks.
- Keep each task within five files. Split a larger fix before proceeding.
- Record commands, results, and remaining limits in the matching task.
- Run focused checks per task; run the full suite at checkpoints or after a
  change that affects the build. Do not repeat unchanged checks without cause.
- Preserve the accepted [data-source ADR](../docs/adr/0001-cloudflare-radar-aggregates.md).
  The verified cache defect and its correction are recorded in
  [ADR 0002](../docs/adr/0002-independent-radar-caches.md).

## Risks and limits

- Provider access: verify both ranges and location lookups using server-side
  configuration. Never print tokens. Record unavailable checks as blocked.
- Caching: distinguish browser polling, API responses, server revalidation,
  and upstream dataset updates. A successful fetch need not mean newer data.
- WebGL: verify in a real browser and exercise the fallback. Keep the legacy
  canvas unless a reproduced requirement failure requires changing it.
- Scope: automated API/browser suites and CI do not exist. Use runtime checks
  for unchanged paths; add durable regression checks for behavior fixes.

## Unresolved questions

- Should a retained route list stay visible after an update failure? Preserve
  current behavior until decided.
- Should the page show the actual data window and application fetch time?
  Preserve the current timestamp display until decided.
- Who is the primary audience, and what product change follows this baseline?
  No audience-specific feature or redesign is included.
