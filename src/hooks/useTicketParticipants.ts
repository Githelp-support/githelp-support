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

/**
 * Returns the set of ticket IDs in the given project that are taken by ANOTHER
 * helper — i.e. a `tickets_participants` row exists for a participant who is
 * neither the current user nor the ticket creator (whether they have claimed
 * the ticket or are merely participating in the chat). Used to decide whether
 * a ticket is still "Unclaimed" from the current helper's perspective. Purely
 * derived from existing tables — no backend changes.
 */
export function useOtherHelperParticipatingTicketIds(projectId?: string) {
    return useQuery({
        queryKey: ["other-helper-participating-ticket-ids", projectId],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!projectId) return new Set<string>();
            const currentUserId = user?.id ?? null;

            const { data: ticketRows } = await supabase
                .from("tickets")
                .select("id, created_by")
                .eq("project_id", projectId)
                .is("deleted_at", null);

            const ids = (ticketRows || []).map((t: { id: string }) => t.id);
            if (ids.length === 0) return new Set<string>();

            const creatorByTicket = new Map(
                (ticketRows || []).map(
                    (t: { id: string; created_by: string | null }) => [
                        t.id,
                        t.created_by,
                    ]
                )
            );

            const { data: rows } = await supabase
                .from("tickets_participants")
                .select("ticket_id, participant_id")
                .in("ticket_id", ids);

            const taken = new Set<string>();
            (rows || []).forEach(
                (r: { ticket_id: string; participant_id: string }) => {
                    // Skip the current user (it's "me", not another helper) and
                    // the ticket creator (the end-user asking for help).
                    if (r.participant_id === currentUserId) return;
                    if (r.participant_id === creatorByTicket.get(r.ticket_id))
                        return;
                    taken.add(r.ticket_id);
                }
            );

            return taken;
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
        onSuccess: (data, variables) => {
            // Invalidate participants query
            queryClient.invalidateQueries({
                queryKey: ["ticket-participants", variables.ticketId],
            });
            // Invalidate ticket query to refresh status
            queryClient.invalidateQueries({
                queryKey: ["ticket", variables.ticketId],
            });
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
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
