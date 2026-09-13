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
 *    the tables are in the `supabase_realtime` publication; otherwise they
 *    are harmless no-ops and the UPDATE fallback still applies.
 *
 * The UPDATE also refreshes the ticket's messages. The helper's claim awaits
 * `payments-authorize-on-claim` — which writes the `payment_required` /
 * `payment_authorized` system message — before it flips the status to
 * "claimed", so by the time this event lands the message row already exists.
 * `useRealtimeMessages` normally picks it up via `tickets_messages`, but that
 * only works when the table is in the realtime publication (migration
 * 20260908120000_time_logged_system_messages adds it); this fallback keeps
 * the "Add payment method" CTA from needing a manual refresh either way.
 */
export function useRealtimeTicket(ticketId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const invalidateParticipants = () => {
      void refetchTicketParticipants(queryClient, ticketId)
    }

    // Cancel-then-invalidate, like useRealtimeMessages: a plain invalidate
    // would dedupe onto an in-flight messages fetch that has no data yet and
    // cache its pre-claim result for the full staleTime.
    const refetchMessages = async () => {
      const queryKey = ['ticket-messages', ticketId]
      await queryClient.cancelQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey })
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
          void refetchMessages()
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
