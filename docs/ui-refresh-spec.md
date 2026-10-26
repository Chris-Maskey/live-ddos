# Dashboard UI refresh spec

Status: Updated for compact report context and steady route rows on 2026-10-25.

Related documents: [product specification](../SPEC.md), [data terminology](../CONTEXT.md), [cache decision](adr/0002-independent-radar-caches.md), and [control-period decision](adr/0003-radar-control-period-comparisons.md).

## Objective

Make the dashboard easier to read at a glance. A visitor should see the selected reporting window, data freshness, the country-pair map, and the leading routes without mistaking aggregate Radar data for a live stream of individual attacks.

Primary user: a visitor checking recent HTTP DDoS activity across country pairs reported by Cloudflare Radar.

## Assumptions

- Put the globe before the route ledger, with a wider map column on desktop and a taller globe on mobile. Keep route selection, reporting windows, refresh behavior, motion controls, attribution, and globe fallback.
- Compare current route shares with the equivalent Radar control period. Use percentage-point changes only when both top-40 responses contain the same country-code pair.
- Show the actual current window and Radar dataset update time in compact form. Keep the app provider-fetch timestamp in report data without surfacing it as a separate UI detail. Use a short ledger label to explain the comparison period; omit the cache explanation.
- Keep the dark map-focused presentation. Give it a more distinctive cartographic identity.
- Keep this work on the existing dashboard. Add no navigation or unrelated controls.
- During a failed refresh, keep the last successful route list visible and show a clear delayed-update notice.

## Design direction

Treat the page as a field atlas for aggregate network routes: quiet typography and layout around a large globe, with route details presented as a compact ledger. Use a restrained sea-glass color for mapped routes and reserve amber for the selected route and delayed or warning states. Use a serif only for the page title, paired with a plain sans-serif interface and monospaced data labels. This gives the map a geographic character without making the controls feel ornamental.

Color tokens:

| Role                       | Value     |
| -------------------------- | --------- |
| Deep water background      | `#061619` |
| Map and panel surface      | `#0D2225` |
| Main text                  | `#E4ECE7` |
| Secondary text             | `#91A7A3` |
| Mapped routes              | `#64CDBF` |
| Selected route and warning | `#EFB86C` |

Typography roles:

- Page title: `Iowan Old Style, Baskerville, Georgia, serif`, used for the main heading only.
- Interface: `system-ui, sans-serif` for controls, route names, and explanatory text.
- Data: `SFMono-Regular, Consolas, monospace` for percentages, timestamps, and compact labels.
- Load system fonts only. Do not add a font package or remote font request.

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ HTTP DDoS routes                [24 hours] [7 days] [Refresh]         │
│ Report status · Window · Radar updated                                │
├────────────────────────────────────────────────┬─────────────────────┤
│                                                │ Top routes          │
│                                                │ Share · change vs…  │
│                  Interactive globe             │ 01  Origin → Target │
│                                                │ 12.34% · +0.18 pp   │
│                                                │ 02  Origin → Target │
│ Map meaning · motion control                   │  8.21% · unknown    │
├────────────────────────────────────────────────┴─────────────────────┤
│ Aggregate-data explanation                           Radar · license │
└──────────────────────────────────────────────────────────────────────┘
```

At narrow widths, place the title and reporting-window controls first, then the globe, then the route ledger. Keep map controls close to the map. Keep the route list scrollable within its ledger on desktop and mobile. Do not force a desktop-width table or horizontal page scrolling.

## Requirements

1. Put the page title, reporting-window control, refresh action, report status, actual current reporting window, and Radar dataset update time in a compact header. Show timestamps to the minute. Keep the 24-hour and 7-day choices visible as a two-option control. Do not show the app-cached provider-fetch timestamp or cache explanation. Label route changes against the same weekday one week earlier for 24h and the prior 7 days for 7d.
2. Make the globe the largest visual element. Keep the country-pair ledger beside it on desktop and below it on mobile.
3. Show each route's rank, origin, target, current normalized reported share, and change in percentage points when the exact pair is present in both periods. Show an unknown previous share when it was not ranked in the previous top 40. Keep unmapped routes in the ledger and mark missing coordinates without inventing a map position.
4. Selecting a route highlights its row and matching arc. Keep the row the same height and do not insert a detail panel. Keep unknown prior shares explicit in the row and its accessible name.
5. Place the motion control beside the globe. Respect reduced-motion preferences and keep manual globe rotation available.
6. Use status copy that describes the report accurately. Do not call the feed live. Show checking, loaded, delayed, waiting, and unavailable states with clear text and a restrained status mark.
7. On a failed refresh, keep the last successful routes and globe visible. Add an inline delayed-update notice with the error message. Clear the notice after a successful refresh.
8. Keep useful initial-loading, empty-data, and globe-fallback states. The route ledger must remain usable if WebGL fails.
9. Keep the explanation of aggregate routes, Cloudflare Radar attribution, and the CC BY-NC 4.0 license visible without competing with the map.
   Explain that Radar reports up to 40 normalized pairs from observed traffic,
   that listed shares may total less than 100%, and how origin and target
   countries are assigned. Label locations approximate and arcs aggregate.
10. Use visible keyboard focus and native or equivalently accessible controls. Meet WCAG 2.2 AA contrast, including 4.5:1 for normal text and 3:1 for large text and meaningful control boundaries. Hover styling must not be the only selected-state cue.

## Data and behavior boundaries

- `GET /api/attacks?range=1d|7d` returns an `AttackReport`: `current` is the existing snapshot and `comparison` contains only Radar's actual control window and up to 40 country-code shares. The browser validates the full envelope.
- Request `1dcontrol` for `1d` and `7dcontrol` for `7d` in parallel with current data through separate five-minute pair cache entries. Request coordinates for current routes only; keep the one-day location cache independent.
- Match rows by origin and target country codes. A pair missing from the prior top 40 has unknown share, never zero. Show changes in percentage points.
- Show the actual current window and Radar dataset update time. Keep app fetch and cache behavior in the report/server contract, not in the visible header.
- A route is an aggregate country pair over a reporting window. Arc motion is decorative and does not represent individual attacks.
- Do not add counts, severity scores, live-event claims, graphs, filters, export actions, accounts, or another data provider.
- Keep the current Next.js, React, Tailwind, and Three.js stack. Do not add dependencies for this refresh.
- Keep the cartographic design and globe hierarchy. Route selection highlights the row and globe arc without expanding the row.

## Acceptance criteria

- At a desktop viewport, the globe reads as the main focus and the route ledger remains legible beside it.
- At a 320 px viewport and at 375 px, controls and content fit without horizontal page scrolling; the globe and route ledger remain usable.
- The selected range, actual current window, Radar dataset update, and report status are easy to find and do not imply real-time delivery. Timestamps omit seconds.
- The route ledger identifies the comparison period for each selected range without repeating full comparison dates.
- Each route shows its current share and a percentage-point change when the exact pair exists in the prior top 40. A missing pair is clearly unknown, not zero.
- Selecting a route highlights its ledger row and mapped arc without expanding the row. Unmapped routes remain selectable in the ledger.
- A failed refresh retains the previous list and map, shows an error notice, and returns to the normal state after a successful refresh.
- Initial loading, empty results, reduced motion, keyboard navigation, and globe failure remain understandable and usable.
- Aggregate-data copy and Cloudflare attribution remain visible.
- `pnpm test:data`, `pnpm test:radar`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass. Review 320 px, 768 px, 1024 px, and 1440 px layouts in a browser after implementation.

## Browser references

- [Cloudflare Radar](https://radar.cloudflare.com/) keeps date-range selection near its views and labels metrics with their measure, such as traffic share by bytes or HTTP requests. Keep this dashboard's reporting window and normalized-share explanation easy to find.
- [NETSCOUT Cyber Threat Horizon](https://horizon.netscout.com/) separates the attack map from attack statistics and names filter groups for sources, destinations, and event types. Keep our map and route details distinct, but skip its filter panel because this product has no corresponding filters.
- [Kaspersky Cyberthreat Live Map](https://cybermap.kaspersky.com/) puts globe controls beside the map and shows a most-attacked-country summary with named detection categories. Keep controls close to the globe and route details close to the route list. Do not add detection counts or extra map modes because this app only has normalized country-pair shares and two reporting windows.

These references inform hierarchy and control placement. The field-atlas palette and typography remain specific to this dashboard; the spec does not copy another product's branding or exact layout.

## Research limit

The requested Mobbin MCP searches for cybersecurity and analytics dashboards returned a paid-plan requirement. Mobbin's public page says MCP access is available on Pro and Team plans. No Mobbin screens were available to inspect. [Mobbin](https://mobbin.com/)
