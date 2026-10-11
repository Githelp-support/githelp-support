import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export type HelperRecentTicketStatus = "Completed" | "Claimed" | "Unclaimed";

export interface HelperRecentTicketInteraction {
    id: string;
    title: string;
    project_id: string;
    project_name: string | null;
    project_logo_url: string | null;
    /** Completed > Claimed (by this helper or anyone else) > Unclaimed. */
    status: HelperRecentTicketStatus;
    /** The customer who opened the ticket. */
    creator: { id: string; name: string; avatar_url: string | null } | null;
    message_count: number;
    /**
     * Same rule as the helper chat sidebar: the newest non-deleted message
     * differs from this helper's participant `last_read_message_id`.
     */
    has_unread: boolean;
    /** ISO timestamp of the helper's most recent interaction with the ticket. */
    last_interaction_at: string;
}

type TicketRow = {
    id: string;
    title: string;
    project_id: string;
    status: string | null;
    created_by: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    end_requested_at: string | null;
    end_requested_by: string | null;
    time_review_requested_at: string | null;
    time_review_requested_by: string | null;
};

type ParticipantRow = {
    ticket_id: string;
    created_at: string;
    claimed: boolean | null;
    last_read_message_id: string | null;
};

const TICKET_COLUMNS =
    "id, title, project_id, status, created_by, completed_at, cancelled_at, end_requested_at, end_requested_by, time_review_requested_at, time_review_requested_by";

/** Records `ts` for `ticketId` if it is later than what we already have. */
function bump(map: Map<string, number>, ticketId: string | null | undefined, ts: string | null | undefined) {
    if (!ticketId || !ts) return;
    const ms = new Date(ts).getTime();
    if (Number.isNaN(ms)) return;
    const prev = map.get(ticketId);
    if (prev === undefined || ms > prev) map.set(ticketId, ms);
}

/**
 * The `limit` tickets the helper most recently interacted with, ordered by the
 * timestamp of their LAST interaction (descending). An interaction is any of:
 *  - writing a message (tickets_messages.created_at)
 *  - joining / claiming the ticket (tickets_participants.created_at)
 *  - on tickets the helper participates in: closing (tickets.completed_at /
 *    cancelled_at), requesting the end (end_requested_at when the helper
 *    requested it) and sending the time summary (time_review_requested_at when
 *    the helper requested it)
 *  - logging time (tickets_time_entries.created_at, same table as useTimeEntries)
 * The max across sources is taken per ticket.
 *
 * `userId` is the helper's AUTH user id (useUser().user.id), not the
 * projects_helpers.helper_id from useCurrentHelper.
 */
