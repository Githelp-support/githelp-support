import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The sidebar collapse/expand glyph: a panel outline with the rail on the left.
 * Drawn in `currentColor` on a 24-unit grid, 20% larger than the sidebar menu
 * icons: a 19px box (`size-4.75`, 16px × 1.2 to the nearest px) with the glyph
 * about 17px wide, keeping the 7/8 glyph-to-box ratio `Icon` uses. The glyph
 * spans 19.75 units including its stroke, so the viewBox is cropped to 22.5
 * units (19.75 / 22.5 × 19 ≈ 17). The size lives here so every toggle is
 * identical; do not override it per call site.
 * Decorative by default (`aria-hidden`). `mirrored` flips it horizontally so
 * the rail sits on the right, for the right-hand sidebar.
 */
function SidebarToggleIcon({
  className,
  mirrored = false,
  ...props
}: React.ComponentProps<"svg"> & { mirrored?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-slot="sidebar-toggle-icon"
      viewBox="0.75 0.75 22.5 22.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4.75 shrink-0", mirrored && "-scale-x-100", className)}
      {...props}
    >
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <line x1="8" y1="8.5" x2="8" y2="15.5" />
    </svg>
  )
}

export { SidebarToggleIcon }
