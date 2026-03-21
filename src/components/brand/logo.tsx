import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  /** Optional link href; when set, logo is wrapped in Next Link */
  href?: string
  /** light = colored outer, white inner (default). dark = white outer, currentColor inner (e.g. dark header). */
  variant?: "light" | "dark"
}

/**
 * Githelp logo mark (three circles). Use on support layout, emails, etc.
 */
export function Logo({ className, href, variant = "light" }: LogoProps) {
  const outerFill = variant === "dark" ? "white" : "currentColor"
  const innerFill = variant === "dark" ? "currentColor" : "white"

  const svg = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill={outerFill} />
      <circle cx="19.8629" cy="11.0348" r="6.62069" fill={innerFill} />
      <circle cx="8.27613" cy="17.1043" r="3.86207" fill={innerFill} />
      <circle cx="16.5506" cy="23.1717" r="2.2069" fill={innerFill} />
    </svg>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2">
        {svg}
      </Link>
    )
  }

  return svg
}
