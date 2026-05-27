import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];

export interface HelperClaimedTicketSidebarItem {
    id: string;
    title: string;
    subtitle: string;
    date: string;
    avatarUrl: string | null;
    avatarInitial: string;
    /** Ticket creator's user id — used for deterministic avatar background color. */
    creatorId: string | null;
    current: boolean;
    hasNotification: boolean;
}

export interface HelperClaimedTicketsSidebarResult {
    items: HelperClaimedTicketSidebarItem[];
    activeCount: number;
}

const SUBTITLE_MAX_CHARS = 50;

/**
 * Tickets the current helper has claimed that are still in progress (for
 * sidebar). Title = project name + ticket id, subtitle = first message
 * snippet, hasNotification from last_read_message_id.
 *
 * Always includes the current ticket even if it falls outside the `limit`
 * window or isn't in an active state — the open/displayed ticket must appear
 * in the list. Also returns `activeCount` — a ticket counts as "active" when
 * its status is `claimed` or `in-progress`. The count is used by the UI to
 * render "Active tickets (N)".
 */
export function useHelperClaimedTicketsSidebar(
    userId: string | undefined,
    currentTicketId: string | undefined,
    limit = 3
) {
    return useQuery({
        queryKey: ["helper-claimed-tickets-sidebar", userId, currentTicketId, limit],
        queryFn: async (): Promise<HelperClaimedTicketsSidebarResult> => {
            if (!userId) return { items: [], activeCount: 0 };

            const { data: participantRows, error: partError } = await supabase
                .from("tickets_participants")
                .select("ticket_id, last_read_message_id")
                .eq("participant_id", userId)
                .eq("claimed", true);

            if (partError) throw partError;

            const claimedTicketIds = participantRows?.map((p) => p.ticket_id) ?? [];
            const lastReadByTicket = new Map(
                (participantRows ?? []).map((p) => [
                    p.ticket_id,
                    p.last_read_message_id ?? null,
                ])
            );

            type SidebarTicketRow = {
                id: string;
                title: string | null;
                description: string | null;
                created_at: string;
                updated_at: string;
                created_by: string | null;
                project_id: string;
                status: string | null;
            };

            // Helper's claimed tickets that are still in progress — only
            // `claimed` or `in-progress` statuses count as "active" for the
            // helper sidebar.
            let activeTickets: SidebarTicketRow[] = [];
            if (claimedTicketIds.length) {
                const { data, error } = await supabase
                    .from("tickets")
                    .select(
                        "id, title, description, created_at, updated_at, created_by, project_id, status"
                    )
                    .in("id", claimedTicketIds)
                    .is("deleted_at", null)
                    .in("status", ["claimed", "in-progress"])
                    .order("updated_at", { ascending: false });

                if (error) throw error;
                activeTickets = (data ?? []) as SidebarTicketRow[];
            }

            const activeCount = activeTickets.length;
            let tickets: SidebarTicketRow[] = activeTickets;

            // Ensure the current ticket is included even if it's not "active"
            // (e.g. just-ended) or wasn't claimed by this user — the open/
            // displayed ticket must appear in the list.
            if (
                currentTicketId &&
                !tickets.some((t) => t.id === currentTicketId)
            ) {
                const { data: currentTicket } = await supabase
                    .from("tickets")
                    .select(
                        "id, title, description, created_at, updated_at, created_by, project_id, status"
                    )
                    .eq("id", currentTicketId)
                    .is("deleted_at", null)
                    .maybeSingle();
                if (currentTicket) {
                    tickets = [currentTicket as SidebarTicketRow, ...tickets];
                }
            }

            // Apply limit, but always keep the current ticket in view.
            if (tickets.length > limit) {
                const currentIdx = tickets.findIndex(
                    (t) => t.id === currentTicketId
                );
                if (currentIdx >= limit) {
                    const current = tickets[currentIdx];
                    tickets = [current, ...tickets.slice(0, limit - 1)];
                } else {
                    tickets = tickets.slice(0, limit);
                }
            }

            if (!tickets.length) return { items: [], activeCount };

            const projectIds = [...new Set(tickets.map((t) => t.project_id))];
            const { data: projects } = await supabase
                .from("projects")
                .select("project_id, name")
                .in("project_id", projectIds);
            const projectMap = new Map(projects?.map((p) => [p.project_id, p.name]) ?? []);

            const creatorIds = [
                ...new Set(tickets.map((t) => t.created_by).filter(Boolean)),
            ] as string[];
            const { data: users } = creatorIds.length
                ? await supabase
                      .from("users_public")
                      .select("id, name, avatar_url")
                      .in("id", creatorIds)
                : { data: [] as Array<{ id: string; name: string | null; avatar_url: string | null }> };
            const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);

            const ticketIds = tickets.map((t) => t.id);
            const { data: messages } = await supabase
                .from("tickets_messages")
                .select("id, ticket_id, content, created_at")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: true });

            const firstMessageByTicket = new Map<string, { content: string }>();
            const lastMessageIdByTicket = new Map<string, string>();
            messages?.forEach((m: { id: string; ticket_id: string; content: string }) => {
                if (!firstMessageByTicket.has(m.ticket_id)) {
                    firstMessageByTicket.set(m.ticket_id, { content: m.content });
                }
                lastMessageIdByTicket.set(m.ticket_id, m.id);
            });

            const formatDate = (dateStr: string) => {
                const d = new Date(dateStr);
                return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
            };

            const items = tickets.map((t) => {
                const projectName = projectMap.get(t.project_id) ?? "Project";
                const firstMsg = firstMessageByTicket.get(t.id)?.content ?? t.description ?? "";
                const subtitle = firstMsg.length > SUBTITLE_MAX_CHARS
                    ? firstMsg.slice(0, SUBTITLE_MAX_CHARS).trim() + "…"
                    : firstMsg.trim() || "—";
                const creator = t.created_by ? userMap.get(t.created_by) : null;
                const lastMessageId = lastMessageIdByTicket.get(t.id) ?? null;
                const lastRead = lastReadByTicket.get(t.id) ?? null;
                const hasNotification = lastMessageId != null && lastRead !== lastMessageId;

                return {
                    id: t.id,
                    title: `${projectName} - ${t.id.slice(0, 8)}`,
                    subtitle,
                    date: formatDate(t.created_at),
                    avatarUrl: creator?.avatar_url ?? null,
                    avatarInitial: creator?.name?.[0]?.toUpperCase() ?? "?",
                    creatorId: t.created_by ?? null,
                    current: t.id === currentTicketId,
                    hasNotification,
                };
            });

            return { items, activeCount };
        },
        enabled: !!userId,
        retry: false,
        staleTime: 60000,
    });
}

