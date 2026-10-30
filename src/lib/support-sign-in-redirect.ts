import { useSyncExternalStore } from "react"

/**
 * Where "Sign in" on a support page should return to. The chat pages publish
 * it; every sign-in entry point there (guest banner, chat intro, sidebar,
 * top bar) uses it, so a guest with an open ticket comes back to that
 * conversation (now theirs after adoption) instead of the welcome screen,
 * where they might open a second ticket.
 */
export function chooseSupportSignInRedirect(opts: {
  ticketId?: string | null
  projectId?: string | null
  fallback: string
}): string {
  const { ticketId, projectId, fallback } = opts
  if (ticketId && projectId) {
    return `/support/chat?ticket=${encodeURIComponent(ticketId)}&project=${encodeURIComponent(projectId)}`
  }
  if (projectId) return `/support/chat?project=${encodeURIComponent(projectId)}`
  return fallback
}

let current: string | null = null
const listeners = new Set<() => void>()

/** Published by the support chat pages (null when they unmount). */
export function setSupportSignInRedirect(path: string | null): void {
  if (path === current) return
  current = path
  listeners.forEach((listener) => listener())
}

export function getSupportSignInRedirect(): string | null {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The redirect a support chat page published, if any. */
export function useSupportSignInRedirect(): string | null {
  return useSyncExternalStore(subscribe, getSupportSignInRedirect, () => null)
}
