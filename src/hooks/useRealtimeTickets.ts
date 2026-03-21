import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useRealtimeTickets(projectId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: projectId ? `project_id=eq.${projectId}` : undefined,
        },
        (payload) => {
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['tickets', projectId] })
          queryClient.invalidateQueries({ queryKey: ['tickets-with-details', projectId] })
          
          // If it's an update to a specific ticket, invalidate that too
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: ['ticket', payload.old?.id] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])
}

