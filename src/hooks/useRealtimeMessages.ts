import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useRealtimeMessages(ticketId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async () => {
          // Cancel an in-flight fetch so the invalidation actually refetches
          // (a pending fetch with no data yet would otherwise be reused).
          await queryClient.cancelQueries({ queryKey: ['ticket-messages', ticketId] })
          // Invalidate messages query to refetch
          queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
          // Also invalidate ticket details to update message count
          queryClient.invalidateQueries({ queryKey: ['tickets-with-details'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient])
}

