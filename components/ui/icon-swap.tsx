"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

type IconSwapProps = {
  state: string
  children: ReactNode
  className?: string
}

export function IconSwap({ state, children, className }: IconSwapProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return (
      <span aria-hidden="true" className={className}>
        {children}
      </span>
    )
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={state}
        aria-hidden="true"
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={className}
        exit={{ opacity: 0, scale: 0.8, y: -2 }}
        initial={{ opacity: 0, scale: 0.8, y: 2 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}
