# UI refresh implementation plan

Status: Complete. Based on the approved [UI spec](../docs/ui-refresh-spec.md).

## Overview

Restyle the existing dashboard as a dark field atlas. Keep Radar data and controls, make the globe the focal point, clarify the route ledger, and preserve the last good list during refresh errors.

Implementation status: Tasks 1–3 complete.

## Design and technical decisions

- Use the six approved color tokens and system font fallbacks. Add no dependencies or remote assets.
- Keep data fetching and polling in `AttackDashboard`. Extract the header and route ledger so the page composition stays focused.
- Keep layout responsive and map controls beside the globe. The selected route uses amber in both the ledger and arc.
- Add a small pure view-state helper for loading, empty, error, ready, and stale states so Node's built-in test runner can cover stale-list behavior without a UI test dependency.
- Use browser examples for hierarchy, not branding: Cloudflare's measure labels, NETSCOUT's separation of map and details, and Kaspersky's nearby map controls. Do not add their filters, categories, or event counts.

## Dependency order

Task 1 → Task 2 → Task 3. Task 3 depends on the route-ledger composition from Task 2. The detailed checklist is in [ui-refresh-todo.md](ui-refresh-todo.md).

## Checkpoints

- After Tasks 1–2: typecheck, lint, production build, and review map, route selection, keyboard focus, and layouts at 320, 768, 1024, and 1440 px.
- After Task 3: run the full test and build checks, then verify loading, empty, stale, recovered, reduced-motion, and globe-fallback states in a browser.

## Risks and mitigations

| Risk                                                              | Mitigation                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Globe colors can lose contrast against the new sea-glass palette. | Check route, selected, country, and focus colors at browser size; keep a text label for each status.             |
| System serif fonts vary by operating system.                      | Use Iowan Old Style, Baskerville, and Georgia fallbacks; inspect the rendered title on the available browser.    |
| Responsive canvas layout can overflow at narrow widths.           | Check 320 px and 375 px pages, plus the agreed wider breakpoints.                                                |
| Mobbin MCP requires a paid plan.                                  | Use the three public references recorded in the approved spec; do not block the implementation on Mobbin access. |

## Unresolved questions

- None. The approved spec sets the visual direction and behavior.
