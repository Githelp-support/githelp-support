"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface TabOption<T = string> {
  value: T
  label: string
}

interface TabSelectorProps<T = string> {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Segmented tabs on a subtle track. A single active indicator (the raised
 * white pill with GitHelp's grey-blue glow) slides between items; the items
 * themselves only change text colour.
 */
export function TabSelector<T = string>({ options, value, onChange, className }: TabSelectorProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const activeIndex = options.findIndex((o) => o.value === value)

  // Measure the active tab so the indicator can move with a transform.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || activeIndex < 0) return
    const tabs = track.querySelectorAll<HTMLButtonElement>("[role='tab']")
    const el = tabs[activeIndex]
    if (!el) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeIndex, options.length])

  return (
    <div
      ref={trackRef}
      role="tablist"
      className={cn("relative inline-flex gap-1 rounded-md bg-bg-subtle p-0.5", className)}
    >
      {indicator && (
        <span
          aria-hidden="true"
          data-slot="tab-indicator"
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-md border border-border bg-background shadow-tab transition-[transform,width] duration-base ease-out"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      )}
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={cn(
              "relative z-10 inline-flex h-7 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 text-ui transition-colors duration-fast ease-out outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
              isSelected
                ? "font-medium text-foreground"
                : "font-normal text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