/**
 * Active tickets across a project for the Admin sidebar. Returns all tickets
 * in the given project whose status is `claimed` or `in-progress` — including
 * tickets claimed by various helpers (admins can monitor everyone's work).
 *
 * Mirrors `useHelperClaimedTicketsSidebar` in shape so the chat sidebar can
 * render the same UI. `userId` is used to compute the unread/notification dot
 * relative to the current admin's last_read_message_id (when one exists).
 * Always includes the current ticket even if it falls outside the active set.
 */
export function useAdminActiveTicketsSidebar(
    projectId: string | undefined,
    userId: string | undefined,
    currentTicketId: string | undefined,
    limit = 50
) {
    return useQuery({
        queryKey: [
            "admin-active-tickets-sidebar",
            projectId,
            userId,
            currentTicketId,
            limit,
        ],
        queryFn: async (): Promise<HelperClaimedTicketsSidebarResult> => {
            if (!projectId) return { items: [], activeCount: 0 };

            type SidebarTicketRow = {
                id: string;
                title: string | null;
                description: string | null;
                created_at: string;
                updated_at: string;
                created_by: string | null;
                project_id: string;
                status: string | null;
            };

            const { data, error } = await supabase
                .from("tickets")
                .select(
                    "id, title, description, created_at, updated_at, created_by, project_id, status"
                )
                .eq("project_id", projectId)
                .is("deleted_at", null)
                .in("status", ["claimed", "in-progress"])
                .order("updated_at", { ascending: false });

            if (error) throw error;
            const activeTickets = (data ?? []) as SidebarTicketRow[];
            const activeCount = activeTickets.length;
            let tickets: SidebarTicketRow[] = activeTickets;

            // Ensure the current ticket is included even if it's not in an
            // active state (e.g. just-ended) — the open/displayed ticket must
            // appear in the list.
            if (
                currentTicketId &&
                !tickets.some((t) => t.id === currentTicketId)
            ) {
                const { data: currentTicket } = await supabase
                    .from("tickets")
                    .select(
                        "id, title, description, created_at, updated_at, created_by, project_id, status"
                    )
                    .eq("id", currentTicketId)
                    .is("deleted_at", null)
                    .maybeSingle();
                if (currentTicket) {
                    tickets = [currentTicket as SidebarTicketRow, ...tickets];
                }
            }

            // Apply limit, but always keep the current ticket in view.
            if (tickets.length > limit) {
                const currentIdx = tickets.findIndex(
                    (t) => t.id === currentTicketId
                );
                if (currentIdx >= limit) {
                    const current = tickets[currentIdx];
                    tickets = [current, ...tickets.slice(0, limit - 1)];
                } else {
                    tickets = tickets.slice(0, limit);
                }
            }

            if (!tickets.length) return { items: [], activeCount };

            const projectIds = [...new Set(tickets.map((t) => t.project_id))];
            const { data: projects } = await supabase
                .from("projects")
                .select("project_id, name")
                .in("project_id", projectIds);
            const projectMap = new Map(
                projects?.map((p) => [p.project_id, p.name]) ?? []
            );

            const creatorIds = [
                ...new Set(tickets.map((t) => t.created_by).filter(Boolean)),
            ] as string[];
            const { data: users } = creatorIds.length
                ? await supabase
                      .from("users_public")
                      .select("id, name, avatar_url")
                      .in("id", creatorIds)
                : {
                      data: [] as Array<{
                          id: string;
                          name: string | null;
                          avatar_url: string | null;
                      }>,
                  };
            const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);

            const ticketIds = tickets.map((t) => t.id);
            // Notification dot is relative to this admin's last_read_message_id
            // (if a participant row exists for them on the ticket).
            const lastReadByTicket = new Map<string, string | null>();
            if (userId && ticketIds.length) {
                const { data: partRows } = await supabase
                    .from("tickets_participants")
                    .select("ticket_id, last_read_message_id")
                    .eq("participant_id", userId)
                    .in("ticket_id", ticketIds);
                partRows?.forEach((p) =>
                    lastReadByTicket.set(
                        p.ticket_id,
                        p.last_read_message_id ?? null
                    )
                );
            }

            const { data: messages } = await supabase
                .from("tickets_messages")
                .select("id, ticket_id, content, created_at")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: true });

            const firstMessageByTicket = new Map<string, { content: string }>();
            const lastMessageIdByTicket = new Map<string, string>();
            messages?.forEach(
                (m: { id: string; ticket_id: string; content: string }) => {
                    if (!firstMessageByTicket.has(m.ticket_id)) {
                        firstMessageByTicket.set(m.ticket_id, {
                            content: m.content,
                        });
                    }
                    lastMessageIdByTicket.set(m.ticket_id, m.id);
                }
            );

            const formatDate = (dateStr: string) => {
                const d = new Date(dateStr);
                return `${String(d.getDate()).padStart(2, "0")}.${String(
                    d.getMonth() + 1
                ).padStart(2, "0")}.${d.getFullYear()}`;
            };

            const items = tickets.map((t) => {
                const projectName = projectMap.get(t.project_id) ?? "Project";
                const firstMsg =
                    firstMessageByTicket.get(t.id)?.content ??
                    t.description ??
                    "";
                const subtitle =
                    firstMsg.length > SUBTITLE_MAX_CHARS
                        ? firstMsg.slice(0, SUBTITLE_MAX_CHARS).trim() + "…"
                        : firstMsg.trim() || "—";
                const creator = t.created_by ? userMap.get(t.created_by) : null;
                const lastMessageId =
                    lastMessageIdByTicket.get(t.id) ?? null;
                const lastRead = lastReadByTicket.get(t.id) ?? null;
                const hasNotification =
                    lastMessageId != null && lastRead !== lastMessageId;

                return {
                    id: t.id,
                    title: `${projectName} - ${t.id.slice(0, 8)}`,
                    subtitle,
                    date: formatDate(t.created_at),
                    avatarUrl: creator?.avatar_url ?? null,
                    avatarInitial: creator?.name?.[0]?.toUpperCase() ?? "?",
                    creatorId: t.created_by ?? null,
                    current: t.id === currentTicketId,
                    hasNotification,
                };
            });

            return { items, activeCount };
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 60000,
    });
}

