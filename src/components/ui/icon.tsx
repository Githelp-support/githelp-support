import * as React from "react"

import { cn } from "@/lib/utils"

/** Box sizes in Tailwind spacing steps: 3 = 12px … 8 = 32px. 4 (16px) is the default. */
export type IconSize = 3 | 3.5 | 4 | 5 | 6 | 8

const sizeClass: Record<IconSize, string | undefined> = {
  3: "[--icon-size:0.75rem]",
  3.5: "[--icon-size:0.875rem]",
  4: undefined,
  5: "[--icon-size:1.25rem]",
  6: "[--icon-size:1.5rem]",
  8: "[--icon-size:2rem]",
}

export interface IconProps extends Omit<React.ComponentProps<"i">, "children"> {
  /** Full UIcons class, e.g. `fi-rr-check` (regular rounded) or `fi-brands-github`. */
  name: `fi-${string}`
  /** Box size; the glyph is drawn at 7/8 of it so it sits like a Lucide icon of the same box. */
  size?: IconSize
}

/**
 * A Flaticon UIcons glyph. The `.icon` rule in globals.css gives it a square box
 * of `--icon-size` (16px by default) and centres the glyph, so it drops into the
 * same flex gaps the Lucide icons used. For an odd size pass
 * `className="[--icon-size:18px]"`. Decorative by default (`aria-hidden`); pass
 * `aria-hidden={false}` plus `aria-label` when the icon is the only content.
 */
function Icon({ name, size = 4, className, ...props }: IconProps) {
  return <i aria-hidden="true" data-slot="icon" className={cn("icon fi", name, sizeClass[size], className)} {...props} />
}

export { Icon }
