import { AttackGlobe } from "@/components/attack-globe";
import { type GlobeArc } from "@/components/ui/globe";

const sampleArcs = [
  {
    routeId: "sample-us-fr",
    order: 0,
    startLat: 39.8283,
    startLng: -98.5795,
    endLat: 46.2276,
    endLng: 2.2137,
    arcAlt: 0.2,
    color: "#22d3ee",
    stroke: 0.2,
  },
  {
    routeId: "sample-jp-ca",
    order: 1,
    startLat: 36.2048,
    startLng: 138.2529,
    endLat: 56.1304,
    endLng: -106.3468,
    arcAlt: 0.3,
    color: "#22d3ee",
    stroke: 0.3,
  },
] satisfies GlobeArc[];

export default function Page() {
  return (
    <main className="min-h-svh bg-[#030811] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-400">
              Network observatory
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Global DDoS map
            </h1>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-400/10 px-3 py-1.5 font-mono text-xs text-amber-300">
            SAMPLE ARCS · NOT LIVE DATA
          </span>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <AttackGlobe arcs={sampleArcs} />
          <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
              Data contract preview
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The globe will plot reported country pairs. These two fixed routes
              check the map geometry while the Radar data path is built.
            </p>
            <ul className="mt-6 divide-y divide-slate-800">
              <li className="flex items-center justify-between py-3 text-sm">
                <span>United States → France</span>
                <span className="font-mono text-cyan-300">sample</span>
              </li>
              <li className="flex items-center justify-between py-3 text-sm">
                <span>Japan → Canada</span>
                <span className="font-mono text-cyan-300">sample</span>
              </li>
            </ul>
            <p className="mt-6 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
              Radar reports aggregate activity by period. Animated arcs will not
              represent individual attacks arriving in real time.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
