"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, MeshPhongMaterial, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { extend, useThree } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber/legacy";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElements["mesh"] & {
      new (): ThreeGlobe;
    };
  }
}

extend({ ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const CAMERA_Z = 330;

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

export type GlobePalette = {
  background: string;
  globe: string;
  emissive: string;
  atmosphere: string;
  land: string;
  route: string;
  selectedRoute: string;
  ambient: string;
  globeHighlight: string;
};

export type GlobeConfig = {
  pointSize?: number;
  showAtmosphere?: boolean;
  atmosphereAltitude?: number;
  emissiveIntensity?: number;
  shininess?: number;
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  initialPosition?: {
    lat: number;
    lng: number;
  };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

type WorldProps = {
  globeConfig: GlobeConfig;
  palette: GlobePalette;
  data: GlobeArc[];
  motionEnabled?: boolean;
  selectedRouteId?: string | null;
};

type GlobePoint = {
  size: number;
  lat: number;
  lng: number;
};

const DEFAULT_CONFIG: Required<GlobeConfig> = {
  pointSize: 1,
  showAtmosphere: true,
  atmosphereAltitude: 0.12,
  emissiveIntensity: 0.12,
  shininess: 0.82,
  arcTime: 2400,
  arcLength: 0.34,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 18, lng: -18 },
  autoRotate: true,
  autoRotateSpeed: 0.4,
};

export function Globe({
  globeConfig,
  palette,
  data,
  motionEnabled = true,
  selectedRouteId = null,
}: WorldProps) {
  const globeRef = useRef<ThreeGlobe | null>(null);
  const groupRef = useRef<Group | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...globeConfig }),
    [globeConfig],
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const globe = new ThreeGlobe({ waitForGlobeReady: false, animateIn: false });
    group.add(globe);
    globeRef.current = globe;
    setIsInitialized(true);

    return () => {
      globeRef.current = null;
      group.remove(globe);
      globe._destructor();
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !isInitialized) return;

    const material = globe.globeMaterial();
    if (material instanceof MeshPhongMaterial) {
      material.color.set(palette.globe);
      material.emissive.set(palette.emissive);
      material.emissiveIntensity = config.emissiveIntensity;
      material.shininess = config.shininess;
    }

    globe
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(config.showAtmosphere)
      .atmosphereColor(palette.atmosphere)
      .atmosphereAltitude(config.atmosphereAltitude)
      .hexPolygonColor(() => palette.land);
  }, [config, isInitialized, palette]);

  const points = useMemo(() => {
    const locations = new Map<string, GlobePoint>();
    for (const arc of data) {
      for (const { lat, lng } of [
        { lat: arc.startLat, lng: arc.startLng },
        { lat: arc.endLat, lng: arc.endLng },
      ]) {
        const key = `${lat},${lng}`;
        if (!locations.has(key)) {
          locations.set(key, {
            size: config.pointSize,
            lat,
            lng,
          });
        }
      }
    }
    return [...locations.values()];
  }, [config.pointSize, data]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !isInitialized) return;

    const arcs = data.map((arc, index) => {
      const selected = arc.routeId === selectedRouteId;
      return {
        ...arc,
        order: index,
        color: selected ? palette.selectedRoute : palette.route,
        stroke: selected ? Math.max(arc.stroke, 0.55) : arc.stroke,
      };
    });

    globe
      .arcsData(arcs)
      .arcStartLat("startLat")
      .arcStartLng("startLng")
      .arcEndLat("endLat")
      .arcEndLng("endLng")
      .arcColor("color")
      .arcAltitude("arcAlt")
      .arcStroke("stroke")
      .arcDashLength(motionEnabled ? config.arcLength : 1)
      .arcDashInitialGap("order")
      .arcDashGap(motionEnabled ? 1 : 0)
      .arcDashAnimateTime(motionEnabled ? config.arcTime : 0)
      .arcsTransitionDuration(motionEnabled ? 450 : 0)
      .pointsData(points)
      .pointColor(() => palette.route)
      .pointsMerge(true)
      .pointAltitude(0.015)
      .pointRadius(0.6)
      .ringsData([])
      .ringColor(() => palette.atmosphere)
      .ringMaxRadius(config.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod(
        (config.arcTime * config.arcLength) / Math.max(config.rings, 1),
      );
  }, [
    config.arcLength,
    config.arcTime,
    config.maxRings,
    config.rings,
    data,
    isInitialized,
    motionEnabled,
    palette.atmosphere,
    palette.route,
    palette.selectedRoute,
    points,
    selectedRouteId,
  ]);

  const initialPosition = config.initialPosition;

  return (
    <group
      ref={groupRef}
      rotation={[
        (initialPosition.lat * Math.PI) / 180,
        (initialPosition.lng * Math.PI) / 180,
        0,
      ]}
    />
  );
}

function WorldContents({
  globeConfig,
  palette,
  data,
  motionEnabled = true,
  selectedRouteId = null,
}: WorldProps) {
  const { size } = useThree();
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...globeConfig }),
    [globeConfig],
  );

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 450, 1300]} />
      <ambientLight color={palette.ambient} intensity={0.58} />
      <directionalLight
        color={palette.globeHighlight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={palette.route}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={palette.route}
        position={new Vector3(-200, 500, 200)}
        intensity={0.8}
      />
      <Globe
        globeConfig={globeConfig}
        palette={palette}
        data={data}
        motionEnabled={motionEnabled}
        selectedRouteId={selectedRouteId}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={CAMERA_Z}
        maxDistance={CAMERA_Z}
        autoRotate={motionEnabled && config.autoRotate && size.width > 520}
        autoRotateSpeed={config.autoRotateSpeed}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </>
  );
}

export function World(props: WorldProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{
        fov: 42,
        near: 0.1,
        far: 1800,
        position: [0, 0, CAMERA_Z],
      }}
    >
      <WorldContents {...props} />
    </Canvas>
  );
}

export { type WorldProps };
