---
status: accepted
---

# Return current and control-period route shares in one report

The dashboard needs to compare route shares across equivalent reporting
periods while keeping the current snapshot as the source for the globe, status,
and range view. Cloudflare Radar supplies control periods: `1dcontrol` compares
the same weekday one week earlier, and `7dcontrol` covers the prior 7-day
window.

`GET /api/attacks?range=1d|7d` returns an `AttackReport` with the existing
current `AttackSnapshot` and a reduced comparison containing Radar's actual
window metadata and up to 40 origin-code, target-code, and percentage shares.
The browser validates the complete envelope. The comparison has no route IDs,
coordinates, or app-fetch timestamp because the ledger needs only country-pair
identity, share, and the period being compared.

Fetch the current and control pair requests in parallel through separate
five-minute cache scopes. Cache the comparison after validation in its reduced
form. Keep location requests limited to current routes and retain the
independent one-day location cache. Preserve the current pair fetch timestamp
with the cached current response.

Match pairs by both country codes. Show a percentage-point difference only
when the matching pair appears in both top-40 responses. A missing comparison
pair means it was not ranked in the previous top 40; its share is unknown,
never zero. Use the actual windows returned by Radar in the interface.

This keeps current globe behavior intact and avoids inventing a prior route
snapshot with coordinates or timestamps that the ledger does not use. A
control-request failure fails the report because a comparison without its
control data would not satisfy the response contract.
