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
                .select("project_id, name")
                .in("project_id", projectIds);
            const projectsMap = new Map(projects?.map((p: any) => [p.project_id, p]) || []);

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

            return tickets.map((ticket: any) => ({
                ...ticket,
                keywords:
                    ticket.keywords?.map((k: any) => ({ value: k.keyword?.value })) || [],
                help_categories:
                    ticket.categories
                        ?.filter((c: any) => c.help_category)
                        ?.map((c: any) => ({
                            value: c.help_category.value,
                            type: c.help_category.type || "default",
                        })) || [],
                project: projectsMap.get(ticket.project_id) || null,
                message_count: countsMap.get(ticket.id) || 0,
            })) as (TicketWithDetails & { project: { project_id: string; name: string } | null })[];
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