export function useHelperTickets(helperId: string, projectId?: string) {
    return useQuery<Ticket[]>({
        queryKey: ["helper-tickets", helperId, projectId],
        queryFn: async () => {
            // First, get the helper's user_id from helper_id
            const { data: helperData, error: helperError } = await supabase
                .from("projects_helpers")
                .select("user_id")
                .eq("helper_id", helperId)
                .single();

            if (helperError) throw helperError;
            if (!helperData?.user_id) return [];

            // Then, get all tickets where this helper is a participant
            let query = supabase
                .from("tickets_participants")
                .select("ticket_id")
                .eq("participant_id", helperData.user_id);

            const { data: participantsData, error: participantsError } =
                await query;

            if (participantsError) throw participantsError;
            if (!participantsData || participantsData.length === 0) return [];

            // Get the actual tickets
            const ticketIds = participantsData.map((p) => p.ticket_id);

            let ticketsQuery = supabase
                .from("tickets")
                .select("*")
                .in("id", ticketIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectId) {
                ticketsQuery = ticketsQuery.eq("project_id", projectId);
            }

            const { data: ticketsData, error: ticketsError } =
                await ticketsQuery;

            if (ticketsError) throw ticketsError;
            return ticketsData || [];
        },
        enabled: !!helperId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}
