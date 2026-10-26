"use client"

import { useEffect, useState, type CSSProperties } from "react"

const chevron = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3)
  const column = index % 3
  return (column + Math.abs(row - 1)) * 90
})

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3]
const orbit = Array.from({ length: 9 }, (_, index) => {
  const position = ORBIT_ORDER.indexOf(index)
  return position === -1 ? null : position * 110
})

type LoadingVariant = "Drive" | "Dots" | "Orbit" | "Surfer"

type LoadingPattern = {
  delays: Array<number | null>
  duration: number
  rounded: boolean
}

const PATTERNS: Record<LoadingVariant, LoadingPattern> = {
  Drive: { delays: chevron, duration: 650, rounded: false },
  Dots: { delays: chevron, duration: 650, rounded: true },
  Orbit: { delays: orbit, duration: 950, rounded: false },
  Surfer: { delays: chevron, duration: 650, rounded: false },
}

type PixelStyle = CSSProperties & {
  "--loading-duration"?: string
  "--loading-delay"?: string
}

function LoaderGrid({ delays, duration, rounded }: LoadingPattern) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
    >
      {delays.map((delay, index) => {
        const style: PixelStyle | undefined =
          delay === null
            ? undefined
            : {
                "--loading-duration": `${duration}ms`,
                "--loading-delay": `${delay}ms`,
              }

        return (
          <span
            key={index}
            className={`loading-pixel size-[4px] bg-atlas-main ${rounded ? "rounded-full" : "rounded-[1px]"} ${delay === null ? "loading-pixel-static" : ""}`}
            style={style}
          />
        )
      })}
    </span>
  )
}

function useElapsed() {
  const [deciseconds, setDeciseconds] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDeciseconds((elapsed) => elapsed + 1)
    }, 100)

    return () => window.clearInterval(timer)
  }, [])

  const total = deciseconds / 10
  if (total < 60) return `${total.toFixed(1)}s`
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`
}

function ElapsedTime() {
  const elapsed = useElapsed()

  return (
    <span
      aria-hidden="true"
      className="font-mono text-xs text-atlas-secondary tabular-nums"
    >
      {elapsed}
    </span>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<
    boolean | null
  >(null)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(preference.matches)

    updatePreference()
    preference.addEventListener("change", updatePreference)

    return () => preference.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

function SurferVideo({ src }: { src: string }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [videoOk, setVideoOk] = useState(true)
  const showVideo = videoOk && prefersReducedMotion === false
  const fallbackLabel = !videoOk
    ? "Video unavailable"
    : prefersReducedMotion
      ? "Video paused for reduced motion"
      : "Preparing video"

  return (
    <div
      aria-hidden="true"
      className="loading-video-card mt-2 w-56 overflow-hidden rounded-[10px] shadow-md"
    >
      <div className="relative aspect-video w-full bg-atlas-panel">
        {showVideo ? (
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
            <LoaderGrid {...PATTERNS.Drive} />
            <span className="px-3 text-center font-mono text-[10px] text-atlas-secondary">
              {fallbackLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoadingState({
  label,
  variant = "Drive",
  videoSrc = "https://95dnc2a95qgwt9ff.public.blob.vercel-storage.com/subway-surfers-min.mp4",
  announce = true,
  showElapsed = true,
}: {
  label?: string
  variant?: LoadingVariant
  videoSrc?: string
  announce?: boolean
  showElapsed?: boolean
}) {
  const surfer = variant === "Surfer"
  const resolvedLabel = label ?? (surfer ? "Subway surfing" : "Churning")
  const pattern = PATTERNS[variant]

  const labelElement = (
    <span className="loading-label bg-clip-text text-[13px] font-medium">
      {resolvedLabel}
    </span>
  )
  const elapsedElement = showElapsed ? <ElapsedTime /> : null

  if (surfer) {
    return (
      <div
        role={announce ? "status" : undefined}
        className="flex w-fit flex-col items-start"
      >
        <div className="flex items-center gap-2.5">
          <LoaderGrid {...PATTERNS.Drive} />
          {labelElement}
          {elapsedElement}
        </div>

        <SurferVideo src={videoSrc} />
      </div>
    )
  }

  return (
    <div
      role={announce ? "status" : undefined}
      className="flex w-fit items-center gap-2.5"
    >
      <LoaderGrid {...pattern} />
      {labelElement}
      {elapsedElement}
    </div>
  )
}
