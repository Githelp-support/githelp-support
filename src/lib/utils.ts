import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's default scales. Without this, it reads
 * `text-ui` as a text *colour* and drops it when a class like
 * `text-foreground` follows. Teach it the custom tokens from globals.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["text-2xs", "text-ui", "text-stat", "text-title", "text-display"],
      shadow: ["shadow-control", "shadow-soft", "shadow-popover", "shadow-modal", "shadow-tab"],
      duration: ["duration-fast", "duration-base", "duration-slow"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
