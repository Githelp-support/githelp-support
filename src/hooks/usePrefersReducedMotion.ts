import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const mql = typeof window !== "undefined" ? window.matchMedia?.(QUERY) : undefined
  if (!mql?.addEventListener) return () => {}
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

const getSnapshot = () => (typeof window !== "undefined" && window.matchMedia?.(QUERY)?.matches) || false
const getServerSnapshot = () => false

/**
 * Whether the visitor asked for reduced motion. CSS animations and transitions
 * are already covered by the global rule in `globals.css`; use this for
 * choreography done in JS (e.g. a delayed reveal), which that rule can't reach.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
