import { useQuery, useQueryClient } from "@tanstack/react-query"
import { findOpenTicket, touchGuestTicket } from "@/lib/guest-session"

/**
 * A guest's open guest ticket on this project, to resume after a reload
 * instead of an empty composer (a guest can't open a second one). The
 * lookup touches the guest's tickets first (`findOpenTicket`), so a ticket
 * cancelled when they closed the tab less than 30 minutes ago is reopened
 * and resumed on both /support and /support/chat. Guests
 * only: signed-in users may open several tickets per project, so they are
 * never bounced to an existing one. Disabled unless `isGuest`, a guest id
 * and a project id are given.
 */
export function useResumableGuestTicket(
  guestId: string | undefined,
  isGuest: boolean,
  projectId: string | undefined,
) {
  const enabled = isGuest && !!guestId && !!projectId
  return useQuery({
    queryKey: ["resumable-ticket", guestId, projectId],
    queryFn: () => findOpenTicket(guestId!, projectId!, { guestOnly: true }),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

/**
 * `/support/chat?ticket=X` for this browser's own guest: touch X before the
 * page decides it is closed — the backend reopens it when it was cancelled
 * because the guest left less than 30 minutes ago — then refetch the ticket
 * and its messages. `isPending` while that runs, so the "Start a new
 * conversation" state is never shown for a ticket that can be re-entered.
 */
export function useGuestTicketReentry(ticketId: string | undefined, guestId: string | undefined) {
  const queryClient = useQueryClient()
  const enabled = !!ticketId && !!guestId
  const query = useQuery({
    queryKey: ["guest-ticket-reentry", guestId, ticketId],
    queryFn: async () => {
      const touched = await touchGuestTicket(ticketId!)
      if (touched) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["ticket-with-details", ticketId] }),
          queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
          queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] }),
        ])
      }
      return touched
    },
    enabled,
    retry: false,
    staleTime: 0,
    // Every visit touches again: nothing is kept from an earlier one.
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  return { isPending: enabled && query.isPending }
}
