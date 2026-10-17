"use client";

import { Component, type ReactNode } from "react";
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

class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-full min-h-[360px] place-items-center px-6 text-center">
          <p className="max-w-sm text-sm leading-6 text-slate-400">
            The 3D map is unavailable in this browser. The route list still contains the Radar data.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AttackGlobe({
  arcs,
  motionEnabled = true,
  selectedRouteId = null,
}: AttackGlobeProps) {
  return (
    <div
      role="img"
      aria-label={`Interactive globe visualization with ${arcs.length} mapped country pair routes. Select a route in the adjacent list for details.`}
      className="relative h-[min(72vw,620px)] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#030811] sm:h-[560px]"
    >
      <GlobeErrorBoundary>
        <World
          globeConfig={globeConfig}
          data={arcs}
          motionEnabled={motionEnabled}
          selectedRouteId={selectedRouteId}
        />
      </GlobeErrorBoundary>
    </div>
  );
}
