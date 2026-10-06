import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export type RecentTicketInteractionStatus = "Completed" | "Claimed" | "Unclaimed";

export interface RecentTicketInteraction {
    id: string;
    title: string;
    project_id: string;
    project_name: string | null;
    project_logo_url: string | null;
    /** Derived exactly like the Tickets page: Completed > Claimed (helper) > Unclaimed. */
    status: RecentTicketInteractionStatus;
    helper: { id: string; name: string; avatar_url: string | null } | null;
    message_count: number;
    /** ISO timestamp of the user's most recent interaction with the ticket. */
    last_interaction_at: string;
}

type TicketRow = {
    id: string;
    title: string;
    project_id: string;
    status: string | null;
    created_at: string;
    created_by: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    end_requested_at: string | null;
    end_requested_by: string | null;
};

const TICKET_COLUMNS =
    "id, title, project_id, status, created_at, created_by, completed_at, cancelled_at, end_requested_at, end_requested_by";

/** Records `ts` for `ticketId` if it is later than what we already have. */
function bump(map: Map<string, number>, ticketId: string | null | undefined, ts: string | null | undefined) {
    if (!ticketId || !ts) return;
    const ms = new Date(ts).getTime();
    if (Number.isNaN(ms)) return;
    const prev = map.get(ticketId);
    if (prev === undefined || ms > prev) map.set(ticketId, ms);
}

/**
 * The `limit` tickets the user most recently interacted with, ordered by the
 * timestamp of their LAST interaction (descending). An interaction is any of:
 *  - creating the ticket (tickets.created_at)
 *  - writing a message (tickets_messages.created_at)
 *  - closing it (tickets.completed_at / cancelled_at on the user's tickets,
 *    tickets.end_requested_at when the user requested the end)
 *  - a payment on one of the user's tickets (payments.completed_at ?? created_at)
 * The max across sources is taken per ticket.
 */
