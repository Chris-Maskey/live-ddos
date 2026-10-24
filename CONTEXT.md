# DDoS Atlas context

This context defines the country-level HTTP DDoS data shown from Cloudflare Radar.

## Language

**Radar snapshot**: One Radar result for a selected reporting window. Its dataset update time and the app's fetch time are separate.

_Avoid_: Live event feed

**Attack route**: A ranked pair of origin and target countries in a Radar snapshot. It represents an aggregate, not one attack event.

_Avoid_: Event, incident

**Origin country**: The country Cloudflare assigns from the client IP address for HTTP-layer data.

**Target country**: The billing country for the attacked Cloudflare zone. It does not identify a server location.

**Normalized percentage**: The percentage value Cloudflare reports for a country pair. It is not a raw request count, attack count, or rate.

**Country coordinate**: An approximate location for a country. It does not identify an exact host or network endpoint.
