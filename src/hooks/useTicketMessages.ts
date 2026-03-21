import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { fetchTicketParticipants } from "./useTicketParticipants";

type Message = Database["public"]["Tables"]["tickets_messages"]["Row"];
type MessageInsert = Database["public"]["Tables"]["tickets_messages"]["Insert"];
type MessageUpdate = Database["public"]["Tables"]["tickets_messages"]["Update"];

export function useTicketMessages(ticketId: string) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ["ticket-messages", ticketId],
        queryFn: async () => {
            // First, get all messages
            const { data: messages, error: messagesError } = await supabase
                .from("tickets_messages")
                .select("*")
                .eq("ticket_id", ticketId)
                .is("deleted_at", null)
                .order("created_at", { ascending: true });

            if (messagesError) throw messagesError;

            if (!messages || messages.length === 0) {
                return [] as (Message & { sender: any })[];
            }

            // Get participants using the same function as useTicketParticipants
            const participants = await queryClient.fetchQuery({
                queryKey: ["ticket-participants", ticketId],
                queryFn: () => fetchTicketParticipants(ticketId),
            });

            const senderMap = new Map(
                participants.map((p) => [p.participant_id, p.user])
            );

            const missingSenderIds = [...new Set(messages.map((m: any) => m.sender_id).filter((id: string) => !senderMap.has(id)))];
            if (missingSenderIds.length > 0) {
                const { data: users } = await supabase
                    .from("users_public")
                    .select("id, name, avatar_url")
                    .in("id", missingSenderIds);
                users?.forEach((u: { id: string; name: string; avatar_url: string | null }) => {
                    senderMap.set(u.id, { id: u.id, name: u.name, avatar_url: u.avatar_url });
                });
            }

            return messages.map((message: any) => ({
                ...message,
                sender: senderMap.get(message.sender_id) || null,
            })) as (Message & { sender: any })[];
        },
        enabled: !!ticketId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (message: MessageInsert) => {
            // Insert the message
            const { data: insertedMessage, error: insertError } = await supabase
                .from("tickets_messages")
                .insert(message)
                .select("*")
                .single();

            if (insertError) throw insertError;

            // Get participants using the same function as useTicketParticipants
            const participants = await queryClient.fetchQuery({
                queryKey: ["ticket-participants", insertedMessage.ticket_id],
                queryFn: () =>
                    fetchTicketParticipants(insertedMessage.ticket_id),
            });

            // Find the participant that matches the sender_id
            const participant = participants.find(
                (p) => p.participant_id === insertedMessage.sender_id
            );

            // Return message with sender info from participant
            return {
                ...insertedMessage,
                sender: participant?.user || null,
            };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["ticket-messages", data.ticket_id],
            });
        },
    });
}

export function useUpdateMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: MessageUpdate;
        }) => {
            const { data, error } = await supabase
                .from("tickets_messages")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["ticket-messages", data.ticket_id],
            });
        },
    });
}
