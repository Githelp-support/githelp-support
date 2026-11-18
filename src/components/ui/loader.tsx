import * as React from "react"

import { cn } from "@/lib/utils"

export interface LoaderProps extends Omit<React.ComponentProps<"svg">, "children" | "width" | "height"> {
  /** Rendered width and height in px (default 32). Keep `Loader2` for spinners under 20px. */
  size?: number
  /** Accessible name announced by screen readers (default "Loading"). */
  label?: string
}

/**
 * Keyframes and motion rules travel with the SVG so the loader works wherever it
 * is dropped in. The mark stays hidden for 180ms, so loads that finish quickly
 * never flash it, then fades in while the three dots orbit the centre. Only
 * `transform` and `opacity` animate.
 */
const LOADER_CSS = `
@keyframes githelp-loader-orbit { to { transform: rotate(360deg); } }
@keyframes githelp-loader-in { from { opacity: 0; } to { opacity: 1; } }
.githelp-loader { animation: githelp-loader-in 150ms ease-out 180ms both; }
.githelp-loader-dots { transform-origin: 16px 16px; animation: githelp-loader-orbit 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
@media (prefers-reduced-motion: reduce) { .githelp-loader-dots { animation: none; } }
`

/**
 * Animated Githelp logo mark for page- and section-level loading. Colour comes
 * from `currentColor` (e.g. `text-brand-primary`); the dots are cut out of the
 * disc with a mask, so whatever is behind the loader shows through. Place it in
 * a `role="status"` container so the loading state is announced.
 */
function Loader({ size = 32, label = "Loading", className, ...props }: LoaderProps) {
  const maskId = `loader-mask-${React.useId()}`

  return (
    <svg
      data-slot="loader"
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("githelp-loader shrink-0", className)}
      {...props}
    >
      <style>{LOADER_CSS}</style>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="white" />
        <g className="githelp-loader-dots" fill="black">
          <circle cx="19.8629" cy="11.0348" r="6.62069" />
          <circle cx="8.27613" cy="17.1043" r="3.86207" />
          <circle cx="16.5506" cy="23.1717" r="2.2069" />
        </g>
      </mask>
      <circle cx="16" cy="16" r="16" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

export { Loader }
