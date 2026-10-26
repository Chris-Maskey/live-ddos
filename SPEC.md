# DDoS Atlas specification

Status: Updated for compact route and header layout on 2026-10-25.

Scope: Dashboard with equivalent-period route comparison and explicit data timestamps.

## Objective

Help users inspect recent country-level HTTP DDoS activity observed by Cloudflare.
Show a globe and ranked country pairs for a selected reporting window. Explain
what the data measures so users can interpret it correctly.

This draft uses the existing implementation, [terminology](CONTEXT.md), and
[accepted data-source decision](docs/adr/0001-cloudflare-radar-aggregates.md).
It does not establish a new audience, hosting platform, or commercial use case.

## Scope and data meaning

- Use Cloudflare Radar's layer-7 top attack-pair endpoint with
  `mitigationProduct=DDOS` and `normalization=PERCENTAGE`.
- Support `1d` and `7d`. Default to `1d`. Request at most 40 country pairs.
- Preserve Radar's percentages. The returned top pairs need not total 100%.
- Compare each current pair with the same origin and target codes in Radar's
  equivalent control period. A missing prior pair means it was not ranked in
  the previous top 40; its share is unknown, never zero.
- Show percentage-point change only when the exact pair exists in both
  periods. Do not describe share change as attack-volume change.
- Treat each route as an aggregate country pair during the reporting window.
  Arc motion is a display effect, not an individual attack event.
- Origin countries describe client IP geolocation. Target countries describe
  the attacked zone's billing country. Coordinates are approximate.
- Keep a visible map explanation that covers Cloudflare-observed scope, the
  top-40 limit, normalized shares that may total less than 100%, origin and
  target geography, approximate locations, and aggregate arcs.
- Show the actual current reporting window and Radar dataset update time in
  the header. Keep the app provider-fetch timestamp in the report data without
  giving it a separate UI label. Do not claim an upstream freshness guarantee.
- Attribute Cloudflare Radar and link to its CC BY-NC 4.0 data license, as
  recorded in the existing [research](docs/research/cloudflare-radar.md).

Out of scope: raw attack events, exact hosts or IP addresses, request counts,
bandwidth, attack duration, network-layer modes, user accounts, saved history,
and additional providers.

## User behavior

1. Opening `/` loads the default report and a country globe.
2. Selecting a reporting window loads that range and preserves reports by
   range in browser memory.
3. The ranked list shows each route's origin, target, normalized reported
   share, and percentage-point change when its exact prior pair is available.
   Routes without coordinates remain in the list and have no globe arc.
4. Selecting a list entry highlights its row and corresponding arc when
   mapped. Selection does not expand the row. A pair missing from the prior
   top 40 shows an unknown change, never zero.
5. The header shows the actual current window and Radar dataset update time to
   the minute. The app provider-fetch time stays in report data, not the UI.
   The header does not explain the app cache.
6. The browser checks every five minutes while visible. Returning to the page
   requests an update. Failed requests increase the retry delay to a maximum
   of 30 minutes. Range changes and unmounting cancel pending requests.
7. Loading, empty, unavailable, and delayed-update states have clear messages.
   A failed update retains the last successful snapshot for that range.
8. Users can pause arc motion and automatic globe rotation. The system's
   reduced-motion preference disables both. Manual globe rotation remains
   available; zoom and pan are disabled.
9. A globe rendering failure shows a fallback while leaving the dashboard's
   data interface available.

## Data contract and server behavior

`GET /api/attacks?range=1d|7d` returns an `AttackReport`. Omitting `range`
uses `1d`. The contract lives in [lib/attack-data.ts](lib/attack-data.ts):

- `current`: the existing `AttackSnapshot`, including current window, Radar
  `lastUpdated`, app `fetchedAt`, normalization, units, and up to 40 routes.
- `comparison`: the actual control-period window returned by Radar and up to
  40 `{ originCode, targetCode, percent }` shares. It has no route IDs,
  coordinates, or app fetch timestamp.

For `1d`, request Radar's `1dcontrol` period, which represents the same
weekday one week earlier. For `7d`, request `7dcontrol`, the prior 7-day
window. Use actual window metadata from both Radar responses. The browser
validates the complete envelope with `isAttackReport` and matches comparison
shares by origin and target country codes. A missing pair is not ranked in the
prior top 40 and has unknown share, never zero.

Validate external JSON before use. Require valid timestamps, a positive time
window, uppercase two-letter country codes, finite percentages from 0 to 100,
and coordinates within geographic bounds. Drop malformed pair rows; reject a
nonempty response if no valid pair remains. Preserve valid routes when
coordinate rows are missing or invalid. Validate the current snapshot and
complete report envelope again in the browser.

Keep `CLOUDFLARE_API_TOKEN` on the server. Cloudflare requests have a ten-second
timeout. Fetch current and control pair data in parallel through separate
five-minute cache entries. Validate the current pair response before caching
it with its provider-fetch timestamp. Normalize and cache the comparison as
only its actual window and route shares. Cache location responses for one day,
independent of pair data, as recorded in
[ADR 0002](docs/adr/0002-independent-radar-caches.md) and
[ADR 0003](docs/adr/0003-radar-control-period-comparisons.md). Request unique
country codes for current routes only, in batches of at most two. A failed
control or location request fails that report load. Next.js can serve cached
data while refreshing it in the background; a successful app request does not
guarantee a new Radar fetch.

