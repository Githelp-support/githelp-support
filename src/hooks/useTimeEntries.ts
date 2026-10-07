import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { TimeEntry } from "@/lib/time-entries";

// Types and pure helpers live in @/lib/time-entries; re-exported here so existing imports keep working.
export * from "@/lib/time-entries";

export interface TimeEntryWithDetails extends TimeEntry {
    ticket?: {
        id: string;
        title: string;
        project_id?: string;
    };
    helper?: {
        user?: {
            id: string;
            name: string;
            avatar_url?: string | null;
        };
    };
}

export function useTimeEntries(
    filters?: {
        helperId?: string;
        ticketId?: string;
        projectId?: string;
        startDate?: string;
        endDate?: string;
    },
    options?: { enabled?: boolean }
) {
    return useQuery({
        enabled: options?.enabled !== false,
        queryKey: [
            "time-entries",
            filters?.helperId,
            filters?.ticketId,
            filters?.projectId,
            filters?.startDate,
            filters?.endDate,
        ],
        queryFn: async () => {
            let query = supabase
                .from("tickets_time_entries")
                .select(
                    `
          *,
          ticket:tickets(id, title, project_id),
          helper:projects_helpers(
            user:users_public(id, name, avatar_url)
          )
        `
                )
                .order("created_at", { ascending: false });

            if (filters?.helperId) {
                query = query.eq("helper_id", filters.helperId);
            }
            if (filters?.ticketId) {
                query = query.eq("ticket_id", filters.ticketId);
            }
            if (filters?.startDate) {
                query = query.gte("date", filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte("date", filters.endDate);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Transform nested data and filter by projectId if provided
            let entries = (data || []).map((entry: any) => {
                const rawHelper = entry.helper;
                const helper =
                    rawHelper == null
                        ? null
                        : Array.isArray(rawHelper)
                          ? rawHelper[0] ?? null
                          : rawHelper;
                return {
                    ...entry,
                    ticket: entry.ticket || null,
                    helper,
                };
            }) as TimeEntryWithDetails[];

            // Filter by projectId after fetching (since we need to check via ticket relationship)
            if (filters?.projectId) {
                entries = entries.filter(
                    (entry) => entry.ticket?.project_id === filters.projectId
                );
            }

            return entries;
        },
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export interface CreateTimeEntryInput {
    ticketId: string;
    helperId: string;
    type: "together" | "solo";
    timeMilliseconds: number;
    note: string | null;
    date: string; // YYYY-MM-DD
}

/**
 * True when an insert was rejected by the database payment gate (trigger
 * `tickets_time_entries_payment_gate`, backend migration
 * 20260918130000_time_entries_payment_gate): the ticket is neither SLA-covered
 * nor free support and has no authorized payment hold.
 */
export function isPaymentNotAuthorizedError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        (error as { hint?: unknown }).hint === "payment_not_authorized"
    );
}

export function useCreateTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateTimeEntryInput) => {
            const { data, error } = await supabase
                .from("tickets_time_entries")
                .insert({
                    ticket_id: input.ticketId,
                    helper_id: input.helperId,
                    type: input.type,
                    time_milliseconds: input.timeMilliseconds,
                    note: input.note || null,
                    date: input.date,
                })
                .select("id")
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
        },
        onError: (error, input) => {
            // The database disagreed with the UI's payment gate, so whatever the
            // gate was based on is stale (typically cached payment settings after
            // a project switched from free to paid). Refetch both so it closes.
            if (isPaymentNotAuthorizedError(error)) {
                queryClient.invalidateQueries({ queryKey: ["project-payment-settings"] });
                queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", input.ticketId] });
            }
        },
    });
}

export interface DeleteTimeEntryInput {
    entryId: string;
    ticketId: string;
}

/**
 * Helper deletes one of their own entries. RLS (tickets_time_entries_delete_own)
 * limits this to the helper's own rows; a trigger rejects it on an ended
 * ticket (hint "ticket_ended") or for an accepted entry ("accepted_entry_locked"),
 * and otherwise posts a `time_entry_deleted` system message into the chat.
 */
export function useDeleteTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: DeleteTimeEntryInput) => {
            const { data, error } = await supabase
                .from("tickets_time_entries")
                .delete()
                .eq("id", input.entryId)
                .select("id");
            if (error) throw error;
            // RLS filters rows silently: nothing deleted means it wasn't ours.
            if (!data || data.length === 0) {
                throw Object.assign(new Error("You can only delete time you logged yourself."), {
                    hint: "not_entry_owner",
                });
            }
        },
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({
                predicate: (q) => q.queryKey[0] === "time-entries" && q.queryKey[2] === input.ticketId,
            });
            queryClient.invalidateQueries({ queryKey: ["ticket-messages", input.ticketId] });
        },
    });
}

/**
 * `hint` of the error raised by the time-entry RPCs and guard triggers, e.g.
 * "reason_required", "nothing_to_confirm", "already_requested", "ticket_ended",
 * "not_ticket_creator", "accepted_entry_locked".
 */
export function getReviewTimeEntryErrorHint(error: unknown): string | null {
    if (typeof error !== "object" || error === null) return null;
    const hint = (error as { hint?: unknown }).hint;
    return typeof hint === "string" ? hint : null;
}

const invalidateTicketTimeQueries = (queryClient: ReturnType<typeof useQueryClient>, ticketId: string) => {
    queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "time-entries" && q.queryKey[2] === ticketId,
    });
    queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["ticket-with-details", ticketId] });
};

/**
 * Helper sends the logged-time summary to the customer for confirmation
 * (`request_time_entry_review` RPC, migration
 * 20261008120000_time_entries_summary_confirmation). Sets
 * `tickets.time_review_requested_at` and posts a `time_review_requested`
 * system message. Errors: "nothing_to_confirm", "already_requested",
 * "ticket_ended", "not_ticket_helper".
 */
export function useRequestTimeEntryReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { ticketId: string }) => {
            const { error } = await supabase.rpc("request_time_entry_review", { p_ticket_id: input.ticketId });
            if (error) throw error;
        },
        onSettled: (_data, _error, input) => invalidateTicketTimeQueries(queryClient, input.ticketId),
    });
}

export interface TimeEntryDecline {
    entryId: string;
    /** Required; shared with the helper in the ticket chat. */
    reason: string;
}

export interface ConfirmTimeEntriesInput {
    ticketId: string;
    /** Entries the customer does not accept. Everything else pending is accepted. */
    declines?: TimeEntryDecline[];
}

/**
 * Ticket creator confirms the logged-time summary in one go via the
 * `confirm_time_entries` RPC: every pending entry on the ticket is accepted
 * except the listed declines, which need a reason. The RPC posts one
 * `time_entries_confirmed` system message (with the declines and reasons) and
 * clears the helper's request, so the entries, messages and ticket row are
 * all refreshed afterwards. Resolves to the number of entries accepted.
 */
export function useConfirmTimeEntries() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: ConfirmTimeEntriesInput) => {
            const declines = (input.declines ?? []).map((d) => ({ entry_id: d.entryId, reason: d.reason.trim() }));
            if (declines.some((d) => !d.reason)) {
                throw Object.assign(new Error("Please explain why you declined the logged time."), {
                    hint: "reason_required",
                });
            }
            const { data, error } = await supabase.rpc("confirm_time_entries", {
                p_ticket_id: input.ticketId,
                p_declines: declines,
            });
            if (error) throw error;
            return (data as number | null) ?? 0;
        },
        onSettled: (_data, _error, input) => invalidateTicketTimeQueries(queryClient, input.ticketId),
    });
}
