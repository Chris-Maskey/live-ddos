"use client"

import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import type { AttackRoute } from "@/lib/attack-data"
import LoadingState from "@/components/loading-state"
import { type GlobeConfig, type GlobePalette } from "@/components/ui/globe"

export type GlobeArc = {
  routeId: string
  order: number
  startName: string
  startCode: AttackRoute["origin"]["code"]
  startLat: number
  startLng: number
  endName: string
  endCode: AttackRoute["target"]["code"]
  endLat: number
  endLng: number
  arcAlt: number
  stroke: number
}

export type GlobeCountryLocation = {
  code: AttackRoute["origin"]["code"]
  lat: number
  lng: number
}

export type GlobeScene = {
  arcs: GlobeArc[]
  locations: GlobeCountryLocation[]
}

type AttackGlobeProps = {
  scene: GlobeScene
  motionEnabled: boolean
  selectedRouteId: string | null
}

const globeConfig: GlobeConfig = {
  autoRotate: true,
  initialPosition: { lat: 18, lng: -18 },
}

const getFocusRotationOffset = (arc: GlobeArc | undefined) => {
  if (!arc) return { latitude: 0, longitude: 0 }

  const toVector = (latitude: number, longitude: number) => {
    const latitudeRadians = (latitude * Math.PI) / 180
    const longitudeRadians = (longitude * Math.PI) / 180
    const radius = Math.cos(latitudeRadians)
    return {
      x: radius * Math.cos(longitudeRadians),
      y: Math.sin(latitudeRadians),
      z: radius * Math.sin(longitudeRadians),
    }
  }
  const start = toVector(arc.startLat, arc.startLng)
  const end = toVector(arc.endLat, arc.endLng)
  const midpoint = {
    x: start.x + end.x,
    y: start.y + end.y,
    z: start.z + end.z,
  }
  const midpointLength = Math.hypot(midpoint.x, midpoint.y, midpoint.z)
  const midpointLatitude = Math.atan2(
    midpoint.y,
    Math.hypot(midpoint.x, midpoint.z)
  )
  const midpointLongitude = Math.atan2(midpoint.z, midpoint.x)
  const initialLatitude =
    ((globeConfig.initialPosition?.lat ?? 0) * Math.PI) / 180
  const initialLongitude =
    ((globeConfig.initialPosition?.lng ?? 0) * Math.PI) / 180

  if (midpointLength < 1e-6) {
    return { latitude: 0, longitude: 0 }
  }

  return {
    latitude: midpointLatitude - initialLatitude,
    longitude: -midpointLongitude - initialLongitude,
  }
}

const World = dynamic(
  () => import("@/components/ui/globe").then((module) => module.World),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center">
        <LoadingState
          variant="Orbit"
          label="Preparing globe…"
          showElapsed={false}
        />
      </div>
    ),
  }
)

class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-full min-h-0 place-items-center px-6 text-center">
          <p
            role="status"
            className="max-w-sm text-sm leading-6 text-atlas-secondary"
          >
            The 3D map is unavailable in this browser. The route list still
            contains the Radar data.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

export function AttackGlobe({
  scene,
  motionEnabled,
  selectedRouteId,
}: AttackGlobeProps) {
  const { resolvedTheme } = useTheme()
  const [palette, setPalette] = useState<GlobePalette | null>(null)
  const [userRotation, setUserRotation] = useState<{
    routeId: string | null
    offset: number
  }>({ routeId: null, offset: 0 })
  const selectedArc = scene.arcs.find((arc) => arc.routeId === selectedRouteId)
  const userRotationOffset =
    userRotation.routeId === selectedRouteId ? userRotation.offset : 0
  const focusRotationOffset = getFocusRotationOffset(selectedArc)
  const rotationOffset = focusRotationOffset.longitude + userRotationOffset

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

    event.preventDefault()
    const direction = event.key === "ArrowLeft" ? 1 : -1
    setUserRotation((current) => ({
      routeId: selectedRouteId,
      offset:
        (current.routeId === selectedRouteId ? current.offset : 0) +
        direction * (Math.PI / 12),
    }))
  }

  useEffect(() => {
    if (!resolvedTheme) return

    const frame = requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement)
      setPalette({
        background: styles.getPropertyValue("--atlas-map-water").trim(),
        globe: styles.getPropertyValue("--atlas-map-sphere").trim(),
        emissive: styles.getPropertyValue("--atlas-map-water").trim(),
        atmosphere: styles.getPropertyValue("--atlas-map-glow").trim(),
        land: styles.getPropertyValue("--atlas-land").trim(),
        route: styles.getPropertyValue("--atlas-map-route").trim(),
        mutedRoute: styles.getPropertyValue("--atlas-map-route-muted").trim(),
        selectedRoute: styles
          .getPropertyValue("--atlas-map-selected-route")
          .trim(),
        ambient: styles.getPropertyValue("--atlas-map-ambient").trim(),
        globeHighlight: styles
          .getPropertyValue("--atlas-globe-highlight")
          .trim(),
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  return (
    <div
      role="group"
      aria-label="Interactive route map. Select a route in the list to highlight it. Focus the map and use the left or right arrow key, or drag, to rotate."
      aria-keyshortcuts="ArrowLeft ArrowRight"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="route-map-canvas relative h-full min-h-0 w-full overflow-hidden bg-transparent"
    >
      <GlobeErrorBoundary>
        {palette ? (
          <World
            globeConfig={globeConfig}
            palette={palette}
            scene={scene}
            motionEnabled={motionEnabled}
            selectedRouteId={selectedRouteId}
            rotationLatitudeOffset={focusRotationOffset.latitude}
            rotationOffset={rotationOffset}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <LoadingState
              variant="Orbit"
              label="Preparing globe…"
              showElapsed={false}
            />
          </div>
        )}
      </GlobeErrorBoundary>
    </div>
  )
}
