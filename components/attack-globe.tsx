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
  globeColor: "#0D2225",
  emissive: "#061619",
  atmosphereColor: "#64CDBF",
  polygonColor: "rgba(145, 167, 163, 0.48)",
  autoRotate: true,
};

const World = dynamic(
  () => import("@/components/ui/globe").then((module) => module.World),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="grid h-full place-items-center text-sm text-atlas-secondary">
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
          <p role="status" className="max-w-sm text-sm leading-6 text-atlas-secondary">
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
      role="group"
      aria-label="Interactive globe visualization of mapped country-pair routes. Select a route in the adjacent ledger for details."
      className="relative h-[min(78vw,620px)] min-h-[300px] w-full overflow-hidden rounded-md border border-atlas-line bg-atlas-water sm:min-h-[420px]"
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
