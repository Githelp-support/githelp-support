import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface ProjectAdmin {
  user_id: string
  name: string | null
  email: string | null
  created_at: string
}

/**
 * All non-deleted projects_members with role='admin'.
 *
 * projects_members.user_id is a FK to auth.users (not users_public), so
 * PostgREST can't auto-embed users_public via the relationship graph. We
 * fetch the member rows and then look up the matching users_public rows
 * separately.
 */
export function useProjectAdmins(projectId?: string) {
  return useQuery({
    queryKey: ["project-admins", projectId],
    queryFn: async (): Promise<ProjectAdmin[]> => {
      if (!projectId) return []
      const { data: members, error: membersError } = await supabase
        .from("projects_members")
        .select("user_id, created_at")
        .eq("project_id", projectId)
        .eq("role", "admin")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (membersError) throw membersError
      if (!members || members.length === 0) return []

      const userIds = members.map((m) => m.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from("users_public")
        .select("id, name, email")
        .in("id", userIds)

      if (profilesError) throw profilesError
      const byId = new Map((profiles || []).map((p: any) => [p.id, p]))

      return members.map((m) => {
        const profile = byId.get(m.user_id)
        return {
          user_id: m.user_id,
          created_at: m.created_at,
          name: profile?.name ?? null,
          email: profile?.email ?? null,
        }
      })
    },
    enabled: !!projectId,
    staleTime: 60_000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/**
 * Update a project member's role to 'admin'. RLS requires the caller is
 * already an admin (`projects_members_update_admins` + `_insert_admins`
 * policies). We try UPDATE first and fall back to INSERT only when no row
 * exists — using upsert hides RLS denials behind 0-rows-affected.
 */
export function usePromoteToAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: string
      userId: string
    }) => {
      const { data: updated, error: updateError } = await supabase
        .from("projects_members")
        .update({
          role: "admin",
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .select("user_id")

      if (updateError) throw updateError

      if (!updated || updated.length === 0) {
        // No matching row — either the user isn't a member yet, or RLS hid it.
        // Try an insert; if RLS denies that too, the error surfaces.
        const { data: inserted, error: insertError } = await supabase
          .from("projects_members")
          .insert({
            project_id: projectId,
            user_id: userId,
            role: "admin",
          })
          .select("user_id")

        if (insertError) throw insertError
        if (!inserted || inserted.length === 0) {
          throw new Error(
            "Promotion did not apply. You may not have admin permissions on this project.",
          )
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-admins", vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ["helpers", vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ["user-projects"] })
    },
  })
}
