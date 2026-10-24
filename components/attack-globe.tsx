"use client";

import { Component, type ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  type GlobeArc,
  type GlobeConfig,
  type GlobePalette,
} from "@/components/ui/globe";

type AttackGlobeProps = {
  arcs: GlobeArc[];
  motionEnabled?: boolean;
  selectedRouteId?: string | null;
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
        <div className="grid h-full min-h-[300px] place-items-center px-6 text-center">
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
        selectedRoute: styles.getPropertyValue("--atlas-amber").trim(),
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
      className="relative h-[clamp(300px,55vw,560px)] w-full overflow-hidden bg-transparent"
    >
      <GlobeErrorBoundary>
        {palette ? (
          <World
            globeConfig={globeConfig}
            palette={palette}
            data={arcs}
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
