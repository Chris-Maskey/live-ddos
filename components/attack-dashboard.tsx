"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const snapshot = snapshots[range];
  const error = errors[range];
  const arcs = useMemo(() => makeArcs(snapshot), [snapshot]);

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
  }, [range]);

  const routeLabel = (route: AttackSnapshot["routes"][number]) =>
    `${route.origin.name} → ${route.target.name}`;
  const selectedRoute = snapshot?.routes.find((route) => route.id === selectedRouteId);

  return (
    <main className="min-h-svh bg-[#030811] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-400">
              Cloudflare Radar · HTTP layer
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Global DDoS map
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="range" className="font-mono text-xs text-slate-400">
              DATA WINDOW
            </label>
            <select
              id="range"
              value={range}
              onChange={(event) => {
                const nextRange = event.target.value;
                if (nextRange === "1d" || nextRange === "7d") setRange(nextRange);
              }}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <AttackGlobe arcs={arcs} selectedRouteId={selectedRouteId} />
          <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
              {error ? (snapshot ? "Update delayed" : "Radar unavailable") : snapshot ? "Radar snapshot" : "Connecting"}
            </p>
            {error ? (
              <p className="mt-3 text-sm leading-6 text-amber-200">{error}</p>
            ) : !snapshot ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Loading Cloudflare Radar data…
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {snapshot.routes.length} country pairs in the top 40. The globe shows routes with mapped country coordinates.
                </p>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  Radar updated {new Date(snapshot.lastUpdated).toLocaleString()}
                </p>
                {snapshot.routes.length > 0 ? (
                  <ul className="mt-5 max-h-[420px] divide-y divide-slate-800 overflow-y-auto">
                    {snapshot.routes.map((route) => (
                      <li key={route.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRouteId(route.id)}
                          aria-pressed={selectedRouteId === route.id}
                          className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        >
                          <span className="min-w-0 truncate">{routeLabel(route)}</span>
                          <span className="shrink-0 font-mono text-cyan-300">
                            {route.percent.toFixed(2)}%
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">No ranked country pairs in this window.</p>
                )}
                {selectedRoute && (
                  <p className="mt-4 border-t border-slate-800 pt-4 text-xs text-amber-200">
                    Selected: {routeLabel(selectedRoute)}
                  </p>
                )}
              </>
            )}
          </aside>
        </section>

        <p className="mt-5 max-w-4xl text-xs leading-5 text-slate-500">
          Each arc represents an aggregate origin-to-target country pair within the selected reporting window. Arc motion is a display effect, not a stream of individual attacks.
        </p>
      </div>
    </main>
  );
}
