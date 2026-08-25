import type { UserRole } from "@/contexts/user-context"

/**
 * The landing page for a given active role. Used wherever the app switches
 * role on the user's behalf (project switcher, invite acceptance) so all
 * paths land in the same place.
 */
export function homeRouteForRole(role: UserRole): string {
  if (role === "admin") return "/"
  if (role === "helper") return "/helper/overview"
  return "/support/tickets"
}
