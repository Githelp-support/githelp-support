import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { UserRole } from "@/contexts/user-context"

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

