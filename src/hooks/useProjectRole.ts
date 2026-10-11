import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { UserRole } from "@/contexts/user-context"

/**
 * Query options shared by `useProjectAvailableRoles` and imperative
 * `queryClient.fetchQuery` calls (e.g. resolving the highest role when
 * switching projects), so both hit the same cache entry.
 */
export function projectAvailableRolesQueryOptions(projectId?: string) {
  return {
    queryKey: ["project-available-roles", projectId] as const,
    queryFn: async (): Promise<UserRole[]> => {
      if (!projectId) return ["user"]

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return ["user"]

      const [{ data: memberData }, { data: helperData }] = await Promise.all([
        supabase
          .from("projects_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("projects_helpers")
          .select("helper_id")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle(),
      ])

      // Ordered highest → lowest so callers can take roles[0] as the top role.
      const roles: UserRole[] = []
      if (memberData?.role === "admin") roles.push("admin")
      if (helperData) roles.push("helper")
      roles.push("user")
      return roles
    },
    staleTime: 1800000,
  }
}

/**
 * Gets the roles the user actually holds in a specific project, for the role
 * switcher: "admin" if they are an admin member of the project, "helper" if
 * they are a helper in the project, and "user" always (any profile can act
 * as a support user).
 *
 * Keyed by project id — NOT by the per-page projectRole in user context,
 * which gets cleared/lowered on support pages and previously made roles
 * disappear from the switcher.
 */
export function useProjectAvailableRoles(projectId?: string) {
  return useQuery({
    ...projectAvailableRolesQueryOptions(projectId),
    enabled: !!projectId,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/**
 * Gets the set of role categories the user is ACTUALLY registered for
 * across all projects (not a hierarchy):
 * - "admin"  if any active projects_members row has role "admin"
 * - "helper" if any projects_helpers row exists for the user
 * - "user"   if any active projects_members row has a non-admin role,
 *            OR the user has created at least one ticket
 *
 * Falls back to ["user"] if the user is signed in but has no registrations.
 * Returns [] if not signed in.
 */
export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async (): Promise<UserRole[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const [
        { data: adminMemberships },
        { data: helperRows },
        { data: memberRows },
        { data: ticketRows },
      ] = await Promise.all([
        supabase
          .from("projects_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .is("deleted_at", null)
          .limit(1),
        supabase
          .from("projects_helpers")
          .select("helper_id")
          .eq("user_id", user.id)
          .limit(1),
        supabase
          .from("projects_members")
          .select("role")
          .eq("user_id", user.id)
          .neq("role", "admin")
          .is("deleted_at", null)
          .limit(1),
        supabase
          .from("tickets")
          .select("id")
          .eq("created_by", user.id)
          .limit(1),
      ])

      const roles: UserRole[] = []
      if (adminMemberships && adminMemberships.length > 0) roles.push("admin")
      if (helperRows && helperRows.length > 0) roles.push("helper")
      if (
        (memberRows && memberRows.length > 0) ||
        (ticketRows && ticketRows.length > 0)
      ) {
        roles.push("user")
      }

      return roles.length > 0 ? roles : ["user"]
    },
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/**
 * Gets the user's role in a project based on:
 * 1. projects_members table (admin or member)
 * 2. projects_helpers table (helper status)
 *
 * Returns the highest role: admin > helper > user
 */
export function useProjectRole(projectId?: string) {
  return useQuery({
    queryKey: ["project-role", projectId],
    queryFn: async (): Promise<UserRole> => {
      if (!projectId) return "user"

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return "user"

      // Check if user is admin in projects_members
      const { data: memberData } = await supabase
        .from("projects_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()

      if (memberData?.role === "admin") {
        return "admin"
      }

      // Check if user is a helper
      const { data: helperData } = await supabase
        .from("projects_helpers")
        .select("helper_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()

      if (helperData) {
        return "helper"
      }

      // If member but not admin or helper, return user role
      if (memberData) {
        return "user"
      }

      // Not a member at all, return user (default for visitors)
      return "user"
    },
    enabled: !!projectId,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

