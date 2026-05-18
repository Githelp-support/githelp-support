import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface TimeEntry {
    id: string;
    ticket_id: string;
    helper_id: string;
    type: "together" | "solo";
    time_milliseconds: number;
    note: string | null;
    date: string;
    created_at: string;
}

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

// Helper function to format milliseconds to human-readable time
export function formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
}

// Helper function to calculate total time from entries
export function calculateTotalTime(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => total + entry.time_milliseconds, 0);
}

/** Convert time_milliseconds to { hours, minutes } for display */
export function timeMillisecondsToHoursMinutes(ms: number): { hours: number; minutes: number } {
    const totalMinutes = Math.floor(ms / 60000);
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export interface CreateTimeEntryInput {
    ticketId: string;
    helperId: string;
    type: "together" | "solo";
    timeMilliseconds: number;
    note: string | null;
    date: string; // YYYY-MM-DD
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
    });
}
