# UI refresh task list

Status: Complete.

Spec: [Dashboard UI refresh](../docs/ui-refresh-spec.md). Plan: [UI refresh implementation plan](ui-refresh-plan.md).

## Task 1: Establish the field-atlas visual tokens — Complete

**Description:** Add the approved dashboard colors and apply them to the page foundation and globe. Keep motion and globe interaction behavior intact.

**Acceptance criteria:**

- [x] Changed page and globe surfaces use the approved six-token palette.
- [x] Mapped arcs use sea-glass; selected routes and warning states use amber with text labels.
- [x] The globe fallback, manual rotation, and reduced-motion behavior still work.

**Verification:**

- [x] Run `pnpm typecheck` and `pnpm lint`.
- [x] Inspect the rendered map and selected route in a browser.

**Dependencies:** None.

**Files likely touched:**

- `app/globals.css`
- `components/attack-dashboard.tsx`
- `components/attack-globe.tsx`
- `components/ui/globe.tsx`

**Estimated scope:** Medium, four files.

## Task 2: Rebuild the dashboard shell and route ledger — Complete

**Description:** Split the large dashboard view into a compact header and a focused route ledger. Arrange the globe and ledger for desktop and stack them for mobile. Preserve the existing data and control behavior.

**Acceptance criteria:**

- [x] Header keeps the title, Radar source, range selection, refresh action, and data timestamp easy to scan.
- [x] Globe is the main desktop region; the route ledger sits beside it and moves below it on narrow screens.
- [x] Route rank, origin, target, percentage, unmapped state, selected details, and attribution remain clear.
- [x] Keyboard order and visible focus follow the visual order.

**Verification:**

- [x] Run `pnpm typecheck` and `pnpm lint`.
- [x] Check both ranges and route selection at 320, 375, 768, 1024, and 1440 px.
- [x] Run `pnpm build` at the checkpoint after this task.

**Dependencies:** Task 1.

**Files likely touched:**

- `components/attack-dashboard.tsx`
- `components/dashboard-header.tsx`
- `components/route-ledger.tsx`

**Estimated scope:** Medium, three files.

## Checkpoint: Visual shell

- [x] Typecheck, lint, and production build pass.
- [x] Both ranges, route selection, keyboard focus, and agreed viewport widths work.
- [x] Review the visual result before changing refresh-error presentation.

## Task 3: Preserve and label stale route data — Complete

**Description:** Keep the last successful route list visible when a later refresh fails. Show the update error beside the retained data, clear it on recovery, and cover each route-ledger display state with a small pure helper test.

**Acceptance criteria:**

- [x] With cached data and a refresh error, the route list and globe remain visible with a delayed-update notice.
- [x] With no cached data, loading and unavailable states remain clear; empty data has its own message.
- [x] A successful refresh clears the error and displays the new snapshot.
- [x] Unit checks cover loading, unavailable, empty, ready, and stale view states without adding a test dependency.

**Verification:**

- [x] Run the new focused dashboard-state test plus `pnpm test:data`, `pnpm test:radar`, `pnpm typecheck`, and `pnpm lint`.
- [x] Use controlled browser responses for success → failed refresh → recovery, empty results, reduced motion, and globe fallback.
- [x] Run `pnpm build` after the UI change.

**Dependencies:** Task 2.

**Files likely touched:**

- `components/attack-dashboard.tsx`
- `components/route-ledger.tsx`
- `lib/dashboard-view-state.ts`
- `lib/dashboard-view-state.test.mjs`
- `package.json`

**Estimated scope:** Medium, five files.

## Checkpoint: UI refresh complete

- [x] All spec acceptance criteria pass.
- [x] Browser checks pass at 320, 375, 768, 1024, and 1440 px, with no horizontal overflow or console errors.
- [x] Keyboard focus, status announcements, text contrast, reduced motion, and WebGL fallback pass review.
- [x] Full checks pass and this task list records any remaining limit.

Review note: Contrast ratios for the approved text and route colors are above 4.5:1 on both atlas surfaces. The shared line token is 3.2:1 or higher. The development browser emitted a React Three Fiber `useFrame` deprecation warning; no browser console errors were observed.
