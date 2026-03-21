import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface ProjectKeyword {
  id: number
  value: string
  project_id: number | string
}

export interface HelperKeywordRow {
  project_keyword_id: number
  user_id: string
  helper_id: string
}

/** Fetch project keywords for a project (by project_id uuid) */
export function useProjectKeywords(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-keywords", projectId],
    queryFn: async () => {
      if (!projectId) return []

      const { data, error } = await supabase
        .from("projects_keywords")
        .select("id, value, project_id")
        .eq("project_id", projectId)
        .order("value")

      if (error) throw error
      return (data || []) as ProjectKeyword[]
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/** Fetch helper's selected keyword IDs for a project */
export function useHelperKeywords(helperId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["helper-keywords", helperId, projectId],
    queryFn: async () => {
      if (!helperId || !projectId) return []

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      const { data: projectKeywords } = await supabase
        .from("projects_keywords")
        .select("id")
        .eq("project_id", projectId)

      const projectKeywordIds = new Set((projectKeywords || []).map((k: any) => k.id))
      if (projectKeywordIds.size === 0) return []

      const { data, error } = await supabase
        .from("projects_helpers_keywords")
        .select("project_keyword_id")
        .eq("helper_id", helperId)
        .eq("user_id", user.id)
        .in("project_keyword_id", Array.from(projectKeywordIds))

      if (error) throw error

      return (data || []).map((r: any) => r.project_keyword_id) as number[]
    },
    enabled: !!helperId && !!projectId,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/** Create a project keyword */
export function useCreateProjectKeyword(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (value: string) => {
      if (!projectId) throw new Error("Project ID required")

      const { data, error } = await supabase
        .from("projects_keywords")
        .insert({ project_id: projectId, value })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-keywords", projectId] })
    },
  })
}

/** Delete a project keyword */
export function useDeleteProjectKeyword(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (keywordId: number) => {
      const { error } = await supabase
        .from("projects_keywords")
        .delete()
        .eq("id", keywordId)

      if (error) throw error
      return { keywordId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-keywords", projectId] })
      queryClient.invalidateQueries({ queryKey: ["helper-keywords"] })
    },
  })
}

/** Fetch project help categories */
export function useProjectHelpCategories(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-help-categories", projectId],
    queryFn: async () => {
      if (!projectId) return []

      const { data, error } = await supabase
        .from("projects_help_categories")
        .select("id, value, type")
        .eq("project_id", projectId)
        .order("value")

      if (error) throw error
      return (data || []) as { id: number; value: string; type: string }[]
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

/** Create a project help category */
export function useCreateProjectHelpCategory(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ value, type = "default" }: { value: string; type?: string }) => {
      if (!projectId) throw new Error("Project ID required")

      const { data, error } = await supabase
        .from("projects_help_categories")
        .insert({ project_id: projectId, value, type })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-help-categories", projectId] })
    },
  })
}

/** Delete a project help category */
export function useDeleteProjectHelpCategory(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryId: number) => {
      const { error } = await supabase
        .from("projects_help_categories")
        .delete()
        .eq("id", categoryId)

      if (error) throw error
      return { categoryId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-help-categories", projectId] })
    },
  })
}

/** Set helper's keywords (replaces existing selection for the project) */
export function useSetHelperKeywords(helperId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      keywordIds,
      projectId,
    }: {
      keywordIds: number[]
      projectId: string
    }) => {
      if (!helperId || !userId) throw new Error("Helper ID and user ID required")

      // Delete existing helper keywords for this project's keywords
      const { data: projectKeywords } = await supabase
        .from("projects_keywords")
        .select("id")
        .eq("project_id", projectId)

      const projectKeywordIds = (projectKeywords || []).map((k: any) => k.id)

      if (projectKeywordIds.length > 0) {
        await supabase
          .from("projects_helpers_keywords")
          .delete()
          .eq("helper_id", helperId)
          .eq("user_id", userId)
          .in("project_keyword_id", projectKeywordIds)
      }

      // Insert new selections
      if (keywordIds.length > 0) {
        const rows = keywordIds.map((project_keyword_id) => ({
          project_keyword_id,
          user_id: userId,
          helper_id: helperId,
        }))

        const { error } = await supabase.from("projects_helpers_keywords").insert(rows)
        if (error) throw error
      }

      return { keywordIds }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["helper-keywords", helperId, variables.projectId],
      })
      queryClient.invalidateQueries({ queryKey: ["helper", helperId] })
      queryClient.invalidateQueries({ queryKey: ["helpers"] })
    },
  })
}
