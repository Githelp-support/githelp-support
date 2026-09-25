"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronsLeft, ChevronRight } from "lucide-react"

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
 * left sidebar's collapse affordance: ChevronRight collapses (points toward
 * the right edge), ChevronsLeft expands.
 */
export function RightSidebarCollapseToggle({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean
  onToggle: (collapsed: boolean) => void
}) {
  return (
    <div className={`${isCollapsed ? "justify-center px-0" : "justify-start px-4"} pt-4 pb-3 flex items-center min-h-[40px] shrink-0`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        onClick={() => onToggle(!isCollapsed)}
      >
        {isCollapsed ? <ChevronsLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </Button>
    </div>
  )
}
