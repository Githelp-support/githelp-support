import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
type TicketUpdate = Database["public"]["Tables"]["tickets"]["Update"];

export function useTickets(projectId?: string) {
    return useQuery({
        queryKey: ["tickets", projectId],
        queryFn: async () => {
            let query = supabase
                .from("tickets")
                .select("*")
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectId) {
                query = query.eq("project_id", projectId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as Ticket[];
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useTicket(ticketId: string) {
    return useQuery({
        queryKey: ["ticket", ticketId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select("*")
                .eq("id", ticketId)
                .single();

            if (error) throw error;
            return data as Ticket;
        },
        enabled: !!ticketId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useCreateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ticket: TicketInsert) => {
            const { data, error } = await supabase
                .from("tickets")
                .insert(ticket)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["tickets", data.project_id],
            });
            queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
        },
    });
}

export function useUpdateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: TicketUpdate;
        }) => {
            const { data, error } = await supabase
                .from("tickets")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["ticket", data.id] });
            queryClient.invalidateQueries({
                queryKey: ["tickets", data.project_id],
            });
        },
    });
}

/**
 * Customer-side "End session" intent.
 *
 * The ticket creator can't end a session (that's the helper's job — they log
 * remaining time and pick an outcome in the End ticket drawer). Instead they
 * flag the ticket with `end_requested_at`; the helper's page picks that up
 * over the `tickets` realtime channel and prompts them to finalise. The
 * customer can withdraw the request any time until the helper ends the
 * session. Both directions also leave a `tickets_events` audit row.
 */
export function useRequestEndSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            userId,
            cancel = false,
        }: {
            ticketId: string;
            userId: string;
            /** true = withdraw a previous request */
            cancel?: boolean;
        }) => {
            const updates: TicketUpdate = cancel
                ? { end_requested_at: null, end_requested_by: null }
                : { end_requested_at: new Date().toISOString(), end_requested_by: userId };

            const { data, error } = await supabase
                .from("tickets")
                .update(updates)
                .eq("id", ticketId)
                // Only meaningful while the session is live; never resurrect a
                // request on an already-ended ticket.
                .in("status", ["available", "claimed", "in-progress"])
                .select()
                .single();

            if (error) throw error;

            void supabase.from("tickets_events").insert({
                ticket_id: ticketId,
                type: cancel ? "end_request_cancelled" : "end_requested",
                payload: { by: userId },
            });

            return data as Ticket;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["ticket", data.id] });
            queryClient.invalidateQueries({ queryKey: ["ticket-with-details", data.id] });
        },
    });
}
