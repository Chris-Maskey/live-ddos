---
status: accepted
---

# Cache pair data and country locations independently

The dashboard needs five-minute pair refreshes and one-day country lookups.
In the installed Next.js 16.4.0 implementation, `fetch` caching is bypassed
inside `unstable_cache`, and nested `unstable_cache` calls also bypass reuse.
The original outer snapshot cache therefore prevented the location fetches
from keeping their independent daily lifetime.

Use two sibling `unstable_cache` scopes: one keyed by reporting range for pair
responses, and one keyed by sorted country-code batch for location responses.
Validate provider envelopes before caching. Assemble the normalized snapshot
after both cache reads. Keep the pair fetch timestamp with the cached pair
payload so a cache hit does not pretend to be a new provider fetch.

This uses the existing Next.js Data Cache and adds no dependency or custom
process cache. It repeats normalization for at most 40 routes per app request.
It preserves the API response shape, percentages, and location failure policy.

The regression check uses Next.js' real cache scopes and patched fetch with
controlled responses and in-memory storage. It failed before this change when
switching reporting ranges repeated a country lookup. It now verifies reuse
across ranges, five-minute pair refreshes, daily coordinate expiry, and API
error recovery. Live production checks also verify independent cache entries.

Sources: installed `next/dist/server/lib/patch-fetch.js` and
`next/dist/server/web/spec-extension/unstable-cache.js`, plus the official
[unstable_cache reference](https://nextjs.org/docs/app/api-reference/functions/unstable_cache).
Cache Components migration is outside this fix.
