"use client"

import * as React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface GuestNameProps {
  /** The guest's label from `guestLabel` (email, "Guest · a1b2" or "Guest"). */
  label: string
  /** Full email or identifier, shown in a tooltip when the label doesn't show all of it. */
  full?: string | null
  className?: string
}

/**
 * A guest's name: regular weight in the muted text colour (signed-in users'
 * names stay medium and dark), truncated to one line. The tooltip opens only
 * when the label is cut off or is a shortened identifier.
 */
function GuestName({ label, full, className }: GuestNameProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)

  const name = (
    <span
      ref={ref}
      data-slot="guest-name"
      className={cn("block min-w-0 truncate font-normal text-muted-foreground", className)}
    >
      {label}
    </span>
  )

  if (!full) return name

  const handleOpenChange = (next: boolean) => {
    const el = ref.current
    const truncated = !!el && el.scrollWidth > el.clientWidth
    setOpen(next && (full !== label || truncated))
  }

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>{name}</TooltipTrigger>
      <TooltipContent className="break-all">{full}</TooltipContent>
    </Tooltip>
  )
}

export { GuestName }
