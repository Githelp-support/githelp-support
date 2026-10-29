/**
 * Guard for `?redirect=` style parameters before they reach
 * `router.push/replace` or are embedded into another URL.
 *
 * Next's app router performs a full navigation for absolute and
 * protocol-relative URLs, so an unvalidated `redirect=https://evil.example`
 * would turn a sign-in link into an open redirect. Only same-origin paths
 * are accepted: a single leading `/`, no `//`, no scheme, no backslashes
 * (browsers treat `/\evil.example` as protocol-relative) and no control
 * characters.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//")) return fallback
  if (value.includes("\\")) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}

/** Like `safeInternalPath`, but yields `null` instead of a fallback path. */
export function safeInternalPathOrNull(value: string | null | undefined): string | null {
  const path = safeInternalPath(value, "")
  return path.length > 0 ? path : null
}

const PENDING_REDIRECT_KEY = "pendingRedirect"

/**
 * Remember where the user was heading before being sent through onboarding,
 * so the wizard can land them there once it completes. Only safe internal
 * paths are stored.
 */
export function storePendingRedirect(path: string | null | undefined): void {
  const safe = safeInternalPathOrNull(path)
  if (!safe) return
  try {
    sessionStorage.setItem(PENDING_REDIRECT_KEY, safe)
  } catch {
    // Storage unavailable (private mode, disabled) — the redirect is simply lost.
  }
}

/** Read and clear the pending redirect; returns null when none is stored. */
export function consumePendingRedirect(): string | null {
  try {
    const stored = sessionStorage.getItem(PENDING_REDIRECT_KEY)
    if (stored !== null) sessionStorage.removeItem(PENDING_REDIRECT_KEY)
    return safeInternalPathOrNull(stored)
  } catch {
    return null
  }
}

export function clearPendingRedirect(): void {
  try {
    sessionStorage.removeItem(PENDING_REDIRECT_KEY)
  } catch {
    // ignore
  }
}
