/**
 * Sign-in URL with a redirect back. From a public support page the visitor is
 * a customer: `skipOnboarding=true` lands them back in the chat instead of the
 * project-creation wizard (see /auth/confirmed).
 */
export function signInHref(redirectTo: string, opts: { support?: boolean } = {}): string {
  const base = `/auth/signin?redirect=${encodeURIComponent(redirectTo)}`
  return opts.support ? `${base}&skipOnboarding=true` : base
}

export function isSupportRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === "/support" || pathname.startsWith("/support/") || pathname.startsWith("/support?"))
}

/**
 * Back to sign-in after a sign-in that didn't land (cancelled OAuth, still a
 * guest): keeps the original destination and the support-customer flag.
 */
export function signInRetryHref(redirectTo: string | null | undefined, skipOnboarding: boolean): string {
  if (!redirectTo) return skipOnboarding ? "/auth/signin?skipOnboarding=true" : "/auth/signin"
  return signInHref(redirectTo, { support: skipOnboarding })
}

export type AuthCallbackFailure = "cancelled" | "expired" | "wrong-browser" | "failed"

/** auth-js / GoTrue codes for a link that expired or was already used. */
const EXPIRED_CODES = new Set(["otp_expired", "flow_state_not_found", "flow_state_expired", "bad_code_verifier"])

/**
 * Why a sign-in callback (/auth/confirmed) produced no session, from its URL
 * and the client's start-up error code (`supabase.auth.initialize()`):
 * - "cancelled": the provider sign-in was cancelled (`error=access_denied`)
 *   — just go back to sign-in;
 * - "expired": the link expired or was already used (`otp_expired`, a used
 *   PKCE code) — request a new one;
 * - "wrong-browser": a `?code=` with no PKCE verifier in this browser (opened
 *   in another / an in-app browser) — open it where it was requested;
 * - "failed": any other OAuth error — try again;
 * - null: nothing in the URL (e.g. opened directly).
 */
export function authCallbackFailure(search: string, hash: string = "", initErrorCode?: string | null): AuthCallbackFailure | null {
  const query = new URLSearchParams(search.replace(/^\?/, ""))
  const fragment = new URLSearchParams(hash.replace(/^#/, ""))
  const get = (name: string) => query.get(name) ?? fragment.get(name)
  const error = get("error")
  if (error) {
    const code = get("error_code") ?? ""
    if (EXPIRED_CODES.has(code) || code.startsWith("otp")) return "expired"
    return error === "access_denied" ? "cancelled" : "failed"
  }
  if (!query.has("code")) return null
  // auth-js 2.108 skips a ?code= silently (no error) when this browser holds
  // no PKCE verifier, so "code, no session, no error" is the other-browser case.
  // A failed exchange without a code (network, 5xx) passes "unknown" → "failed".
  if (initErrorCode == null || initErrorCode === "pkce_code_verifier_not_found") return "wrong-browser"
  if (initErrorCode && EXPIRED_CODES.has(initErrorCode)) return "expired"
  return "failed"
}

/** What /auth/confirmed tells the visitor; never echoes URL text. */
export const AUTH_CALLBACK_FAILURE_COPY: Record<Exclude<AuthCallbackFailure, "cancelled">, { message: string; action: string }> = {
  expired: { message: "This sign-in link has expired or was already used.", action: "Request a new one." },
  "wrong-browser": {
    message: "This sign-in link has to be opened in the same browser where you requested it.",
    action: "Please request a new link here.",
  },
  failed: { message: "Sign-in didn\u2019t complete.", action: "Please try again." },
}

/**
 * Pages that run their own onboarding (accepting an invite / requesting to
 * join a project marks the user as onboarded). New accounts heading there
 * must not be diverted, e.g. into the generic wizard or an adoption landing.
 */
export const handlesOwnOnboarding = (path: string | null | undefined): boolean =>
  !!path && (path.startsWith("/invite/") || path.startsWith("/projects/"))

/** Sign-in page subtitle: visitors coming from a support page are customers, not admins/helpers. */
export function signInSubtitle(fromSupport: boolean): string {
  return fromSupport
    ? "Sign in to get help and follow your support conversations."
    : "Sign in to access your admin and helper dashboard"
}
