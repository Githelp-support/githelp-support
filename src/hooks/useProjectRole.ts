import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { UserRole } from "@/contexts/user-context"

/**
 * Gets the user's HIGHEST role across all their projects.
 *
 * This is independent of the currently selected project, so it can be used
 * to determine which roles a profile is permitted to assume in the role
 * switcher — even when the active page has temporarily cleared/changed the
 * per-project role (e.g. on support pages where the user acts as "user").
 *
 * Returns the highest role: admin > helper > user, or null if not signed in.
 */
export function useUserMaxRole() {
  return useQuery({
    queryKey: ["user-max-role"],
    queryFn: async (): Promise<UserRole | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Check if user is an admin in any project
      const { data: adminMemberships } = await supabase
        .from("projects_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .is("deleted_at", null)
        .limit(1)

      if (adminMemberships && adminMemberships.length > 0) {
        return "admin"
      }

      // Check if user is a helper in any project
      const { data: helperRows } = await supabase
        .from("projects_helpers")
        .select("helper_id")
        .eq("user_id", user.id)
        .limit(1)

      if (helperRows && helperRows.length > 0) {
        return "helper"
      }

      // Check if user is a member of any project
      const { data: memberRows } = await supabase
        .from("projects_members")
        .select("role")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)

      if (memberRows && memberRows.length > 0) {
        return "user"
      }

      // Not a project member at all
      return null
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

