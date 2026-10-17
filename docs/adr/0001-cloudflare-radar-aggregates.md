---
status: accepted
---

# Use Cloudflare Radar aggregates for globe routes

The map uses Radar's layer-7 top attack-pair endpoint with the DDoS mitigation filter and percentage normalization. Each route is an aggregate origin-country to target-country pair over a one-day or seven-day window, not a newly observed attack event. Radar does not provide event timestamps or raw counts in this response, so the UI must not imply them.
