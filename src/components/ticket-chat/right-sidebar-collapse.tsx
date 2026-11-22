"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"

const STORAGE_KEY = "sidebar:right:collapsed"

/**
 * Persist the right sidebar's collapsed state across navigations and views.
 * Read localStorage synchronously in the initializer so client-side
 * navigations render with the correct collapsed state immediately. On the
 * server `window` is undefined so we fall back to `false`; the sidebar
 * element should use `suppressHydrationWarning` so the server/client class
 * difference on first paint doesn't warn.
 */
export function useRightSidebarCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(collapsed))
      } catch {
        // Ignore localStorage write errors.
      }
    }
  }

  return { isCollapsed, setCollapsed }
}

/**
 * Toggle header row at the top of the collapsible right sidebar. Mirrors the
 * left sidebar's collapse affordance: the same `SidebarToggleIcon` panel
 * glyph in both the collapsed and expanded states, flipped horizontally
 * (`mirrored`) so its rail sits on the right edge.
 */
export function RightSidebarCollapseToggle({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean
  onToggle: (collapsed: boolean) => void
}) {
  return (
    // Below lg the panel is an off-canvas sheet; the desktop collapse toggle is hidden there.
    <div className={`${isCollapsed ? "justify-center px-0" : "justify-start px-4"} pt-4 pb-3 flex items-center min-h-[40px] shrink-0 max-lg:hidden`}>
      <Button
        variant="ghost"
        size="sm"
        // Expanded: pull the 32px button left by its 6px icon inset so the
        // 20px glyph lines up with the sidebar content's px-4 edge.
        className={`${isCollapsed ? "" : "-ml-1.5 "}h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30`}
        onClick={() => onToggle(!isCollapsed)}
      >
        <SidebarToggleIcon mirrored />
      </Button>
    </div>
  )
}

/**
 * The right panel's toggle for a page header's `actions`. From `lg` up it
 * collapses / expands the panel (same state and glyph as the in-panel
 * toggle); below `lg`, where the panel is an off-canvas sheet, it opens and
 * closes the sheet.
 */
export function RightSidebarHeaderToggle({
  isCollapsed,
  onToggle,
  mobileOpen,
  onMobileToggle,
}: {
  isCollapsed: boolean
  onToggle: (collapsed: boolean) => void
  mobileOpen: boolean
  onMobileToggle: () => void
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        suppressHydrationWarning
        className="max-lg:hidden text-text-muted"
        aria-label={isCollapsed ? "Show ticket details" : "Hide ticket details"}
        aria-expanded={!isCollapsed}
        onClick={() => onToggle(!isCollapsed)}
      >
        <SidebarToggleIcon mirrored />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden text-text-muted"
        aria-label="Ticket details"
        aria-expanded={mobileOpen}
        onClick={onMobileToggle}
      >
        <Icon name="fi-rr-sidebar-flip" />
      </Button>
    </>
  )
}
