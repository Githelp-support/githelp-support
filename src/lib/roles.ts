import type { UserRole } from "@/contexts/user-context"

/**
 * The landing page for a given active role. Used wherever the app switches
 * role on the user's behalf (project switcher, invite acceptance) so all
 * paths land in the same place.
 *
 * Users land on the Support page (`/support/chat`), which without params
 * redirects to their most recent active ticket or shows the project chooser.
 */
export function homeRouteForRole(role: UserRole): string {
  if (role === "admin") return "/"
  if (role === "helper") return "/helper/overview"
  return "/support/chat"
}

type ProjectRole = Exclude<UserRole, "user">

const lastProjectKey = (role: ProjectRole) => `lastProjectForRole:${role}`

/** Remember the project the account last worked in as `role`. */
export function rememberLastProjectForRole(role: ProjectRole, projectId: string): void {
  try {
    localStorage.setItem(lastProjectKey(role), projectId)
  } catch {
    // Storage unavailable — the fallbacks in pickProjectForRole still apply.
  }
}

export function getLastProjectForRole(role: ProjectRole): string | null {
  try {
    return localStorage.getItem(lastProjectKey(role))
  } catch {
    return null
  }
}

/**
 * Which project to open when switching into `admin` / `helper` from the
 * private User context: the project last used in that role if the account
 * still holds the role there, else the currently remembered project if it
 * qualifies, else the first qualifying project (`candidateIds` order).
 * Returns null when the account holds the role nowhere.
 */
export function pickProjectForRole(
  candidateIds: string[],
  lastUsedId: string | null,
  selectedId: string | null,
): string | null {
  if (lastUsedId && candidateIds.includes(lastUsedId)) return lastUsedId
  if (selectedId && candidateIds.includes(selectedId)) return selectedId
  return candidateIds[0] ?? null
}
