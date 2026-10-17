import "server-only";

import { unstable_cache } from "next/cache";
import {
  getRadarLocationCodes,
  InvalidRadarDataError,
  normalizeRadarSnapshot,
  type AttackSnapshot,
  type RadarRange,
} from "@/lib/attack-data";

const API_ROOT = "https://api.cloudflare.com/client/v4/radar";
const REVALIDATE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 10_000;

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

const readJson = async (
  url: URL,
  token: string,
  revalidateSeconds?: number,
): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      ...(revalidateSeconds
        ? { cache: "force-cache" as const, next: { revalidate: revalidateSeconds } }
        : { cache: "no-store" as const }),
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

const loadSnapshot = async (range: RadarRange): Promise<AttackSnapshot> => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) throw new RadarRequestError("missing-token");

  const attacksUrl = new URL(`${API_ROOT}/attacks/layer7/top/attacks`);
  attacksUrl.search = new URLSearchParams({
    dateRange: range,
    limit: "40",
    mitigationProduct: "DDOS",
    normalization: "PERCENTAGE",
    format: "JSON",
  }).toString();

  const pairPayload = await readJson(attacksUrl, token);
  let locationPayload: unknown;

  try {
    const codes = getRadarLocationCodes(pairPayload).sort();
    if (codes.length === 0) {
      locationPayload = { success: true, result: { locations: [] } };
    } else {
      const locationsUrl = new URL(`${API_ROOT}/entities/locations`);
      locationsUrl.search = new URLSearchParams({
        location: codes.join(","),
        format: "JSON",
      }).toString();
      locationPayload = await readJson(locationsUrl, token, 86_400);
    }

    return normalizeRadarSnapshot(
      pairPayload,
      locationPayload,
      range,
      new Date().toISOString(),
    );
  } catch (error) {
    if (error instanceof RadarRequestError) throw error;
    if (error instanceof InvalidRadarDataError) {
      throw new RadarRequestError("invalid-data");
    }
    throw error;
  }
};

const getCachedSnapshot = unstable_cache(
  async (range: RadarRange) => loadSnapshot(range),
  ["cloudflare-radar-attack-snapshot-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: ["radar-attack-snapshot"] },
);

export function getRadarSnapshot(range: RadarRange) {
  return getCachedSnapshot(range);
}