export function useUserRecentTicketInteractions(userId?: string, limit = 5) {
    return useQuery({
        queryKey: ["user-recent-ticket-interactions", userId, limit],
        queryFn: async (): Promise<RecentTicketInteraction[]> => {
            if (!userId) return [];

            // (a) + (c) tickets the user created, incl. closing timestamps.
            const { data: ownedTickets, error: ownedError } = await supabase
                .from("tickets")
                .select(TICKET_COLUMNS)
                .eq("created_by", userId)
                .is("deleted_at", null);
            if (ownedError) throw ownedError;

            // (b) messages the user wrote (may reference tickets they did not create).
            const { data: messages, error: messagesError } = await supabase
                .from("tickets_messages")
                .select("ticket_id, created_at")
                .eq("sender_id", userId)
                .is("deleted_at", null);
            if (messagesError) throw messagesError;

            // (c) tickets whose end the user requested (may include non-owned tickets).
            const { data: endRequested, error: endRequestedError } = await supabase
                .from("tickets")
                .select("id, end_requested_at")
                .eq("end_requested_by", userId)
                .is("deleted_at", null);
            if (endRequestedError) throw endRequestedError;

            // (d) payments for the user's tickets (same join/filter as useUserPayments).
            const { data: payments, error: paymentsError } = await supabase
                .from("payments")
                .select("ticket_id, created_at, completed_at, ticket:tickets!inner(created_by)")
                .eq("ticket.created_by", userId);
            if (paymentsError) throw paymentsError;

            const lastInteraction = new Map<string, number>();
            const ticketsById = new Map<string, TicketRow>();

            ((ownedTickets || []) as unknown as TicketRow[]).forEach((t) => {
                ticketsById.set(t.id, t);
                bump(lastInteraction, t.id, t.created_at);
                bump(lastInteraction, t.id, t.completed_at);
                bump(lastInteraction, t.id, t.cancelled_at);
                if (t.end_requested_by === userId) {
                    bump(lastInteraction, t.id, t.end_requested_at);
                }
            });
            (messages || []).forEach((m: any) => bump(lastInteraction, m.ticket_id, m.created_at));
            (endRequested || []).forEach((t: any) => bump(lastInteraction, t.id, t.end_requested_at));
            (payments || []).forEach((p: any) =>
                bump(lastInteraction, p.ticket_id, p.completed_at ?? p.created_at)
            );

            // Tickets the user interacted with but did not create: fetch their rows.
            const missingIds = [...lastInteraction.keys()].filter((id) => !ticketsById.has(id));
            if (missingIds.length) {
                const { data: otherTickets, error: otherError } = await supabase
                    .from("tickets")
                    .select(TICKET_COLUMNS)
                    .in("id", missingIds)
                    .is("deleted_at", null);
                if (otherError) throw otherError;
                ((otherTickets || []) as unknown as TicketRow[]).forEach((t) =>
                    ticketsById.set(t.id, t)
                );
            }

            const topTickets = [...lastInteraction.entries()]
                .filter(([id]) => ticketsById.has(id)) // drop deleted / inaccessible tickets
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([id, ms]) => ({ ticket: ticketsById.get(id)!, ms }));

            if (!topTickets.length) return [];

            const ticketIds = topTickets.map(({ ticket }) => ticket.id);
            const projectIds = [
                ...new Set(topTickets.map(({ ticket }) => ticket.project_id).filter(Boolean)),
            ];

            const { data: projects } = await supabase
                .from("projects")
                .select("project_id, name, logo_url")
                .in("project_id", projectIds);
            const projectsMap = new Map(projects?.map((p: any) => [p.project_id, p]) || []);

            const { data: brandings } = await supabase
                .from("projects_branding")
                .select("project_id, logo_url")
                .in("project_id", projectIds);
            const brandingMap = new Map(brandings?.map((b: any) => [b.project_id, b]) || []);

            const { data: messageRows } = await supabase
                .from("tickets_messages")
                .select("ticket_id")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null);
            const countsMap = new Map<string, number>();
            messageRows?.forEach((msg: any) => {
                countsMap.set(msg.ticket_id, (countsMap.get(msg.ticket_id) || 0) + 1);
            });

            // Claiming helper: a claimed participant who is not the current user.
            const { data: participants } = await supabase
                .from("tickets_participants")
                .select("ticket_id, participant_id")
                .in("ticket_id", ticketIds)
                .eq("claimed", true);
            const claimerByTicket = new Map<string, string>();
            participants?.forEach((p: any) => {
                if (p.participant_id && p.participant_id !== userId && !claimerByTicket.has(p.ticket_id)) {
                    claimerByTicket.set(p.ticket_id, p.participant_id);
                }
            });
            const claimerIds = [...new Set(claimerByTicket.values())];
            const { data: claimerUsers } = claimerIds.length
                ? await supabase.from("users_public").select("id, name, avatar_url").in("id", claimerIds)
                : { data: [] as any[] };
            const claimerUserMap = new Map(claimerUsers?.map((u: any) => [u.id, u]) || []);

            return topTickets.map(({ ticket, ms }) => {
                const project: any = projectsMap.get(ticket.project_id) || null;
                const branding: any = brandingMap.get(ticket.project_id) || null;
                const claimerId = claimerByTicket.get(ticket.id) || null;
                const claimer: any = claimerId ? claimerUserMap.get(claimerId) || null : null;
                const helper = claimer
                    ? {
                          id: claimer.id as string,
                          name: (claimer.name as string) || "Helper",
                          avatar_url: (claimer.avatar_url as string | null) ?? null,
                      }
                    : null;
                const status: RecentTicketInteractionStatus =
                    ticket.status === "completed" ? "Completed" : helper ? "Claimed" : "Unclaimed";
                return {
                    id: ticket.id,
                    title: ticket.title,
                    project_id: ticket.project_id,
                    project_name: project?.name ?? null,
                    project_logo_url: branding?.logo_url ?? project?.logo_url ?? null,
                    status,
                    helper,
                    message_count: countsMap.get(ticket.id) || 0,
                    last_interaction_at: new Date(ms).toISOString(),
                };
            });
        },
        enabled: !!userId,
        retry: false,
    });
}
