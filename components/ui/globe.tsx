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
  color: string;
  stroke: number;
};

export type GlobeConfig = {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
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
  data: GlobeArc[];
  motionEnabled?: boolean;
  selectedRouteId?: string | null;
};

type GlobePoint = {
  size: number;
  color: string;
  lat: number;
  lng: number;
};

const DEFAULT_CONFIG: Required<GlobeConfig> = {
  pointSize: 1,
  globeColor: "#0D2225",
  showAtmosphere: true,
  atmosphereColor: "#64CDBF",
  atmosphereAltitude: 0.12,
  emissive: "#061619",
  emissiveIntensity: 0.12,
  shininess: 0.82,
  polygonColor: "rgba(145, 167, 163, 0.48)",
  ambientLight: "#91A7A3",
  directionalLeftLight: "#E4ECE7",
  directionalTopLight: "#64CDBF",
  pointLight: "#64CDBF",
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
      material.color.set(config.globeColor);
      material.emissive.set(config.emissive);
      material.emissiveIntensity = config.emissiveIntensity;
      material.shininess = config.shininess;
    }

    globe
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(config.showAtmosphere)
      .atmosphereColor(config.atmosphereColor)
      .atmosphereAltitude(config.atmosphereAltitude)
      .hexPolygonColor(() => config.polygonColor);
  }, [config, isInitialized]);

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
            color: arc.color,
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
        color: selected ? "#EFB86C" : arc.color,
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
      .arcsTransitionDuration(450)
      .pointsData(points)
      .pointColor("color")
      .pointsMerge(true)
      .pointAltitude(0.015)
      .pointRadius(0.6)
      .ringsData([])
      .ringColor(() => config.atmosphereColor)
      .ringMaxRadius(config.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod(
        (config.arcTime * config.arcLength) / Math.max(config.rings, 1),
      );
  }, [
    config.arcLength,
    config.arcTime,
    config.atmosphereColor,
    config.maxRings,
    config.rings,
    data,
    isInitialized,
    motionEnabled,
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
      <color attach="background" args={["#061619"]} />
      <fog attach="fog" args={["#061619", 450, 1300]} />
      <ambientLight color={config.ambientLight} intensity={0.58} />
      <directionalLight
        color={config.directionalLeftLight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={config.directionalTopLight}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={config.pointLight}
        position={new Vector3(-200, 500, 200)}
        intensity={0.8}
      />
      <Globe
        globeConfig={globeConfig}
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
