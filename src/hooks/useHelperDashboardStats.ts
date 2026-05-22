import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCurrentHelper } from "./useCurrentHelper";
import {
    useTimeEntries,
    formatTime,
    calculateTotalTime,
} from "./useTimeEntries";
import {
    buildIssueTypeStatsRow,
    UNCATEGORIZED_ISSUE_TYPE,
    type IssueTypeStats,
    type KeyStats,
} from "./useDashboardStats";

/** A single in-progress ticket the helper is involved with (for table rows). */
export interface HelperInProgressTicket {
    id: string;
    title: string;
    status: "claimed" | "in-progress";
    priority: "low" | "medium" | "high";
    created_at: string;
}

export interface HelperDashboardStats {
    keyStats: KeyStats;
    issueTypeStats: IssueTypeStats[];
    inProgressTickets: HelperInProgressTicket[];
}

/**
 * Dashboard stats scoped to a single helper.
 *
 * Modeled on `useDashboardStats`, but every metric is restricted to the work
 * done by `helperId`:
 *  - Key stats: tickets the helper completed, total time the helper logged,
 *    and the percentage solved relative to tickets the helper worked on.
 *  - Issue type stats: restricted to tickets the helper logged time on.
 *  - In-progress tickets: tickets with status `in-progress`/`claimed` that the
 *    helper has logged time on or is assigned to (claimed participant).
 *
 * When `helperId` is omitted it falls back to the current helper for
 * `projectId` (via `useCurrentHelper`).
 */
export function useHelperDashboardStats(projectId?: string, helperId?: string) {
    const { data: currentHelperId } = useCurrentHelper(projectId);
    const effectiveHelperId = helperId ?? currentHelperId ?? undefined;

    const { data: timeEntries } = useTimeEntries(
        { projectId, helperId: effectiveHelperId },
        { enabled: !!projectId && !!effectiveHelperId }
    );

    return useQuery({
        queryKey: ["helper-dashboard-stats", projectId, effectiveHelperId],
        queryFn: async (): Promise<HelperDashboardStats> => {
            if (!projectId || !effectiveHelperId || timeEntries === undefined) {
                return {
                    keyStats: {
                        totalTicketsSolved: 0,
                        totalTimeSpent: "-",
                        percentageSolved: 0,
                    },
                    issueTypeStats: [],
                    inProgressTickets: [],
                };
            }

            // The helper's user_id — needed to find tickets assigned (claimed)
            // to them via tickets_participants.
            const { data: helperRow } = await supabase
                .from("projects_helpers")
                .select("user_id")
                .eq("helper_id", effectiveHelperId)
                .single();

            // All (non-deleted) tickets for the project.
            const { data: tickets } = await supabase
                .from("tickets")
                .select("id, title, status, priority, created_at")
                .eq("project_id", projectId)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            // Help categories for the project.
            const { data: helpCategories } = await supabase
                .from("projects_help_categories")
                .select("id, value")
                .eq("project_id", projectId);

            // `timeEntries` is already filtered to this helper + project.
            const helperTimeEntries = timeEntries;
            const helperTicketIds = [
                ...new Set(helperTimeEntries.map((entry) => entry.ticket_id)),
            ];

            // --- Key stats (this helper only) ---
            const ticketsWorkedOn =
                tickets?.filter((ticket) =>
                    helperTicketIds.includes(ticket.id)
                ) ?? [];
            const completedTickets = ticketsWorkedOn.filter(
                (ticket) => ticket.status === "completed"
            );
            const totalTime = calculateTotalTime(helperTimeEntries);

            const keyStats: KeyStats = {
                totalTicketsSolved: completedTickets.length,
                totalTimeSpent: totalTime > 0 ? formatTime(totalTime) : "-",
                percentageSolved:
                    ticketsWorkedOn.length > 0
                        ? Math.round(
                              (completedTickets.length /
                                  ticketsWorkedOn.length) *
                                  100
                          )
                        : 0,
            };

            // --- In-progress tickets (logged time on OR assigned to) ---
            let assignedTicketIds: string[] = [];
            if (helperRow?.user_id) {
                const { data: participantRows } = await supabase
                    .from("tickets_participants")
                    .select("ticket_id")
                    .eq("participant_id", helperRow.user_id)
                    .eq("claimed", true);
                assignedTicketIds =
                    participantRows?.map((row) => row.ticket_id) ?? [];
            }

            const helperRelatedTicketIds = new Set<string>([
                ...helperTicketIds,
                ...assignedTicketIds,
            ]);

            const inProgressTickets: HelperInProgressTicket[] = (tickets ?? [])
                .filter(
                    (ticket) =>
                        (ticket.status === "in-progress" ||
                            ticket.status === "claimed") &&
                        helperRelatedTicketIds.has(ticket.id)
                )
                .map((ticket) => ({
                    id: ticket.id,
                    title: ticket.title,
                    status: ticket.status as "claimed" | "in-progress",
                    priority: ticket.priority,
                    created_at: ticket.created_at,
                }));

            // --- Issue type stats (tickets the helper logged time on only) ---
            if (helperTicketIds.length === 0) {
                return {
                    keyStats,
                    issueTypeStats: [],
                    inProgressTickets,
                };
            }

            const categories = helpCategories ?? [];

            const {
                data: ticketsHelpCategories,
                error: ticketsHelpCategoriesError,
            } = await supabase
                .from("tickets_help_categories")
                .select("ticket_id, help_category_id")
                .in("ticket_id", helperTicketIds);

            if (ticketsHelpCategoriesError) {
                console.error(
                    "Error fetching tickets_help_categories:",
                    ticketsHelpCategoriesError
                );
            }

            const validCategoryIds = new Set(categories.map((c) => c.id));
            const categorizedTicketIds = new Set<string>();
            ticketsHelpCategories?.forEach((thc) => {
                if (
                    validCategoryIds.has(thc.help_category_id) &&
                    helperTicketIds.includes(thc.ticket_id)
                ) {
                    categorizedTicketIds.add(thc.ticket_id);
                }
            });

            const categoryToTicketsMap = new Map<number, string[]>();
            ticketsHelpCategories?.forEach((thc) => {
                if (!validCategoryIds.has(thc.help_category_id)) return;
                const existing =
                    categoryToTicketsMap.get(thc.help_category_id) || [];
                if (!existing.includes(thc.ticket_id)) {
                    existing.push(thc.ticket_id);
                }
                categoryToTicketsMap.set(thc.help_category_id, existing);
            });

            const issueTypeStats: IssueTypeStats[] = categories.map(
                (category) => {
                    const categoryTicketIds =
                        categoryToTicketsMap.get(category.id) || [];
                    // Restrict to tickets the helper logged time on.
                    const validTicketIds = categoryTicketIds.filter(
                        (ticketId) => helperTicketIds.includes(ticketId)
                    );
                    return buildIssueTypeStatsRow(
                        category.value,
                        validTicketIds,
                        tickets ?? [],
                        helperTimeEntries
                    );
                }
            );

            const uncategorizedTicketIds = helperTicketIds.filter(
                (ticketId) => !categorizedTicketIds.has(ticketId)
            );
            issueTypeStats.push(
                buildIssueTypeStatsRow(
                    UNCATEGORIZED_ISSUE_TYPE,
                    uncategorizedTicketIds,
                    tickets ?? [],
                    helperTimeEntries
                )
            );

            return {
                keyStats,
                issueTypeStats,
                inProgressTickets,
            };
        },
        enabled:
            !!projectId &&
            !!effectiveHelperId &&
            timeEntries !== undefined,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}
