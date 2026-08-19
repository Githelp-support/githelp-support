import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

/**
 * Subscribe to changes on a single `tickets` row and refresh the queries that
 * render it. Status flips (claimed → in-progress → completed/cancelled) are
 * what drive the customer's end-of-session summary and the helper's gate, so
 * without this the page only catches up on a manual refresh. Also nudges the
 * payment-status query, since a status change usually coincides with a hold
 * being placed or captured.
 */
export function useRealtimeTicket(ticketId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const channel = supabase
      .channel(`ticket-row-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
          queryClient.invalidateQueries({ queryKey: ['ticket-with-details', ticketId] })
          queryClient.invalidateQueries({ queryKey: ['ticket-payment-status', ticketId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient])
}
