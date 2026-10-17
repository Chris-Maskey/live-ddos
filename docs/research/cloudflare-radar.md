# Cloudflare Radar findings

Checked 2026-10-17. Planning research only. No authenticated API request was made.

## Recommended scope

Build an automatically refreshed map of recent HTTP DDoS activity observed by Cloudflare. Animate actual country pairs from Radar. Do not describe each animation as an individual attack event. The pair endpoint returns a ranked aggregate for a time window, with percentage values. [L7 pair API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/methods/attacks/)

Radar is free and available on all plans. Its data covers traffic observed by Cloudflare, rather than every attack on the Internet. The API data carries a CC BY-NC 4.0 license. Plan visible Cloudflare Radar attribution and confirm permitted use before commercial launch. [Radar overview](https://developers.cloudflare.com/radar/)

Use a Cloudflare account and a custom API token with `Account > Radar > Read`. Keep it on the server. Radar paths require no zone identifier. The product guide specifies this permission even though generated endpoint pages currently list User Details permissions. Follow the product guide and verify the token with a request. [First request](https://developers.cloudflare.com/radar/get-started/first-request/)

## Data and endpoints

| Purpose | Endpoint | Notes |
| --- | --- | --- |
| Globe arcs | `/radar/attacks/layer7/top/attacks` | Real origin and target country pairs. Use `mitigationProduct=DDOS`. |
| Source ranking | `/radar/attacks/layer7/top/locations/origin` | Country shares by client IP geolocation. |
| Target ranking | `/radar/attacks/layer7/top/locations/target` | Country shares by attacked zone billing country. |
| Country coordinates | `/radar/entities/locations` | Country codes, names, latitude and longitude. |

The L7 pair response has `result.top_0[]` containing `originCountryAlpha2`, `originCountryName`, `targetCountryAlpha2`, `targetCountryName`, and `value`. `value` is a numeric string. Metadata includes `dateRange[]`, `lastUpdated`, `normalization`, `units`, and `confidenceInfo`. Explicitly request percentage normalization. Preserve the returned percentages; the selected top pairs need not sum to 100. [L7 pair API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/methods/attacks/)

Use this explicit initial query, rather than relying on undocumented defaults:

```text
/radar/attacks/layer7/top/attacks?dateRange=1d&limit=40&mitigationProduct=DDOS&normalization=PERCENTAGE&format=JSON
```

The pair query schema exposes no magnitude option. Do not promise that control. [L7 pair API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/methods/attacks/)

L7 attack endpoints include WAF and other mitigated HTTP requests unless filtered. Origins describe client IP locations, which can differ from the human operator's location. Targets use zone billing locations, which are not server coordinates. Country markers therefore represent approximate country locations. [Application layer explanation](https://developers.cloudflare.com/radar/investigate/application-layer-attacks/), [origin API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/subresources/locations/methods/origin/), [target API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/subresources/locations/methods/target/)

Fetch `/radar/entities/locations?limit=300&format=JSON` once and cache the country lookup for a day. This limit is a proposed request value, not a documented maximum. The API supports `offset` if more rows are needed. `result.locations[]` includes `alpha2`, `name`, `continent`, `latitude`, `longitude`, `region`, and `subregion`. Coordinates are numeric strings. Validate finite latitude and longitude ranges. [Locations API](https://developers.cloudflare.com/api/resources/radar/subresources/entities/subresources/locations/methods/list/)

## Time and freshness

Relative ranges document day and week units, up to `364d` or `52w`. Use `1d` by default and `7d` as the second option. Custom start and end times are floored to 15-minute boundaries. The reference does not state a minimum accepted custom window. Do not assume `dateRange=1h` works. [L7 pair API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/methods/attacks/)

Radar's standard timeseries aggregation intervals start at 15 minutes. One day defaults to 15-minute buckets. This describes aggregation, not a guaranteed publication delay. [Aggregation guide](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/)

No attack-specific update interval or freshness guarantee was found in the consulted official docs. Display the returned data window and `meta.lastUpdated`; store fetch time separately. Polling every five minutes is an application choice. It does not establish a five-minute upstream delay. A fetched response can contain the same dataset update time as the previous response.

## L3/L4 and own-zone data

`/radar/attacks/layer3/top/attacks` advertises paired country aggregates and supports `magnitude=MITIGATED_BYTES|MITIGATED_ATTACKS` plus protocol filters. However, its current generated response schema and example omit target-country fields. Defer the network-layer mode until an authenticated response confirms those fields. [L3 pair API](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer3/subresources/top/methods/attacks/)

Network-layer source geography uses the receiving Cloudflare data center because source IPs can be spoofed. That differs from L7 client IP geography and must have its own explanation. [Network layer guide](https://developers.cloudflare.com/radar/investigate/network-layer-attacks/)

Own-zone security analytics are a separate product. GraphQL Firewall Events require a zone tag, provide request fields such as client IP and event time, and have plan-specific retention limits. They cannot supply a public global event stream. [Firewall Events guide](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-firewall-events/)

## Request budget and verification

Cloudflare's general client API limit is 1,200 requests per five minutes per user or account token, with a separate 200 requests per second per IP limit. Inspect `Ratelimit`, `Ratelimit-Policy`, and `retry-after`; handle HTTP 429 with backoff. No additional Radar-specific quota was found in the consulted docs. [API limits](https://developers.cloudflare.com/fundamentals/api/reference/limits/)

Proposed server cache: share one snapshot for each allowed range, refresh at most every five minutes, and combine requests that arrive during a refresh. Fetch source and target rankings separately if their displayed percentages must represent all countries rather than only the top 40 pair rows. Preserve the previous snapshot on upstream failure, with a visible stale state.

Before implementation proceeds beyond the data boundary, verify a token can fetch the proposed query, both pair coordinates resolve, all percentages parse, metadata identifies the actual window, and DDOS filtering succeeds. Check freshness across two updates. No token is required in the browser. Do not derive request counts, attack counts, packets per second, bandwidth, exact event times, or exact host locations from these percentage rows.
