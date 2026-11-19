import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The guest glyph (`githelp-guest-ghost-face.svg`), drawn in `currentColor`.
 * The eyes and mouth are cut-outs (`evenodd`), so whatever is behind the icon
 * shows through them. Decorative: it always sits next to the guest's name.
 */
function GuestGhostIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      data-slot="guest-ghost-icon"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 256a240 240 0 0 1 480 0v214q-30 44-60 0q-30-44-60 0q-30 44-60 0q-30-44-60 0q-30 44-60 0q-30-44-60 0q-30 44-60 0q-30-44-60 0zM232.9 215.0a106 106 0 1 0 212 0a106 106 0 1 0 -212 0zM67.1 215.0a62 62 0 1 0 124 0a62 62 0 1 0 -124 0zM165.3 362.0a36 36 0 1 0 72 0a36 36 0 1 0 -72 0z"
      />
    </svg>
  )
}

export { GuestGhostIcon }
