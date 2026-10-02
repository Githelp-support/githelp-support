import { supabase } from "@/lib/supabase/client"
import { signInWithGitHub } from "@/lib/supabase/auth"

/**
 * GitHub verification for claiming a repository: the server checks that the
 * user's GitHub token has admin/maintain permission on it.
 *
 * Supabase keeps `provider_token` on the session from whatever provider the
 * user last signed in with, so a token is only trusted right after a GitHub
 * verification round-trip that this page started (a sessionStorage marker
 * set before redirecting). Otherwise a stale token, or one from another
 * provider, would be sent and the claim would fail with no way to switch
 * accounts.
 */
const MARKER = "githelp.github-verification"
const MARKER_TTL_MS = 10 * 60_000

function readMarker(): { at: number } | null {
  try {
    const raw = window.sessionStorage.getItem(MARKER)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number }
    return typeof parsed.at === "number" ? { at: parsed.at } : null
  } catch {
    return null
  }
}

function setMarker() {
  try {
    window.sessionStorage.setItem(MARKER, JSON.stringify({ at: Date.now() }))
  } catch { /* storage unavailable: the user just verifies again */ }
}

/** Forget the round-trip marker (after the token was used once). */
export function clearGithubVerification() {
  try {
    window.sessionStorage.removeItem(MARKER)
  } catch { /* ignore */ }
}

/** True when we just came back from a GitHub verification this page started. */
export function justVerifiedWithGithub(): boolean {
  const marker = readMarker()
  return !!marker && Date.now() - marker.at < MARKER_TTL_MS
}

/** The fresh GitHub token from the verification round-trip, or null. */
export async function currentGithubToken(): Promise<string | null> {
  if (!justVerifiedWithGithub()) return null
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session?.provider_token) return null
  const hasGithub = session.user.app_metadata?.provider === "github" ||
    (session.user.identities ?? []).some((i) => i.provider === "github")
  return hasGithub ? session.provider_token : null
}

/**
 * Send the user through GitHub and back to `returnPath` (a same-site path).
 * Signed-in users without a GitHub identity link one; everyone else signs in
 * with GitHub. `differentAccount` asks GitHub to show the consent screen again
 * (to switch accounts, the user may also need to sign out of github.com).
 */
export async function startGithubVerification(returnPath: string, opts: { differentAccount?: boolean } = {}): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  const confirmPath = `/auth/confirmed?redirect=${encodeURIComponent(returnPath)}&skipOnboarding=true&githubVerify=1`
  const hasGithub = (session?.user.identities ?? []).some((i) => i.provider === "github")
  setMarker()
  if (session && !hasGithub) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "github",
      options: { scopes: "repo read:user read:org", redirectTo: window.location.origin + confirmPath },
    })
    if (error) {
      clearGithubVerification()
      throw error
    }
    return
  }
  try {
    await signInWithGitHub(confirmPath, opts.differentAccount ? { skipCache: true } : {})
  } catch (e) {
    clearGithubVerification()
    throw e
  }
}
