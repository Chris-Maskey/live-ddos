"use client";

import dynamic from "next/dynamic";
import { type GlobeArc, type GlobeConfig } from "@/components/ui/globe";

type AttackGlobeProps = {
  arcs: GlobeArc[];
  motionEnabled?: boolean;
  selectedRouteId?: string | null;
};

const globeConfig: GlobeConfig = {
  globeColor: "#07111d",
  emissive: "#07111d",
  atmosphereColor: "#38bdf8",
  polygonColor: "rgba(100, 116, 139, 0.68)",
  autoRotate: true,
};

const World = dynamic(
  () => import("@/components/ui/globe").then((module) => module.World),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-slate-400">
        Preparing globe…
      </div>
    ),
  },
);

export function AttackGlobe({
  arcs,
  motionEnabled = true,
  selectedRouteId = null,
}: AttackGlobeProps) {
  return (
    <div className="relative h-[min(72vw,620px)] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#030811] sm:h-[560px]">
      <World
        globeConfig={globeConfig}
        data={arcs}
        motionEnabled={motionEnabled}
        selectedRouteId={selectedRouteId}
      />
    </div>
  );
}
