"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Right-sidebar primitives shared by the customer chat (`TicketChat` +
 * `CustomerTicketSidebarFooter`) and the helper ticket page, so every section
 * ("People in this chat", "Other topics", "Logged time", "Active tickets")
 * has the same heading and separator treatment.
 */

const HEADING_STYLE = {
  fontSize: "11px",
  letterSpacing: "0.05em",
  color: "rgba(0,0,0,0.5)",
  fontWeight: 500,
} as const

export function SidebarSectionHeading({
  children,
  info = false,
  className,
}: {
  children: ReactNode
  /** Show the small info icon next to the heading. */
  info?: boolean
  className?: string
}) {
  if (info) {
    return (
      <div className={cn("flex items-center gap-2 mb-3", className)}>
        <h3 className="uppercase leading-none" style={HEADING_STYLE}>
          {children}
        </h3>
        <Info className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    )
  }
  return (
    <h3 className={cn("mb-3 uppercase", className)} style={HEADING_STYLE}>
      {children}
    </h3>
  )
}

/** Full-bleed separator between sidebar sections (cancels the sidebar's pl-5 / pr-4). */
export function SidebarDivider() {
  return <div className="border-t border-border my-6 -ml-5 -mr-4" />
}

/** Placeholder for an empty section ("-" / "Loading..."). */
export function SidebarEmpty({ children = "-" }: { children?: ReactNode }) {
  return <div className="text-center text-muted-foreground text-[13px] py-4">{children}</div>
}
