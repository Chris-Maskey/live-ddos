import { getRadarReport, RadarRequestError } from "@/lib/cloudflare-radar";
import type { RadarRange } from "@/lib/attack-data";

const isRadarRange = (value: string | null): value is RadarRange =>
  value === "1d" || value === "7d";

export async function GET(request: Request) {
  const rangeParam = new URL(request.url).searchParams.get("range") ?? "1d";
  if (!isRadarRange(rangeParam)) {
    return Response.json(
      { error: { code: "INVALID_RANGE", message: "Range must be 1d or 7d." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const report = await getRadarReport(rangeParam);
    return Response.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof RadarRequestError)) throw error;

    const status =
      error.kind === "rate-limited"
        ? 429
        : error.kind === "upstream"
          ? 502
          : 503;
    const message =
      error.kind === "missing-token"
        ? "Configure CLOUDFLARE_API_TOKEN on the server to load live Radar data."
        : error.kind === "unauthorized"
          ? "The Cloudflare token cannot read Radar data. Check its permissions."
          : error.kind === "invalid-data"
            ? "Cloudflare Radar returned data in an unexpected format."
            : "Cloudflare Radar could not be reached. Try again shortly.";

    const headers = new Headers({ "Cache-Control": "no-store" });
    if (error.retryAfter) headers.set("Retry-After", error.retryAfter);

    return Response.json(
      { error: { code: error.kind.toUpperCase().replaceAll("-", "_"), message } },
      { status, headers },
    );
  }
}