export function useHelperRecentTicketInteractions(userId?: string, limit = 5) {
    return useQuery({
        queryKey: ["helper-recent-ticket-interactions", userId, limit],
        queryFn: async (): Promise<HelperRecentTicketInteraction[]> => {
            if (!userId) return [];

            // (a) messages the helper sent.
            const { data: messages, error: messagesError } = await supabase
                .from("tickets_messages")
                .select("ticket_id, created_at")
                .eq("sender_id", userId)
                .is("deleted_at", null);
            if (messagesError) throw messagesError;

            // (b) tickets the helper joined / claimed.
            const { data: participants, error: participantsError } = await supabase
                .from("tickets_participants")
                .select("ticket_id, created_at, claimed, last_read_message_id")
                .eq("participant_id", userId);
            if (participantsError) throw participantsError;

            // (d) time entries the helper logged. tickets_time_entries.helper_id is
            // projects_helpers.helper_id, so filter through the helper's auth user.
            const { data: timeEntries, error: timeEntriesError } = await supabase
                .from("tickets_time_entries")
                .select("ticket_id, created_at, helper:projects_helpers!inner(user_id)")
                .eq("helper.user_id", userId);
            if (timeEntriesError) throw timeEntriesError;

            const lastInteraction = new Map<string, number>();
            const participantByTicket = new Map<string, ParticipantRow>();

            (messages || []).forEach((m: any) => bump(lastInteraction, m.ticket_id, m.created_at));
            ((participants || []) as unknown as ParticipantRow[]).forEach((p) => {
                participantByTicket.set(p.ticket_id, p);
                bump(lastInteraction, p.ticket_id, p.created_at);
            });
            (timeEntries || []).forEach((e: any) => bump(lastInteraction, e.ticket_id, e.created_at));

            // None of the sources return the ticket row itself: fetch them all.
            const ticketsById = new Map<string, TicketRow>();
            const missingIds = [...lastInteraction.keys()].filter((id) => !ticketsById.has(id));
            if (missingIds.length) {
                const { data: ticketRows, error: ticketsError } = await supabase
                    .from("tickets")
                    .select(TICKET_COLUMNS)
                    .in("id", missingIds)
                    .is("deleted_at", null);
                if (ticketsError) throw ticketsError;
                ((ticketRows || []) as unknown as TicketRow[]).forEach((t) => ticketsById.set(t.id, t));
            }

            // (c) closing / request timestamps on the tickets the helper participates in.
            participantByTicket.forEach((_p, ticketId) => {
                const t = ticketsById.get(ticketId);
                if (!t) return;
                bump(lastInteraction, t.id, t.completed_at);
                bump(lastInteraction, t.id, t.cancelled_at);
                if (t.end_requested_by === userId) {
                    bump(lastInteraction, t.id, t.end_requested_at);
                }
                if (t.time_review_requested_by === userId) {
                    bump(lastInteraction, t.id, t.time_review_requested_at);
                }
            });

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

            // Non-deleted messages, oldest first: gives both the message count and
            // the last message id per ticket (same rule as the helper sidebar).
            const { data: messageRows } = await supabase
                .from("tickets_messages")
                .select("id, ticket_id, created_at")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: true });
            const countsMap = new Map<string, number>();
            const lastMessageIdByTicket = new Map<string, string>();
            messageRows?.forEach((msg: any) => {
                countsMap.set(msg.ticket_id, (countsMap.get(msg.ticket_id) || 0) + 1);
                lastMessageIdByTicket.set(msg.ticket_id, msg.id);
            });

            // Any claimed participant (this helper or someone else) means "Claimed".
            const { data: claimedParticipants } = await supabase
                .from("tickets_participants")
                .select("ticket_id, participant_id")
                .in("ticket_id", ticketIds)
                .eq("claimed", true);
            const claimedTicketIds = new Set<string>(
                (claimedParticipants || []).map((p: any) => p.ticket_id as string)
            );

            // Ticket creator (the customer).
            const creatorIds = [
                ...new Set(topTickets.map(({ ticket }) => ticket.created_by).filter(Boolean)),
            ] as string[];
            const { data: creatorUsers } = creatorIds.length
                ? await supabase.from("users_public").select("id, name, avatar_url").in("id", creatorIds)
                : { data: [] as any[] };
            const creatorUserMap = new Map(creatorUsers?.map((u: any) => [u.id, u]) || []);

            return topTickets.map(({ ticket, ms }) => {
                const project: any = projectsMap.get(ticket.project_id) || null;
                const branding: any = brandingMap.get(ticket.project_id) || null;
                const creatorRow: any = ticket.created_by
                    ? creatorUserMap.get(ticket.created_by) || null
                    : null;
                const creator = creatorRow
                    ? {
                          id: creatorRow.id as string,
                          name: (creatorRow.name as string) || "User",
                          avatar_url: (creatorRow.avatar_url as string | null) ?? null,
                      }
                    : null;

                const participant = participantByTicket.get(ticket.id);
                const isClaimed = !!participant?.claimed || claimedTicketIds.has(ticket.id);
                const status: HelperRecentTicketStatus =
                    ticket.status === "completed" ? "Completed" : isClaimed ? "Claimed" : "Unclaimed";

                const lastMessageId = lastMessageIdByTicket.get(ticket.id) ?? null;
                const lastRead = participant?.last_read_message_id ?? null;
                const has_unread = lastMessageId != null && lastRead !== lastMessageId;

                return {
                    id: ticket.id,
                    title: ticket.title,
                    project_id: ticket.project_id,
                    project_name: project?.name ?? null,
                    project_logo_url: branding?.logo_url ?? project?.logo_url ?? null,
                    status,
                    creator,
                    message_count: countsMap.get(ticket.id) || 0,
                    has_unread,
                    last_interaction_at: new Date(ms).toISOString(),
                };
            });
        },
        enabled: !!userId,
        retry: false,
    });
}
