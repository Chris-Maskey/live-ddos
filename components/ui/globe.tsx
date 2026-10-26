"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Group, MeshPhongMaterial, Vector3 } from "three"
import ThreeGlobe from "three-globe"
import { extend, useThree } from "@react-three/fiber"
import { Canvas } from "@react-three/fiber/legacy"
import { OrbitControls } from "@react-three/drei"
import countries from "@/data/globe.json"
import type { GlobeScene } from "@/components/attack-globe"

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElements["mesh"] & {
      new (): ThreeGlobe
    }
  }
}

extend({ ThreeGlobe })

const RING_MAX_RADIUS = 3.5
const RING_PROPAGATION_SPEED = 1.6
const RING_REPEAT_PERIOD = 2400
const CAMERA_Z = 330

export type GlobePalette = {
  background: string
  globe: string
  emissive: string
  atmosphere: string
  land: string
  route: string
  mutedRoute: string
  selectedRoute: string
  ambient: string
  globeHighlight: string
}

export type GlobeConfig = {
  showAtmosphere?: boolean
  atmosphereAltitude?: number
  emissiveIntensity?: number
  shininess?: number
  arcTime?: number
  arcLength?: number
  initialPosition?: {
    lat: number
    lng: number
  }
  autoRotate?: boolean
  autoRotateSpeed?: number
}

type WorldProps = {
  globeConfig: GlobeConfig
  palette: GlobePalette
  scene: GlobeScene
  motionEnabled: boolean
  selectedRouteId: string | null
  rotationLatitudeOffset: number
  rotationOffset: number
}

const DEFAULT_CONFIG: Required<GlobeConfig> = {
  showAtmosphere: true,
  atmosphereAltitude: 0.12,
  emissiveIntensity: 0.12,
  shininess: 0.82,
  arcTime: 2400,
  arcLength: 0.34,
  initialPosition: { lat: 18, lng: -18 },
  autoRotate: true,
  autoRotateSpeed: 0.4,
}

