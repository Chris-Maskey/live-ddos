"use client";

import { Component, type ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { AttackRoute } from "@/lib/attack-data";
import {
  type GlobeConfig,
  type GlobePalette,
} from "@/components/ui/globe";

export type GlobeArc = {
  routeId: string;
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  stroke: number;
};

export type GlobeCountryLocation = {
  code: AttackRoute["origin"]["code"];
  lat: number;
  lng: number;
};

export type GlobeScene = {
  arcs: GlobeArc[];
  locations: GlobeCountryLocation[];
};

type AttackGlobeProps = {
  scene: GlobeScene;
  motionEnabled: boolean;
  selectedRouteId: string | null;
};

const globeConfig: GlobeConfig = {
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
        <div className="grid h-full min-h-0 place-items-center px-6 text-center">
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
  scene,
  motionEnabled,
  selectedRouteId,
}: AttackGlobeProps) {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<GlobePalette | null>(null);

  useEffect(() => {
    if (!resolvedTheme) return;

    const frame = requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      setPalette({
        background: styles.getPropertyValue("--atlas-water").trim(),
        globe: styles.getPropertyValue("--atlas-panel").trim(),
        emissive: styles.getPropertyValue("--atlas-water").trim(),
        atmosphere: styles.getPropertyValue("--atlas-route").trim(),
        land: styles.getPropertyValue("--atlas-land").trim(),
        route: styles.getPropertyValue("--atlas-route").trim(),
        selectedRoute: styles.getPropertyValue("--atlas-route-selected").trim(),
        ambient: styles.getPropertyValue("--atlas-secondary").trim(),
        globeHighlight: styles.getPropertyValue("--atlas-globe-highlight").trim(),
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  return (
    <div
      role="group"
      aria-label="Interactive globe visualization of mapped country-pair routes. Select a route in the route list to highlight its path on the globe."
      className="relative h-full min-h-0 w-full overflow-hidden bg-transparent"
    >
      <GlobeErrorBoundary>
        {palette ? (
          <World
            globeConfig={globeConfig}
            palette={palette}
            scene={scene}
            motionEnabled={motionEnabled}
            selectedRouteId={selectedRouteId}
          />
        ) : (
          <div role="status" className="grid h-full place-items-center text-sm text-atlas-secondary">
            Preparing globe…
          </div>
        )}
      </GlobeErrorBoundary>
    </div>
  );
}
