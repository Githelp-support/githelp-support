import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type TicketParticipant =
    Database["public"]["Tables"]["tickets_participants"]["Row"];
type TicketParticipantInsert =
    Database["public"]["Tables"]["tickets_participants"]["Insert"];
type TicketParticipantUpdate =
    Database["public"]["Tables"]["tickets_participants"]["Update"];

export interface ParticipantWithUser {
    id: string;
    participant_id: string;
    claimed: boolean;
    created_at: string;
    user: {
        id: string;
        name: string;
        avatar_url: string | null;
    };
}

// Export the query function so it can be reused
export async function fetchTicketParticipants(
    ticketId: string
): Promise<ParticipantWithUser[]> {
    const { data, error } = await supabase
        .from("tickets_participants")
        .select("*")
        .eq("ticket_id", ticketId);

    if (error) throw error;

    // Get user profiles for all participants
    const participantIds = (data || []).map((p: any) => p.participant_id);
    const { data: users } = await supabase
        .from("users_public")
        .select("id, name, avatar_url")
        .in("id", participantIds);

    const usersMap = new Map(users?.map((u: any) => [u.id, u]) || []);

    // Transform the data to include user info
    return (data || []).map((participant: any) => {
        const user = usersMap.get(participant.participant_id);
        return {
            id: participant.id,
            participant_id: participant.participant_id,
            claimed: participant.claimed || false,
            created_at: participant.created_at,
            user: user || {
                id: participant.participant_id,
                name: "Unknown",
                avatar_url: null,
            },
        };
    }) as ParticipantWithUser[];
}

export function useTicketParticipants(ticketId: string) {
    return useQuery({
        queryKey: ["ticket-participants", ticketId],
        queryFn: () => fetchTicketParticipants(ticketId),
        enabled: !!ticketId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

/** Returns ticket IDs in the given project where the current user is a participant (for helper dashboard). */
export function useMyParticipatingTicketIds(projectId?: string) {
    return useQuery({
        queryKey: ["my-participating-ticket-ids", projectId],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id || !projectId) return new Set<string>();

            const { data: ticketIds } = await supabase
                .from("tickets")
                .select("id")
                .eq("project_id", projectId)
                .is("deleted_at", null);

            const ids = (ticketIds || []).map((t: { id: string }) => t.id);
            if (ids.length === 0) return new Set<string>();

            const { data: rows } = await supabase
                .from("tickets_participants")
                .select("ticket_id")
                .eq("participant_id", user.id)
                .in("ticket_id", ids);

            return new Set((rows || []).map((r: { ticket_id: string }) => r.ticket_id));
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 60000,
    });
}

export function useClaimTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            participantId,
        }: {
            ticketId: string;
            participantId: string;
        }) => {
            // First, check if participant already exists
            const { data: existing } = await supabase
                .from("tickets_participants")
                .select("id")
                .eq("ticket_id", ticketId)
                .eq("participant_id", participantId)
                .single();

            if (existing) {
                // Update existing participant to set claimed = true
                const { data, error } = await supabase
                    .from("tickets_participants")
                    .update({ claimed: true })
                    .eq("id", existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // Insert new participant with claimed = true
                const { data, error } = await supabase
                    .from("tickets_participants")
                    .insert({
                        ticket_id: ticketId,
                        participant_id: participantId,
                        claimed: true,
                    })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        },
        onSuccess: async (data, variables) => {
            // Invalidate participants query
            queryClient.invalidateQueries({
                queryKey: ["ticket-participants", variables.ticketId],
            });
            // Invalidate ticket query to refresh status
            queryClient.invalidateQueries({
                queryKey: ["ticket", variables.ticketId],
            });
            queryClient.invalidateQueries({ queryKey: ["tickets"] });

            // Fire-and-forget: invoke payments-authorize-on-claim. Failures
            // are non-fatal — the claim itself stands; the customer can
            // retry from the chat CTA if a system message wasn't written.
            try {
                const resp = await supabase.functions.invoke(
                    "payments-authorize-on-claim",
                    { body: { ticket_id: variables.ticketId } },
                );
                if (resp.error) {
                    console.warn(
                        `payments-authorize-on-claim failed for ${variables.ticketId}:`,
                        resp.error.message,
                    );
                }
            } catch (err) {
                console.warn(
                    `payments-authorize-on-claim threw for ${variables.ticketId}:`,
                    err,
                );
            }
        },
    });
}

/** Add a participant with claimed: false if not already present. Use when a helper replies without claiming. */
export function useEnsureParticipant() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            participantId,
            claimed = false,
        }: {
            ticketId: string;
            participantId: string;
            claimed?: boolean;
        }) => {
            const { data: existing } = await supabase
                .from("tickets_participants")
                .select("id")
                .eq("ticket_id", ticketId)
                .eq("participant_id", participantId)
                .maybeSingle();

            if (existing) return existing;

            const { data, error } = await supabase
                .from("tickets_participants")
                .insert({
                    ticket_id: ticketId,
                    participant_id: participantId,
                    claimed,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["ticket-participants", variables.ticketId],
            });
        },
    });
}

/** Update last_read_message_id for a participant when they have seen the latest message. */
export function useUpdateLastReadMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            participantId,
            messageId,
        }: {
            ticketId: string;
            participantId: string;
            messageId: string;
        }) => {
            const { data, error } = await supabase
                .from("tickets_participants")
                .update({ last_read_message_id: messageId })
                .eq("ticket_id", ticketId)
                .eq("participant_id", participantId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["ticket-participants", variables.ticketId],
            });
            // Also refresh helper sidebar data that depends on last_read_message_id
            queryClient.invalidateQueries({
                queryKey: ["helper-claimed-tickets-sidebar"],
            });
        },
    });
}
