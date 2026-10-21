import "server-only";

import { unstable_cache } from "next/cache";
import {
  getLocations,
  getRadarLocationCodes,
  InvalidRadarDataError,
  normalizeRadarSnapshot,
  type AttackSnapshot,
  type RadarRange,
} from "@/lib/attack-data";

const API_ROOT = "https://api.cloudflare.com/client/v4/radar";
const REVALIDATE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 10_000;
const LOCATION_BATCH_SIZE = 2;
const LOCATION_REVALIDATE_SECONDS = 86_400;

export type RadarFailureKind = "missing-token" | "unauthorized" | "rate-limited" | "upstream" | "invalid-data";

export class RadarRequestError extends Error {
  constructor(
    readonly kind: RadarFailureKind,
    readonly retryAfter: string | null = null,
  ) {
    super("Cloudflare Radar data is temporarily unavailable.");
    this.name = "RadarRequestError";
  }
}

const readJson = async (url: URL, token: string): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new RadarRequestError("upstream");
  }

  if (response.status === 401 || response.status === 403) {
    throw new RadarRequestError("unauthorized");
  }
  if (response.status === 429) {
    const value = response.headers.get("retry-after");
    const retryAfter = value && /^\d{1,4}$/.test(value) ? value : null;
    throw new RadarRequestError("rate-limited", retryAfter);
  }
  if (!response.ok) throw new RadarRequestError("upstream");

  try {
    return await response.json();
  } catch {
    throw new RadarRequestError("invalid-data");
  }
};

const getToken = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) throw new RadarRequestError("missing-token");
  return token;
};

const getCachedPairs = unstable_cache(async (range: RadarRange) => {
  const attacksUrl = new URL(`${API_ROOT}/attacks/layer7/top/attacks`);
  attacksUrl.search = new URLSearchParams({
    dateRange: range,
    limit: "40",
    mitigationProduct: "DDOS",
    normalization: "PERCENTAGE",
    format: "JSON",
  }).toString();

  const pairPayload = await readJson(attacksUrl, getToken());
  const fetchedAt = new Date().toISOString();
  // Validate before storing a provider response in the shared cache.
  normalizeRadarSnapshot(pairPayload, [], range, fetchedAt);
  return { pairPayload, fetchedAt };
}, ["cloudflare-radar-attack-pairs-v1"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["radar-attack-snapshot"],
});

const getCachedLocations = unstable_cache(async (batch: string[]) => {
  const locationsUrl = new URL(`${API_ROOT}/entities/locations`);
  locationsUrl.search = new URLSearchParams({
    location: batch.join(","),
    format: "JSON",
  }).toString();
  const payload = await readJson(locationsUrl, getToken());
  getLocations(payload);
  return payload;
}, ["cloudflare-radar-locations-v1"], {
  revalidate: LOCATION_REVALIDATE_SECONDS,
});

export async function getRadarSnapshot(range: RadarRange): Promise<AttackSnapshot> {
  try {
    getToken();
    const { pairPayload, fetchedAt } = await getCachedPairs(range);
    const codes = getRadarLocationCodes(pairPayload).sort();
    const batches: string[][] = [];
    for (let index = 0; index < codes.length; index += LOCATION_BATCH_SIZE) {
      batches.push(codes.slice(index, index + LOCATION_BATCH_SIZE));
    }

    // Keep cache scopes separate: nested caches bypass independent reuse in Next.js.
    const locationPayloads = await Promise.all(batches.map(getCachedLocations));

    return normalizeRadarSnapshot(
      pairPayload,
      locationPayloads,
      range,
      fetchedAt,
    );
  } catch (error) {
    if (error instanceof RadarRequestError) throw error;
    if (error instanceof InvalidRadarDataError) {
      throw new RadarRequestError("invalid-data");
    }
    throw error;
  }
}
