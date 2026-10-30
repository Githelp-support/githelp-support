import { useQuery } from "@tanstack/react-query"
import { findOpenTicket } from "@/lib/guest-session"

/**
 * A guest's open guest ticket on this project, to resume after a reload
 * instead of an empty composer (a guest can't open a second one). Guests
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
