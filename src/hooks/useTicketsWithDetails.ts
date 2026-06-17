import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface TicketWithDetails {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    created_by: string | null;
    project_id: string;
    keywords?: Array<{ value: string }>;
    help_categories?: Array<{ value: string; type: string }>;
    user?: {
        name: string;
        username: string | null;
        email: string | null;
    };
    message_count?: number;
}

export function useTicketsWithDetails(projectId?: string) {
    return useQuery({
        queryKey: ["tickets-with-details", projectId],
        queryFn: async () => {
            let query = supabase
                .from("tickets")
                .select(
                    `
          *,
          keywords:tickets_keywords(
            keyword:projects_keywords(value)
          ),
          categories:tickets_help_categories(
            help_category:projects_help_categories(value, type)
          )
        `
                )
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectId) {
                query = query.eq("project_id", projectId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Get user profiles separately since there's no direct FK from tickets to users_public
            const userIds = [
                ...new Set(
                    (data || []).map((t: any) => t.created_by).filter(Boolean)
                ),
            ];
            const { data: users } = await supabase
                .from("users_public")
                .select("*")
                .in("id", userIds);

            const usersMap = new Map(users?.map((u: any) => [u.id, u]) || []);

            // Get message counts separately
            const ticketIds = (data || []).map((t: any) => t.id);
            const { data: messageCounts } = await supabase
                .from("tickets_messages")
                .select("ticket_id")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null);

            const countsMap = new Map<string, number>();
            messageCounts?.forEach((msg: any) => {
                countsMap.set(
                    msg.ticket_id,
                    (countsMap.get(msg.ticket_id) || 0) + 1
                );
            });

            // Transform the data to a flatter structure
            return (data || []).map((ticket: any) => ({
                ...ticket,
                keywords:
                    ticket.keywords?.map((k: any) => ({
                        value: k.keyword?.value,
                    })) || [],
                help_categories:
                    ticket.categories
                        ?.filter((c: any) => c.help_category)
                        ?.map((c: any) => ({
                            value: c.help_category.value,
                            type: c.help_category.type || "default",
                        })) || [],
                user: ticket.created_by
                    ? usersMap.get(ticket.created_by)
                    : null,
                message_count: countsMap.get(ticket.id) || 0,
            })) as TicketWithDetails[];
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export interface UserActiveTicketSidebarItem {
    id: string;
    title: string;
    subtitle: string;
    date: string;
    avatarUrl: string | null;
    avatarInitial: string;
    current: boolean;
    hasNotification: boolean;
}

export interface UserActiveTicketsSidebarResult {
    items: UserActiveTicketSidebarItem[];
    activeCount: number;
}

const USER_SIDEBAR_SUBTITLE_MAX_CHARS = 50;

/**
 * Latest active tickets the given user has created (for sidebar on Support chat).
 * "Active" = status not in (completed, cancelled). Avatar uses the project's
 * branding logo / initial, mirroring the helper sidebar visual structure.
 * Always includes the current ticket if provided, even if it would be outside
 * the `limit` window. Also returns `activeCount` — total number of active
 * tickets (independent of the `limit` applied to the displayed items). Used by
 * the UI to render "Active tickets (N)".
 */
export function useUserActiveTicketsSidebar(
    userId: string | undefined,
    currentTicketId: string | undefined,
    limit = 3
) {
    return useQuery({
        queryKey: ["user-active-tickets-sidebar", userId, currentTicketId, limit],
        queryFn: async (): Promise<UserActiveTicketsSidebarResult> => {
            if (!userId) return { items: [], activeCount: 0 };

            const { data: activeTickets, error: ticketsError } = await supabase
                .from("tickets")
                .select(
                    "id, title, description, created_at, updated_at, project_id, status"
                )
                .eq("created_by", userId)
                .is("deleted_at", null)
                .not("status", "in", "(completed,cancelled)")
                .order("updated_at", { ascending: false });

            if (ticketsError) throw ticketsError;
            const activeCount = (activeTickets ?? []).length;
            let tickets = activeTickets ?? [];

            // Ensure the current ticket is included even if it's not "active"
            // (e.g. just-ended) or wasn't created by this user — the requirement
            // is that the open/displayed ticket appears in the list.
            if (
                currentTicketId &&
                !tickets.some((t) => t.id === currentTicketId)
            ) {
                const { data: currentTicket } = await supabase
                    .from("tickets")
                    .select(
                        "id, title, description, created_at, updated_at, project_id, status"
                    )
                    .eq("id", currentTicketId)
                    .is("deleted_at", null)
                    .maybeSingle();
                if (currentTicket) {
                    tickets = [currentTicket, ...tickets];
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

            const projectIds = [
                ...new Set(tickets.map((t) => t.project_id)),
            ];

            const { data: projects } = await supabase
                .from("projects")
                .select("project_id, name")
                .in("project_id", projectIds);
            const projectMap = new Map(
                projects?.map((p) => [p.project_id, p.name]) ?? []
            );

            const { data: brandings } = await supabase
                .from("projects_branding")
                .select("project_id, logo_url")
                .in("project_id", projectIds);
            const brandingMap = new Map(
                brandings?.map((b) => [b.project_id, b.logo_url]) ?? []
            );

            const ticketIds = tickets.map((t) => t.id);
            const { data: partRows } = await supabase
                .from("tickets_participants")
                .select("ticket_id, last_read_message_id")
                .eq("participant_id", userId)
                .in("ticket_id", ticketIds);
            const lastReadByTicket = new Map(
                (partRows ?? []).map((p) => [
                    p.ticket_id,
                    p.last_read_message_id ?? null,
                ])
            );

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
                const projectLogo = brandingMap.get(t.project_id) ?? null;
                const firstMsg =
                    firstMessageByTicket.get(t.id)?.content ??
                    t.description ??
                    "";
                const subtitle =
                    firstMsg.length > USER_SIDEBAR_SUBTITLE_MAX_CHARS
                        ? firstMsg
                              .slice(0, USER_SIDEBAR_SUBTITLE_MAX_CHARS)
                              .trim() + "…"
                        : firstMsg.trim() || "—";
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
                    avatarUrl: projectLogo,
                    avatarInitial: projectName[0]?.toUpperCase() ?? "?",
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
 * The single most recently active ticket created by the user, ordered by
 * `updated_at` desc (i.e. the last ticket they were active in). Used to land
 * the user on that ticket when the Support page is opened without any params,
 * instead of the most recently *created* ticket.
 */
export function useLatestUserActiveTicket(userId?: string) {
    return useQuery({
        queryKey: ["latest-user-active-ticket", userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data, error } = await supabase
                .from("tickets")
                .select("id, project_id, updated_at")
                .eq("created_by", userId)
                .is("deleted_at", null)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data as { id: string; project_id: string; updated_at: string } | null;
        },
        enabled: !!userId,
        retry: false,
        staleTime: 60000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

/** Fetch all tickets created by the given user (for "User" role tickets list). */
export function useUserTickets(userId?: string) {
    return useQuery({
        queryKey: ["user-tickets", userId],
        queryFn: async () => {
            if (!userId) return [];

            const { data, error } = await supabase
                .from("tickets")
                .select(
                    `
          *,
          keywords:tickets_keywords(
            keyword:projects_keywords(value)
          ),
          categories:tickets_help_categories(
            help_category:projects_help_categories(value, type)
          )
        `
                )
                .eq("created_by", userId)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (error) throw error;
            const tickets = data || [];

            const projectIds = [...new Set(tickets.map((t: any) => t.project_id).filter(Boolean))];
            const { data: projects } = await supabase
                .from("projects")
                .select("project_id, name, logo_url")
                .in("project_id", projectIds);
            const projectsMap = new Map(projects?.map((p: any) => [p.project_id, p]) || []);

            // Fetch project branding (logo) for the dp icon shown in the tickets list.
            const { data: brandings } = await supabase
                .from("projects_branding")
                .select("project_id, logo_url")
                .in("project_id", projectIds);
            const brandingMap = new Map(
                brandings?.map((b: any) => [b.project_id, b]) || []
            );

            const ticketIds = tickets.map((t: any) => t.id);
            const { data: messageCounts } = await supabase
                .from("tickets_messages")
                .select("ticket_id")
                .in("ticket_id", ticketIds)
                .is("deleted_at", null);
            const countsMap = new Map<string, number>();
            messageCounts?.forEach((msg: any) => {
                countsMap.set(msg.ticket_id, (countsMap.get(msg.ticket_id) || 0) + 1);
            });

            // Fetch the helper (if any) who has claimed each ticket. A ticket is
            // "claimed" when a participant row exists with claimed=true and the
            // participant is NOT the ticket creator.
            const { data: participants } = await supabase
                .from("tickets_participants")
                .select("ticket_id, participant_id")
                .in("ticket_id", ticketIds)
                .eq("claimed", true);
            const claimerByTicket = new Map<string, string>();
            participants?.forEach((p: any) => {
                if (p.participant_id && p.participant_id !== userId) {
                    if (!claimerByTicket.has(p.ticket_id)) {
                        claimerByTicket.set(p.ticket_id, p.participant_id);
                    }
                }
            });
            const claimerIds = [...new Set(claimerByTicket.values())];
            const { data: claimerUsers } = claimerIds.length
                ? await supabase
                      .from("users_public")
                      .select("id, name, avatar_url")
                      .in("id", claimerIds)
                : { data: [] as any[] };
            const claimerUserMap = new Map(
                claimerUsers?.map((u: any) => [u.id, u]) || []
            );

            return tickets.map((ticket: any) => {
                const project = projectsMap.get(ticket.project_id) || null;
                const branding = brandingMap.get(ticket.project_id) || null;
                const claimerId = claimerByTicket.get(ticket.id) || null;
                const claimer = claimerId
                    ? claimerUserMap.get(claimerId) || null
                    : null;
                return {
                    ...ticket,
                    keywords:
                        ticket.keywords?.map((k: any) => ({
                            value: k.keyword?.value,
                        })) || [],
                    help_categories:
                        ticket.categories
                            ?.filter((c: any) => c.help_category)
                            ?.map((c: any) => ({
                                value: c.help_category.value,
                                type: c.help_category.type || "default",
                            })) || [],
                    project,
                    project_logo_url:
                        (branding as any)?.logo_url ??
                        (project as any)?.logo_url ??
                        null,
                    project_name: (project as any)?.name ?? null,
                    helper: claimer
                        ? {
                              id: (claimer as any).id,
                              name: (claimer as any).name,
                              avatar_url: (claimer as any).avatar_url ?? null,
                          }
                        : null,
                    message_count: countsMap.get(ticket.id) || 0,
                };
            }) as (TicketWithDetails & {
                project: { project_id: string; name: string } | null;
                project_logo_url: string | null;
                project_name: string | null;
                helper: { id: string; name: string; avatar_url: string | null } | null;
            })[];
        },
        enabled: !!userId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useTicketWithDetails(ticketId?: string) {
    return useQuery({
        queryKey: ["ticket-with-details", ticketId],
        queryFn: async () => {
            if (!ticketId) return null;

            const { data: ticket, error: ticketError } = await supabase
                .from("tickets")
                .select(
                    `
          *,
          keywords:tickets_keywords(
            keyword:projects_keywords(value)
          ),
          categories:tickets_help_categories(
            help_category:projects_help_categories(value, type)
          )
        `
                )
                .eq("id", ticketId)
                .is("deleted_at", null)
                .single();

            if (ticketError) throw ticketError;
            if (!ticket) return null;

            let user = null;
            if (ticket.created_by) {
                const { data: u } = await supabase
                    .from("users_public")
                    .select("*")
                    .eq("id", ticket.created_by)
                    .single();
                user = u;
            }

            return {
                ...ticket,
                keywords:
                    (ticket as any).keywords?.map((k: any) => ({
                        value: k.keyword?.value,
                    })) || [],
                help_categories:
                    (ticket as any).categories
                        ?.filter((c: any) => c.help_category)
                        ?.map((c: any) => ({
                            value: c.help_category.value,
                            type: c.help_category.type || "default",
                        })) || [],
                user,
            } as TicketWithDetails;
        },
        enabled: !!ticketId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}
