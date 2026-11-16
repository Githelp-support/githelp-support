import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The sidebar collapse/expand glyph: a panel outline with the rail on the left.
 * Drawn in `currentColor` in a 20px box, so it sits like `<Icon size={5} />`.
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
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5 shrink-0", mirrored && "-scale-x-100", className)}
      {...props}
    >
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.5" />
      <path d="M7.75 3.75v12.5" />
    </svg>
  )
}

export { SidebarToggleIcon }
