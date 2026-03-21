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