API responses use `Cache-Control: no-store`. Expected errors have the shape
`{ error: { code, message } }`:

- `400 INVALID_RANGE` for an unsupported range.
- `429 RATE_LIMITED` for an upstream rate limit, forwarding a numeric
  `Retry-After` value when accepted by the server.
- `502 UPSTREAM` for a failed upstream request.
- `503 MISSING_TOKEN`, `UNAUTHORIZED`, or `INVALID_DATA` for configuration,
  permission, or response-format failures.

The browser currently uses its own retry delay and does not read `Retry-After`.

## Technical structure

Use the existing Next.js 16 App Router, React 19, strict TypeScript, Tailwind
CSS 4, and pnpm stack. Three.js, React Three Fiber, Drei, and three-globe render
the map. The legacy WebGL canvas supports the globe's GLSL layers. There is no
database or separate backend service.

- `app/page.tsx` and `app/layout.tsx`: page entry and theme wrapper.
- `app/api/attacks/route.ts`: range validation and HTTP response handling.
- `components/attack-dashboard.tsx`: client state, polling, controls, and list.
- `components/attack-globe.tsx`: browser-only loading and render fallback.
- `components/ui/globe.tsx`: scene, country polygons, points, arcs, and controls.
- `data/globe.json`: country polygon geometry, separate from Radar coordinates.
- `lib/cloudflare-radar.ts`: authenticated requests and caching.
- `lib/attack-data.ts`: shared types, validation, and normalization.
- `lib/attack-data.test.mjs`: data-boundary tests.
- `lib/cloudflare-radar.test.mjs`: provider caching and API error checks.
- `docs/adr/` and `docs/research/`: decisions and provider findings.

## Commands

Use Node.js 22.6 or later and pnpm 10. Set `CLOUDFLARE_API_TOKEN` in
`.env.local` for authenticated data access.

```sh
pnpm install
pnpm dev
pnpm test:data
pnpm test:radar
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

`pnpm start` runs the production build. `pnpm build` explicitly uses webpack.
Use `pnpm exec tsc --noEmit --incremental false` to check types without writing
incremental build state.

## Code style and boundaries

Use inferred TypeScript types where possible. Treat external data as `unknown`
and narrow it before use. Keep provider access server-only and share the data
contract between the API and browser. For example, the existing code validates
an upstream success envelope before reading its contents:

```ts
if (!isRecord(payload) || payload.success !== true || !isRecord(payload.result)) {
  throw new InvalidRadarDataError("Radar returned an invalid attack response.");
}
```

Use PascalCase for components and types, camelCase for functions and values,
and the repository's Prettier configuration for formatting touched code.

- Always validate inputs, preserve data meaning, keep changes focused, and run
  relevant checks. Use labeled controls, keyboard focus indicators, and
  accessible status and error messages.
- Ask before expanding scope, adding dependencies, changing data meaning, or
  deleting existing work.
- Never expose or commit secrets, invent attack metrics, edit generated or
  dependency files as source, or weaken checks to make a change pass.

## Acceptance and verification

- Both ranges return a validated report with current and equivalent control
  data or the documented error response.
- Percentages and timestamps survive normalization without invented values.
  Invalid rows and coordinates follow the rules above.
- Deltas match exact country-code pairs and are expressed in percentage points.
  Missing prior top-40 pairs retain unknown share rather than zero.
- The header shows report status, the actual current window, and Radar dataset
  update time to the minute. It omits the app provider-fetch timestamp and
  cache explanation.
- The route ledger names the comparison period. Selecting a route highlights
  its row and mapped arc without expanding the row.
- The list and globe use the same selected snapshot. Selecting a mapped route
  highlights its arc. Missing coordinates do not remove a valid list entry.
- Polling respects page visibility and retry limits. Failed updates preserve
  the last valid snapshot and expose an error state.
- Motion controls and system reduced-motion preferences work. The page remains
  usable with a keyboard and when the globe cannot render.
- Data attribution and aggregate-data explanations remain visible.
- Data tests, type checking, lint, and production build pass before release.

Use Node's built-in test runner for pure normalization and validation logic.
Add a runnable regression check for nontrivial behavior changes. Verify API
errors, polling, range changes, selection, reduced motion, and globe fallback
at runtime when those paths change. No numeric coverage target is established.

Previous baseline checks on 2026-10-21 passed: 15 data tests, the Radar cache
and API check, type checking, lint, and the production build. Both authenticated
reporting ranges returned valid snapshots. Browser verification covered selection,
refresh recovery, cancellation, retry timing, reduced motion, narrow layout,
and globe fallback. Details and limitations are recorded in the task list.
There is no permanent automated browser suite or CI workflow.

## Open questions and known gaps

- Who is the primary audience, and what is the next product change? This
  remains open.
