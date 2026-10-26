# DDoS Atlas

A small dashboard for Cloudflare Radar's aggregated HTTP DDoS data. The globe draws ranked origin-country to target-country pairs. Its moving arcs are a visual effect, not a stream of new attack events.

## Run locally

Use Node.js 22.6 or later and pnpm 10. Add a Cloudflare API token to `.env.local`:

```dotenv
CLOUDFLARE_API_TOKEN=your_token
```

Keep the token on the server. Do not rename it with a `NEXT_PUBLIC_` prefix. Cloudflare's [Radar first-request guide](https://developers.cloudflare.com/radar/get-started/first-request/) lists `Account > Radar > Read`. The generated [location endpoint reference](https://developers.cloudflare.com/api/resources/radar/subresources/entities/subresources/locations/methods/list/) currently lists `User Details Read`, so verify that one token can read both endpoints.

Then install dependencies and start the dashboard:

```sh
pnpm install
pnpm dev
```

The app opens at `http://localhost:3000`. The API accepts `GET /api/attacks?range=1d` or `GET /api/attacks?range=7d` and returns an `AttackReport` with the current snapshot and an equivalent prior-period comparison.

## How to read the map

Cloudflare Radar returns up to 40 country pairs for the selected window. Each percentage is the normalized share reported for that pair. The values may not add up to 100 because the endpoint returns only the top pairs. Each row compares a pair with the same origin and target country codes in the prior period, when present, and shows the difference in percentage points. If the pair is missing from the prior top 40, its prior share is unknown, not zero. The map does not show attack volume, bandwidth, attack duration, exact server locations, or individual attack events.

Search narrows these returned routes by origin or target country name or two-letter code. It does not load routes outside Radar's top 40.

Origin countries use Cloudflare's client IP geolocation. Target countries use the billing country for the attacked Cloudflare zone. Both are approximate country locations. Radar covers traffic observed by Cloudflare, not every attack on the Internet.

The 24-hour view compares with Radar's same-weekday control period from one week earlier. The 7-day view compares with the prior 7-day control period. The dashboard shows the actual current window and Radar dataset update time, with a short comparison label in the route ledger. The report also contains the app provider-fetch timestamp, but the page does not show it separately. The browser checks for a new report every five minutes while visible. The server caches current and control pair responses separately for five minutes and coordinate lookups for one day. Refresh requests a report; the app cache may return existing Radar data. Cloudflare does not document a freshness guarantee for this endpoint.

Radar data is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The dashboard links to Cloudflare Radar as the source. Review the license before using this dashboard commercially.

## Checks

```sh
pnpm test:data
pnpm test:radar
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm test:data` runs the normalizer checks with Node's built-in test runner and TypeScript type stripping.

`pnpm test:radar` checks API errors and independent cache lifetimes using the installed Next.js cache implementation, controlled provider responses, and in-memory cache storage. It needs no real API token. Node prints an experimental VM modules warning for this check.
