"use client"

import { useEffect, useState } from "react"
import { Check, RefreshCw } from "lucide-react"
import { IconSwap } from "@/components/ui/icon-swap"

type Status = "idle" | "loading" | "success"

type StatusButtonProps = {
  ariaLabel: string
  className: string
  onClick: () => Promise<void>
}

export function StatusButton({
  ariaLabel,
  className,
  onClick,
}: StatusButtonProps) {
  const [status, setStatus] = useState<Status>("idle")

  useEffect(() => {
    if (status !== "success") return

    const timeout = window.setTimeout(() => setStatus("idle"), 1800)
    return () => window.clearTimeout(timeout)
  }, [status])

  const handleClick = () => {
    if (status !== "idle") return

    setStatus("loading")
    void Promise.resolve()
      .then(onClick)
      .then(
        () => setStatus("success"),
        () => setStatus("idle")
      )
  }

  const label =
    status === "success"
      ? "Refreshed"
      : status === "loading"
        ? "Refreshing"
        : "Refresh"

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={status === "loading"}
      aria-disabled={status !== "idle"}
      className={className}
    >
      <IconSwap
        state={status}
        className="inline-flex size-16 shrink-0 items-center justify-center"
      >
        {status === "success" ? (
          <Check aria-hidden="true" className="size-16 shrink-0" />
        ) : (
          <RefreshCw
            aria-hidden="true"
            className={`size-16 shrink-0 ${status === "loading" ? "motion-safe:animate-spin" : ""}`}
          />
        )}
      </IconSwap>
      <span aria-live="polite" aria-atomic="true">
        {label}
      </span>
    </button>
  )
}
