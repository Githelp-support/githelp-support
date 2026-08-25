import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { refetchTicketParticipants } from '@/hooks/useTicketParticipants'

/**
 * Subscribe to changes on a single `tickets` row and refresh the queries that
 * render it. Status flips (claimed → in-progress → completed/cancelled) are
 * what drive the customer's end-of-session summary and the helper's gate, so
 * without this the page only catches up on a manual refresh. Also nudges the
 * payment-status query, since a status change usually coincides with a hold
 * being placed or captured.
 *
 * A claim also inserts a `tickets_participants` row and the helper logs
 * `tickets_time_entries` during the session, both of which the customer
 * renders ("People in this chat", "Logged time"). Neither is otherwise
 * refreshed on the customer side, so:
 *  - every `tickets` UPDATE also invalidates participants + time entries
 *    (a claim always flips the status, so this alone covers the claim), and
 *  - the channel additionally listens on those two tables for this ticket, so
 *    time logged mid-session shows up live. Those listeners only deliver if
 *    the tables are in the `supabase_realtime` publication (see the
 *    `tickets_participants_time_entries_realtime` migration); otherwise they
 *    are harmless no-ops and the UPDATE fallback still applies.
 */
export function useRealtimeTicket(ticketId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const invalidateParticipants = () => {
      void refetchTicketParticipants(queryClient, ticketId)
    }

    // `useTimeEntries` keys are ["time-entries", helperId, ticketId, projectId, start, end];
    // match on the ticket slot rather than refetching every time-entries query.
    const invalidateTimeEntries = () =>
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'time-entries' && q.queryKey[2] === ticketId,
      })

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
          invalidateParticipants()
          invalidateTimeEntries()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets_participants',
          filter: `ticket_id=eq.${ticketId}`,
        },
        invalidateParticipants,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets_time_entries',
          filter: `ticket_id=eq.${ticketId}`,
        },
        invalidateTimeEntries,
      )
      .subscribe((status, err) => {
        // Surface a failed join: a CHANNEL_ERROR here means none of the
        // above bindings deliver, which is otherwise indistinguishable from
        // "nothing changed" in the UI.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[realtime] ticket-row-${ticketId} ${status}`, err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient])
}