export function Globe({
  globeConfig,
  palette,
  scene,
  motionEnabled,
  selectedRouteId,
  rotationLatitudeOffset,
  rotationOffset,
}: WorldProps) {
  const globeRef = useRef<ThreeGlobe | null>(null)
  const groupRef = useRef<Group | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...globeConfig }),
    [globeConfig]
  )

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    const globe = new ThreeGlobe({
      waitForGlobeReady: false,
      animateIn: false,
    })
    group.add(globe)
    globeRef.current = globe
    setIsInitialized(true)

    return () => {
      globeRef.current = null
      group.remove(globe)
      globe._destructor()
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !isInitialized) return

    const material = globe.globeMaterial()
    if (material instanceof MeshPhongMaterial) {
      material.color.set(palette.globe)
      material.emissive.set(palette.emissive)
      material.emissiveIntensity = config.emissiveIntensity
      material.shininess = config.shininess
    }

    globe
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(config.showAtmosphere)
      .atmosphereColor(palette.atmosphere)
      .atmosphereAltitude(config.atmosphereAltitude)
      .hexPolygonColor(() => palette.land)
  }, [config, isInitialized, palette])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !isInitialized) return

    const selectedArc = scene.arcs.find(
      (arc) => arc.routeId === selectedRouteId
    )
    const selectedCountryCodes = new Set(
      selectedArc ? [selectedArc.startCode, selectedArc.endCode] : []
    )
    const isSameCountryRoute =
      selectedArc !== undefined && selectedArc.startCode === selectedArc.endCode
    const points = scene.locations.map((location) => {
      const selected = selectedCountryCodes.has(location.code)
      return {
        ...location,
        color: selected ? palette.selectedRoute : palette.route,
        radius: selected ? (isSameCountryRoute ? 1.05 : 0.8) : 0.6,
        altitude: selected ? 0.025 : 0.015,
      }
    })
    const rings = motionEnabled
      ? scene.locations.map((location) => {
          const selected = selectedCountryCodes.has(location.code)
          return {
            ...location,
            color: selected
              ? [palette.selectedRoute, palette.background]
              : [palette.route, palette.background],
            altitude: selected ? 0.03 : 0.018,
            maxRadius:
              selected && isSameCountryRoute
                ? RING_MAX_RADIUS * 2
                : RING_MAX_RADIUS,
          }
        })
      : []
    const selectedLabels = selectedArc
      ? [
          {
            lat: selectedArc.startLat,
            lng: selectedArc.startLng,
            text: selectedArc.startName,
          },
          {
            lat: selectedArc.endLat,
            lng: selectedArc.endLng,
            text: selectedArc.endName,
          },
        ]
      : []
    const arcs = scene.arcs.map((arc, index) => {
      const selected = arc.routeId === selectedRouteId
      return {
        ...arc,
        order: index,
        color: selected
          ? palette.selectedRoute
          : selectedRouteId
            ? palette.mutedRoute
            : palette.route,
        dashLength: selected || !motionEnabled ? 1 : config.arcLength,
        dashGap: selected || !motionEnabled ? 0 : 1 - config.arcLength,
        dashInitialGap: 0,
        dashTime: selected ? 0 : motionEnabled ? config.arcTime : 0,
      }
    })

    globe
      .arcsData(arcs)
      .arcStartLat("startLat")
      .arcStartLng("startLng")
      .arcEndLat("endLat")
      .arcEndLng("endLng")
      .arcColor("color")
      .arcAltitude("arcAlt")
      .arcStroke("stroke")
      .arcDashLength("dashLength")
      .arcDashInitialGap("dashInitialGap")
      .arcDashGap("dashGap")
      .arcDashAnimateTime("dashTime")
      .arcsTransitionDuration(motionEnabled ? 450 : 0)
      .pointsData(points)
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointsMerge(true)
      .pointAltitude("altitude")
      .pointRadius("radius")
      .labelsData(selectedLabels)
      .labelLat("lat")
      .labelLng("lng")
      .labelText("text")
      .labelSize(1.7)
      .labelColor(() => palette.selectedRoute)
      .labelAltitude(0.035)
      .labelIncludeDot(true)
      .labelDotRadius(0.16)
      .labelDotOrientation(() => "bottom")
      .labelsTransitionDuration(motionEnabled ? 300 : 0)
      .ringsData(rings)
      .ringLat("lat")
      .ringLng("lng")
      .ringAltitude("altitude")
      .ringColor("color")
      .ringMaxRadius("maxRadius")
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod(RING_REPEAT_PERIOD)
  }, [
    config.arcLength,
    config.arcTime,
    isInitialized,
    motionEnabled,
    palette.background,
    palette.route,
    palette.mutedRoute,
    palette.selectedRoute,
    scene.arcs,
    scene.locations,
    selectedRouteId,
  ])

  const initialPosition = config.initialPosition

  return (
    <group
      ref={groupRef}
      rotation={[
        (initialPosition.lat * Math.PI) / 180 + rotationLatitudeOffset,
        (initialPosition.lng * Math.PI) / 180 + rotationOffset,
        0,
      ]}
    />
  )
}

function WorldContents({
  globeConfig,
  palette,
  scene,
  motionEnabled,
  selectedRouteId,
  rotationLatitudeOffset,
  rotationOffset,
}: WorldProps) {
  const { size } = useThree()
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...globeConfig }),
    [globeConfig]
  )

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
      <group
        scale={
          size.width < 520
            ? Math.min(1.15, size.width / size.height)
            : 1
        }
      >
        <Globe
          globeConfig={globeConfig}
          palette={palette}
          scene={scene}
          motionEnabled={motionEnabled}
          selectedRouteId={selectedRouteId}
          rotationLatitudeOffset={rotationLatitudeOffset}
          rotationOffset={rotationOffset}
        />
      </group>
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
  )
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
  )
}

export { type WorldProps }
