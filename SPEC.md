# DDoS Atlas specification

Status: Baseline approved for implementation on 2026-10-21.

Scope: Current dashboard baseline. New features need separate agreement.

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
- Treat each route as an aggregate country pair during the reporting window.
  Arc motion is a display effect, not an individual attack event.
- Origin countries describe client IP geolocation. Target countries describe
  the attacked zone's billing country. Coordinates are approximate.
- Distinguish the dataset update time from the application's fetch time.
  Do not claim an upstream freshness guarantee.
- Attribute Cloudflare Radar and link to its CC BY-NC 4.0 data license, as
  recorded in the existing [research](docs/research/cloudflare-radar.md).

Out of scope: raw attack events, exact hosts or IP addresses, request counts,
bandwidth, attack duration, network-layer modes, user accounts, saved history,
and additional providers.

## User behavior

1. Opening `/` loads the default snapshot and a country globe.
2. Selecting a reporting window loads that range and preserves snapshots by
   range in browser memory.
3. The ranked list shows each route's origin, target, and normalized percentage.
   Routes without coordinates remain in the list and have no globe arc.
4. Selecting a list entry highlights the corresponding arc when mapped and
   displays the route's details.
5. Refresh requests a snapshot through the normal server cache. It does not
   force a new Cloudflare fetch.
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

`GET /api/attacks?range=1d|7d` returns an `AttackSnapshot`. Omitting `range`
uses `1d`. The contract lives in [lib/attack-data.ts](lib/attack-data.ts):

- `range`: requested reporting range.
- `window`: actual `startTime` and `endTime` returned by Radar.
- `lastUpdated`: Radar's dataset update timestamp.
- `fetchedAt`: application's pair-response fetch timestamp, retained with the
  cached pair response.
- `normalization`: always `PERCENTAGE`.
- `units`: unique unit strings extracted from Radar metadata.
- `routes`: at most 40 entries with a snapshot-local ID, origin and target
  country details, percentage, and `sameCountry` flag. Country coordinates
  may be `null`. Route IDs are not persistent event identifiers.

Validate external JSON before use. Require valid timestamps, a positive time
window, uppercase two-letter country codes, finite percentages from 0 to 100,
and coordinates within geographic bounds. Drop malformed pair rows; reject a
nonempty response if no valid pair remains. Preserve valid routes when
coordinate rows are missing or invalid. Validate the snapshot again in the
browser.

Keep `CLOUDFLARE_API_TOKEN` on the server. Cloudflare requests have a ten-second
timeout. Assemble snapshots from validated pair responses cached by range with
a five-minute revalidation interval and location responses cached for one day.
Use independent cache scopes, as recorded in [ADR 0002](docs/adr/0002-independent-radar-caches.md).
Request unique country codes in batches of at most two. A failed location
request fails that snapshot load. Next.js can serve cached data while refreshing
it in the background; a successful app request does not guarantee new data.

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

- Both ranges return a validated snapshot or the documented error response.
- Percentages and timestamps survive normalization without invented values.
  Invalid rows and coordinates follow the rules above.
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

Baseline checked on 2026-10-21: 15 data tests, the Radar cache/API check, type
checking, lint, and the production build passed. Both authenticated reporting
ranges returned valid snapshots. Browser verification covered selection,
refresh recovery, cancellation, retry timing, reduced motion, narrow layout,
and globe fallback. Details and limitations are recorded in the task list.
There is no permanent automated browser suite or CI workflow.

## Open questions and known gaps

- Should the retained route list stay visible when an update fails? Currently
  the error message replaces the list while the globe retains its snapshot.
- Should the UI display the actual reporting window and fetch time? The API
  preserves both, but the page currently displays the dataset update time.
- Who is the primary audience, and what is the next product change? This
  draft establishes the baseline only.
