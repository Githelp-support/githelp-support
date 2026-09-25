import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { refetchTicketParticipants } from '@/hooks/useTicketParticipants'

/**
 * Shape of the bits of a `tickets_messages` realtime payload we look at.
 * `new` is only present for INSERT/UPDATE; `metadata` is the JSON column the
 * system-message writers (payments edge functions, the time_logged trigger)
 * stamp a `kind` on.
 */
interface MessageChangePayload {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: { metadata?: { kind?: string } | null } | null
}

/**
 * System messages that mean the ticket's time entries changed: `time_logged`
 * is written by the DB trigger on `tickets_time_entries` (migration
 * 20260908120000_time_logged_system_messages) and the two review kinds by the
 * `review_time_entry` RPC (migration 20260925120000_time_entries_customer_review).
 */
const TIME_ENTRY_MESSAGE_KINDS = new Set(['time_logged', 'time_entry_accepted', 'time_entry_declined'])

/** True for an INSERT of any of the time-entry system messages above. */
export const isTimeEntryMessage = (payload: unknown): boolean => {
  const p = payload as MessageChangePayload | null | undefined
  const kind = p?.new?.metadata?.kind
  return p?.eventType === 'INSERT' && !!kind && TIME_ENTRY_MESSAGE_KINDS.has(kind)
}

/** True only for the `time_logged` INSERT (a helper logged new time). */
export const isTimeLoggedMessage = (payload: unknown): boolean => {
  const p = payload as MessageChangePayload | null | undefined
  return p?.eventType === 'INSERT' && p.new?.metadata?.kind === 'time_logged'
}

export function useRealtimeMessages(ticketId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    // `useTimeEntries` keys are ["time-entries", helperId, ticketId, projectId, start, end];
    // match on the ticket slot rather than refetching every time-entries query.
    const invalidateTimeEntries = () =>
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'time-entries' && q.queryKey[2] === ticketId,
      })

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
        async (payload) => {
          // Cancel an in-flight fetch so the invalidation actually refetches
          // (a pending fetch with no data yet would otherwise be reused).
          await queryClient.cancelQueries({ queryKey: ['ticket-messages', ticketId] })
          // Invalidate messages query to refetch
          queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
          // Also invalidate ticket details to update message count
          queryClient.invalidateQueries({ queryKey: ['tickets-with-details'] })
          // A claim always produces messages (the payment system message, the
          // helper's first reply), so a new message is a reliable cue that
          // "People in this chat" may have changed — more reliable than the
          // tickets UPDATE event alone, which useRealtimeTicket also handles.
          void refetchTicketParticipants(queryClient, ticketId)
          // The customer's "Logged time" sidebar total reads tickets_time_entries.
          // useRealtimeTicket also listens on that table directly, but that only
          // delivers when it is in the realtime publication; the time_logged
          // bubble always arrives, so refresh the total from it as well. The
          // accept/decline messages flip an entry's review_status the same way.
          if (isTimeEntryMessage(payload)) {
            void invalidateTimeEntries()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient])
}
