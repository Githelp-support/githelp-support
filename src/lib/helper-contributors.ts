/**
 * Decides which repository contributors can still be invited as helpers.
 *
 * A contributor is excluded when a helper invite for their GitHub login is
 * still pending or has been accepted, or when they are already a helper.
 * Revoked invites that were never used do not exclude anyone, so the
 * contributor can be re-invited.
 */

export interface ExcludableInvite {
  github_username: string | null
  is_active: boolean
  uses_count: number
}

export interface ExcludableHelper {
  user?: { username?: string | null } | null
}

export function getExcludedGithubLogins<I extends ExcludableInvite>(
  invites: readonly I[] | undefined,
  helpers: readonly ExcludableHelper[] | undefined,
  isPending: (invite: I) => boolean
): Set<string> {
  const excluded = new Set<string>()

  for (const invite of invites ?? []) {
    if (!invite.github_username) continue
    const accepted = invite.uses_count > 0
    if (accepted || isPending(invite)) {
      excluded.add(invite.github_username.toLowerCase())
    }
  }

  for (const helper of helpers ?? []) {
    const login = helper.user?.username
    if (login) excluded.add(login.toLowerCase())
  }

  return excluded
}

export function getAvailableContributors<T extends { login: string }>(
  contributors: readonly T[],
  excludedLogins: ReadonlySet<string>
): T[] {
  if (excludedLogins.size === 0) return [...contributors]
  return contributors.filter((c) => !excludedLogins.has(c.login.toLowerCase()))
}
