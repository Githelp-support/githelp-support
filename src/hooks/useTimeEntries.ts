import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { isBillableTimeEntry, type TimeEntry, type TimeEntryReviewStatus } from "@/lib/time-entries";

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
            name: string;
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
            user:users_public(name)
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

export interface ReviewTimeEntryInput {
    entryId: string;
    ticketId: string;
    decision: Exclude<TimeEntryReviewStatus, "pending">;
    /** Required when declining; shared with the helper in the ticket chat. */
    reason?: string;
}

/**
 * `hint` of the error raised by the `review_time_entry` RPC, e.g.
 * "reason_required", "already_reviewed", "ticket_ended", "not_ticket_creator".
 */
export function getReviewTimeEntryErrorHint(error: unknown): string | null {
    if (typeof error !== "object" || error === null) return null;
    const hint = (error as { hint?: unknown }).hint;
    return typeof hint === "string" ? hint : null;
}

/**
 * Ticket creator accepts or declines one logged entry via the
 * `review_time_entry` RPC. The RPC also posts a system message into the chat
 * (with the decline reason), so both the time entries and the message thread
 * are refreshed afterwards.
 */
export function useReviewTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: ReviewTimeEntryInput) => {
            const reason = input.reason?.trim() ?? "";
            if (input.decision === "declined" && !reason) {
                throw Object.assign(new Error("Please explain why you declined the logged time."), {
                    hint: "reason_required",
                });
            }
            const { data, error } = await supabase.rpc("review_time_entry", {
                p_entry_id: input.entryId,
                p_decision: input.decision,
                p_reason: input.decision === "declined" ? reason : null,
            });
            if (error) throw error;
            return data as TimeEntry;
        },
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({
                predicate: (q) => q.queryKey[0] === "time-entries" && q.queryKey[2] === input.ticketId,
            });
            queryClient.invalidateQueries({ queryKey: ["ticket-messages", input.ticketId] });
        },
    });
}
