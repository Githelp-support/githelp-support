import { useQuery } from "@tanstack/react-query";
import { fetchHelperTicketsByLastInteraction } from "./useHelperRecentTicketInteractions";

export interface HelperLastInteractedTicket {
    id: string;
    project_id: string;
    /** Raw `tickets.status` value. */
    status: string | null;
    /** The session has ended: the ticket is completed or cancelled. */
    isEnded: boolean;
}

const ENDED_STATUSES = new Set(["completed", "cancelled"]);

/**
 * The ticket the helper most recently interacted with, or null when there is
 * none. Uses the same ranking as useHelperRecentTicketInteractions.
 *
 * `userId` is the helper's AUTH user id (useUser().user.id).
 */
export function useHelperLastInteractedTicket(userId?: string) {
    return useQuery({
        // Shares the recent-interactions key prefix so the existing invalidations
        // of ["helper-recent-ticket-interactions"] refresh this query too.
        queryKey: ["helper-recent-ticket-interactions", userId, "last"],
        queryFn: async (): Promise<HelperLastInteractedTicket | null> => {
            if (!userId) return null;

            const { ranked } = await fetchHelperTicketsByLastInteraction(userId);
            const ticket = ranked[0]?.ticket;
            if (!ticket) return null;

            return {
                id: ticket.id,
                project_id: ticket.project_id,
                status: ticket.status,
                isEnded: !!ticket.status && ENDED_STATUSES.has(ticket.status),
            };
        },
        enabled: !!userId,
        retry: false,
    });
}
