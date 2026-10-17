# Live DDoS map

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

The app opens at `http://localhost:3000`. The API route also accepts `GET /api/attacks?range=1d` or `GET /api/attacks?range=7d`.

## How to read the map

Cloudflare Radar returns up to 40 country pairs for the selected window. Each percentage is the normalized share reported for that pair. The values may not add up to 100 because the endpoint returns only the top pairs. The map does not show raw request counts, bandwidth, attack duration, exact server locations, or individual attack events.

Origin countries use Cloudflare's client IP geolocation. Target countries use the billing country for the attacked Cloudflare zone. Both are approximate country locations. Radar covers traffic observed by Cloudflare, not every attack on the Internet.

The browser checks for a new snapshot every five minutes while the page is visible. The server caches snapshots for five minutes and caches coordinate lookups for one day. Cloudflare does not document a freshness guarantee for this endpoint, so the dataset update time and app fetch time are separate.

Radar data is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The dashboard links to Cloudflare Radar as the source. Review the license before using this dashboard commercially.

## Checks

```sh
pnpm test:data
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm test:data` runs the normalizer checks with Node's built-in test runner and TypeScript type stripping.
