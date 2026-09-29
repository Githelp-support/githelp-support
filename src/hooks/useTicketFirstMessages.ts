import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/** Ticket id -> content of the ticket's first (oldest, non-deleted) message. */
export type TicketFirstMessages = Record<string, string>;

/**
 * First message of each given ticket, keyed by ticket id. Tickets without any
 * message are simply absent from the map.
 */
export function useTicketFirstMessages(ticketIds: string[]) {
    const sortedIds = [...new Set(ticketIds)].sort();

    return useQuery({
        queryKey: ["ticket-first-messages", sortedIds],
        queryFn: async (): Promise<TicketFirstMessages> => {
            if (!sortedIds.length) return {};

            const { data: messages, error } = await supabase
                .from("tickets_messages")
                .select("ticket_id, content, created_at")
                .in("ticket_id", sortedIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: true });

            if (error) throw error;

            const firstMessageByTicket: TicketFirstMessages = {};
            messages?.forEach((m: { ticket_id: string; content: string | null }) => {
                if (!(m.ticket_id in firstMessageByTicket)) {
                    firstMessageByTicket[m.ticket_id] = m.content ?? "";
                }
            });
            return firstMessageByTicket;
        },
        enabled: sortedIds.length > 0,
        retry: false,
        staleTime: 60000,
    });
}
