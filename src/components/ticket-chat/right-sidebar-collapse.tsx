"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
        // Expanded: pull the 32px button left by its 8px icon inset so the
        // 16px glyph lines up with the sidebar content's px-4 edge.
        aria-label={isCollapsed ? "Expand details panel" : "Collapse details panel"}
        className={`${isCollapsed ? "" : "-ml-2 "}h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30`}
        onClick={() => onToggle(!isCollapsed)}
      >
        <SidebarToggleIcon mirrored />
      </Button>
    </div>
  )
}
