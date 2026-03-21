import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function usePendingRequests(projectId?: string) {
  return useQuery({
    queryKey: ['pending-requests', projectId],
    queryFn: async () => {
      let query = supabase
        .from('pending_user_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
    enabled: !!projectId,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function useCreatePendingRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
    }: {
      projectId: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error("User must be authenticated to request helper status")
      }

      // Get user profile for name and email
      const { data: userProfile } = await supabase
        .from('users_public')
        .select('name, email')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('pending_user_requests')
        .insert({
          user_id: user.id,
          project_id: projectId,
          name: userProfile?.name || user.email || 'Unknown',
          email: userProfile?.email || user.email || '',
          role: 'member',
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests', data.project_id] })
    },
  })
}

export function useUpdatePendingRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      projectId,
      status,
    }: {
      userId: string
      projectId: string
      status: 'accepted' | 'rejected'
    }) => {
      const updates: any = { status }
      if (status === 'accepted') {
        updates.accepted_at = new Date().toISOString()
      } else {
        updates.rejected_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('pending_user_requests')
        .update(updates)
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests', data.project_id] })
    },
  })
}

