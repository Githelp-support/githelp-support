import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface ProjectAdmin {
  user_id: string
  name: string | null
  email: string | null
  created_at: string
}

/** All non-deleted projects_members with role='admin', joined with users_public. */
export function useProjectAdmins(projectId?: string) {
  return useQuery({
    queryKey: ["project-admins", projectId],
    queryFn: async (): Promise<ProjectAdmin[]> => {
      if (!projectId) return []
      const { data, error } = await supabase
        .from("projects_members")
        .select("user_id, created_at, user:users_public(name, email)")
        .eq("project_id", projectId)
        .eq("role", "admin")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (error) throw error
      return (data || []).map((row: any) => ({
        user_id: row.user_id,
        created_at: row.created_at,
        name: row.user?.name ?? null,
        email: row.user?.email ?? null,
      }))
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
