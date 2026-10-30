/**
 * Guests (Supabase anonymous sign-in, `user.is_anonymous === true`) have a
 * real session so they can open a ticket on a public support page, but they
 * are NOT signed in anywhere else: protected routes send them to sign-in,
 * the header shows "Sign in", onboarding never runs for them. Every check
 * that decides "is this person signed in?" goes through these helpers.
 */

interface MaybeAnonymousUser {
  id?: string
  is_anonymous?: boolean | null
}

interface MaybeSession {
  user?: MaybeAnonymousUser | null
}

/** True for a Supabase anonymous (guest) user. */
export function isAnonymousUser(user: MaybeAnonymousUser | null | undefined): boolean {
  return !!user && user.is_anonymous === true
}

/** A real (non-anonymous) user. */
export function isSignedInUser<T extends MaybeAnonymousUser>(user: T | null | undefined): user is T {
  return !!user && !!user.id && !isAnonymousUser(user)
}

/** The session belongs to a real (non-anonymous) user. */
export function hasSignedInSession(session: MaybeSession | null | undefined): boolean {
  return isSignedInUser(session?.user)
}

/** The session belongs to an anonymous guest. */
export function hasGuestSession(session: MaybeSession | null | undefined): boolean {
  return !!session?.user?.id && isAnonymousUser(session.user)
}
