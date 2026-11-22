import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { findResumableGuestTicket } from "@/lib/guest-session"
import { touchGuestTicketsNow } from "@/hooks/useGuestPresence"

/**
 * Refetch what is cached about a guest ticket after `touch_guest_ticket` may
 * have reopened it (status back to 'available', new system messages), so a
 * stale "visitor left" state is never shown. Resolves once the active
 * queries have refetched.
 */
export function invalidateGuestTicketQueries(queryClient: QueryClient, ticketId: string): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
    queryClient.invalidateQueries({ queryKey: ["ticket-with-details", ticketId] }),
    queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] }),
  ]).then(
    () => undefined,
    () => undefined,
  )
}

/**
 * A guest's open guest ticket on this project, to resume after a reload
 * instead of an empty composer (a guest can't open a second one). The lookup
 * waits for `touch_guest_ticket` (no id) first: a ticket closed because the
 * guest left is reopened by it for 30 minutes, and then resumes as a normal
 * open conversation. Guests only: signed-in users may open several tickets
 * per project, so they are never bounced to an existing one. Disabled unless
 * `isGuest`, a guest id and a project id are given.
 */
export function useResumableGuestTicket(
  guestId: string | undefined,
  isGuest: boolean,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient()
  const enabled = isGuest && !!guestId && !!projectId
  return useQuery({
    queryKey: ["resumable-ticket", guestId, projectId],
    queryFn: async () => {
      const ticket = await findResumableGuestTicket(guestId!, projectId!, () => touchGuestTicketsNow())
      if (ticket) void invalidateGuestTicketQueries(queryClient, ticket.id)
      return ticket
    },
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}
