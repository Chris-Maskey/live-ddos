"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { AttackGlobe } from "@/components/attack-globe";
import { type GlobeArc } from "@/components/ui/globe";
import {
  isAttackSnapshot,
  type AttackSnapshot,
  type RadarRange,
} from "@/lib/attack-data";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const responseError = (body: unknown): string | null => {
  if (!isRecord(body)) return null;
  const error = body.error;
  if (!isRecord(error)) return null;
  return typeof error.message === "string" ? error.message : null;
};

const makeArcs = (snapshot: AttackSnapshot | undefined): GlobeArc[] =>
  (snapshot?.routes ?? []).flatMap((route, order) => {
    const { latitude: startLat, longitude: startLng } = route.origin;
    const { latitude: endLat, longitude: endLng } = route.target;
    if (startLat === null || startLng === null || endLat === null || endLng === null) {
      return [];
    }

    const weight = Math.sqrt(route.percent);
    return [
      {
        routeId: route.id,
        order,
        startLat,
        startLng,
        endLat,
        endLng,
        arcAlt: Math.min(0.52, 0.12 + weight * 0.035),
        color: "#22d3ee",
        stroke: Math.min(0.62, 0.12 + weight * 0.055),
      },
    ];
  });

export function AttackDashboard() {
  const [range, setRange] = useState<RadarRange>("1d");
  const [snapshots, setSnapshots] = useState<Partial<Record<RadarRange, AttackSnapshot>>>({});
  const [errors, setErrors] = useState<Partial<Record<RadarRange, string>>>({});
  const [fetching, setFetching] = useState<Partial<Record<RadarRange, boolean>>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const snapshot = snapshots[range];
  const error = errors[range];
  const isFetching = fetching[range] ?? false;
  const arcs = useMemo(() => makeArcs(snapshot), [snapshot]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let refreshOnVisibility = false;
    let retryDelay = POLL_INTERVAL_MS;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = (delay: number) => {
      clearTimer();
      if (!stopped) timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") {
        schedule(POLL_INTERVAL_MS);
        return;
      }
      if (inFlight) {
        refreshOnVisibility = true;
        return;
      }

      inFlight = true;
      controller = new AbortController();
      setFetching((current) => ({ ...current, [range]: true }));
      try {
        const response = await fetch(`/api/attacks?range=${range}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            responseError(body) ?? "Cloudflare Radar could not be reached.",
          );
        }

        if (!isAttackSnapshot(body)) {
          throw new Error("Cloudflare Radar returned an unexpected response.");
        }
        const nextSnapshot = body;
        setSnapshots((current) => ({ ...current, [range]: nextSnapshot }));
        setErrors((current) => {
          const next = { ...current };
          delete next[range];
          return next;
        });
        retryDelay = POLL_INTERVAL_MS;
      } catch (cause) {
        if (!controller.signal.aborted) {
          setErrors((current) => ({
            ...current,
            [range]:
              cause instanceof Error
                ? cause.message
                : "Cloudflare Radar could not be reached.",
          }));
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        }
      } finally {
        inFlight = false;
        if (stopped) return;
        setFetching((current) => ({ ...current, [range]: false }));
        if (refreshOnVisibility && document.visibilityState === "visible") {
          refreshOnVisibility = false;
          schedule(0);
        } else {
          schedule(retryDelay);
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        return;
      }
      if (inFlight) {
        refreshOnVisibility = true;
      } else {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    void poll();

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [range, refreshKey]);

  const routeLabel = (route: AttackSnapshot["routes"][number]) =>
    `${route.origin.name} → ${route.target.name}`;
  const selectedRoute = snapshot?.routes.find((route) => route.id === selectedRouteId);

  return (
    <main className="min-h-svh bg-[#030811] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
              Global threat observatory
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Network attack map
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Cloudflare Radar <span className="px-1 text-slate-600">/</span> HTTP DDoS activity
            </p>
          </div>
          <nav aria-label="Dashboard controls" className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="range" className="pl-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Reporting window
              </label>
              <select
                id="range"
                value={range}
                onChange={(event) => {
                  const nextRange = event.target.value;
                  if (nextRange === "1d" || nextRange === "7d") setRange(nextRange);
                }}
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition-colors hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              aria-label="Refresh Radar data"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setMotionEnabled((enabled) => !enabled)}
              disabled={prefersReducedMotion}
              aria-pressed={motionEnabled && !prefersReducedMotion}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 transition-colors hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {motionEnabled && !prefersReducedMotion ? (
                <Pause aria-hidden="true" className="size-4" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              {prefersReducedMotion
                ? "Reduced motion"
                : motionEnabled
                  ? "Pause motion"
                  : "Resume motion"}
            </button>
          </nav>
        </header>

        <section
          aria-busy={isFetching}
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${error ? "bg-amber-400" : snapshot ? "bg-emerald-400" : "animate-pulse bg-cyan-400"}`}
                />
                <p role="status" aria-live="polite" className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
                  {error
                    ? snapshot
                      ? "Snapshot held · update delayed"
                      : "Waiting for Radar"
                    : isFetching
                      ? snapshot
                        ? "Checking for updates"
                        : "Connecting to Radar"
                      : snapshot
                      ? "Radar data loaded"
                      : "Waiting for Radar"}
                </p>
              </div>
              {snapshot && (
                <p className="font-mono text-[10px] text-slate-500">
                  LAST DATASET UPDATE {new Date(snapshot.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <AttackGlobe
              arcs={arcs}
              motionEnabled={motionEnabled && !prefersReducedMotion}
              selectedRouteId={selectedRouteId}
            />
            {prefersReducedMotion && (
              <p className="mt-2 text-xs text-slate-500">
                Map motion is disabled by your system preference.
              </p>
            )}
          </div>

          <aside className="rounded-xl border border-slate-800 bg-[#080f1c] p-5 shadow-[0_16px_50px_-36px_rgba(34,211,238,0.32)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Country pairs
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {snapshot ? snapshot.routes.length.toString().padStart(2, "0") : "—"}
                </p>
              </div>
              <span className="rounded-md border border-cyan-900/80 bg-cyan-950/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-cyan-300">
                Top 40
              </span>
            </div>
            <div className="my-4 h-px bg-slate-800" />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
              {error ? (snapshot ? "Update delayed" : "Radar unavailable") : snapshot ? "Activity by route" : "Loading snapshot"}
            </p>
            {error ? (
              <p role="alert" className="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/30 p-3 text-sm leading-6 text-amber-200">
                {error}
              </p>
            ) : !snapshot ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Loading Cloudflare Radar data…
              </p>
            ) : (
              <>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Share of normalized HTTP request traffic in this window. The list includes pairs without mapped coordinates.
                </p>
                {snapshot.routes.length > 0 ? (
                  <ul className="mt-4 max-h-[min(52vh,520px)] divide-y divide-slate-800 overflow-y-auto pr-1">
                    {snapshot.routes.map((route) => (
                      <li key={route.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRouteId(route.id)}
                          aria-pressed={selectedRouteId === route.id}
                          className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left text-sm transition-colors hover:bg-slate-900/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${selectedRouteId === route.id ? "bg-slate-900 text-cyan-200" : "text-slate-200"}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{routeLabel(route)}</span>
                            {route.origin.latitude === null || route.target.latitude === null ? (
                              <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-slate-600">
                                Coordinates unavailable
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-cyan-300">
                            {route.percent.toFixed(2)}<span className="text-slate-500">%</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">No ranked country pairs in this window.</p>
                )}
                {selectedRoute && (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                      Selected route
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{routeLabel(selectedRoute)}</p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-amber-200">
                      {selectedRoute.percent.toFixed(2)}% normalized share
                    </p>
                  </div>
                )}
              </>
            )}
          </aside>
        </section>

        <footer className="mt-5 flex flex-col gap-2 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl">
            Each arc is an aggregate country pair during the selected reporting window. Arc motion is a display effect, not a stream of individual attacks. Radar data covers traffic observed by Cloudflare; locations are country-level approximations.
          </p>
          <p className="shrink-0">
            <a
              href="https://radar.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline decoration-cyan-900 underline-offset-4 hover:text-cyan-100"
            >
              Data by Cloudflare Radar
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-700 underline-offset-4 hover:text-slate-300"
            >
              CC BY-NC 4.0
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
