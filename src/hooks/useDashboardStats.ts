import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { getAvatarColorHexForId } from "@/lib/constants";
import { useHelpers } from "./useHelpers";
import { useTimeEntries } from "./useTimeEntries";
import { formatTime, calculateTotalTime } from "./useTimeEntries";
import type { TimeEntry } from "./useTimeEntries";

export interface HelperStats {
    id: string;
    helper_id: string;
    name: string;
    initial: string;
    tickets: number | string;
    time: string;
    color: string;
    category: string;
}

export interface IssueTypeStats {
    name: string;
    tickets: number | string;
    time: string;
    applied: boolean;
}

export const UNCATEGORIZED_ISSUE_TYPE = "Uncategorized";

function buildIssueTypeStatsRow(
    name: string,
    ticketIds: string[],
    tickets: { id: string }[],
    timeEntries: TimeEntry[]
): IssueTypeStats {
    const ticketsWithWork = tickets.filter(
        (ticket) =>
            ticketIds.includes(ticket.id) &&
            timeEntries.some((entry) => entry.ticket_id === ticket.id)
    );
    const categoryTimeEntries = timeEntries.filter((entry) =>
        ticketIds.includes(entry.ticket_id)
    );
    const totalTime = calculateTotalTime(categoryTimeEntries);

    return {
        name,
        tickets: ticketsWithWork.length > 0 ? ticketsWithWork.length : "-",
        time: totalTime > 0 ? formatTime(totalTime) : "-",
        applied: ticketsWithWork.length > 0,
    };
}

export interface KeyStats {
    totalTicketsSolved: number;
    totalTimeSpent: string;
    percentageSolved: number;
}

export function useDashboardStats(projectId?: string) {
    const { data: helpers } = useHelpers(projectId);
    const { data: timeEntries } = useTimeEntries({ projectId });

    return useQuery({
        queryKey: ["dashboard-stats", projectId],
        queryFn: async () => {
            if (
                !projectId ||
                helpers === undefined ||
                timeEntries === undefined
            ) {
                return {
                    helperStats: [],
                    issueTypeStats: [],
                    keyStats: {
                        totalTicketsSolved: 0,
                        totalTimeSpent: "-",
                        percentageSolved: 0,
                    },
                };
            }

            // Get project (need both project_id UUID and id bigint)
            const { data: project } = await supabase
                .from("projects")
                .select("id, project_id")
                .eq("project_id", projectId)
                .single();

            if (!project) {
                return {
                    helperStats: [],
                    issueTypeStats: [],
                    keyStats: {
                        totalTicketsSolved: 0,
                        totalTimeSpent: "-",
                        percentageSolved: 0,
                    },
                };
            }

            // Get all tickets for the project
            const { data: tickets } = await supabase
                .from("tickets")
                .select("id, status, created_at")
                .eq("project_id", projectId)
                .is("deleted_at", null);

            // Get help categories (project_id in help_categories is bigint referencing projects.id)
            const { data: helpCategories } = await supabase
                .from("projects_help_categories")
                .select("id, value")
                .eq("project_id", projectId);

            // Calculate helper stats
            const helperStats: HelperStats[] = helpers.map((helper) => {
                const helperTimeEntries = timeEntries.filter(
                    (entry) => entry.helper_id === helper.helper_id
                );
                const totalTime = calculateTotalTime(helperTimeEntries);
                // Count tickets that this helper has logged time on
                const ticketsWorkedOn =
                    tickets?.filter((ticket) =>
                        helperTimeEntries.some(
                            (entry) => entry.ticket_id === ticket.id
                        )
                    ).length || 0;

                // DB stores "core" | "extended" | "community"; map display labels for legacy/UI values
                const categoryMap: Record<string, string> = {
                    "Core team": "core",
                    Community: "community",
                    Extended: "extended",
                    Consultant: "consultant",
                };
                const raw = helper.category ?? "community";
                const category =
                    raw === "core" || raw === "extended" || raw === "community"
                        ? raw
                        : categoryMap[raw] ?? "community";

                return {
                    id: helper.helper_id,
                    helper_id: helper.helper_id,
                    name: helper.user?.name || "Unknown",
                    initial: (helper.user?.name || "U")[0].toUpperCase(),
                    tickets: ticketsWorkedOn > 0 ? ticketsWorkedOn : "-",
                    time: totalTime > 0 ? formatTime(totalTime) : "-",
                    color: getAvatarColorHexForId(helper.user_id ?? helper.helper_id),
                    category,
                };
            });

            // Calculate key stats
            const completedTickets =
                tickets?.filter((ticket) => ticket.status === "completed") ||
                [];
            const totalTicketsSolved = completedTickets.length;
            const totalTime = calculateTotalTime(timeEntries);
            const totalTimeSpent = totalTime > 0 ? formatTime(totalTime) : "-";
            const percentageSolved =
                tickets && tickets.length > 0
                    ? Math.round(
                          (completedTickets.length / tickets.length) * 100
                      )
                    : 0;

            const keyStats: KeyStats = {
                totalTicketsSolved,
                totalTimeSpent,
                percentageSolved,
            };

            if (!tickets || tickets.length === 0) {
                return {
                    helperStats,
                    issueTypeStats: [],
                    keyStats,
                };
            }

            const projectTicketIds = tickets.map((t) => t.id);
            const categories = helpCategories ?? [];

            const {
                data: ticketsHelpCategories,
                error: ticketsHelpCategoriesError,
            } = await supabase
                .from("tickets_help_categories")
                .select("ticket_id, help_category_id")
                .in("ticket_id", projectTicketIds);

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
                    projectTicketIds.includes(thc.ticket_id)
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
                    const validTicketIds = categoryTicketIds.filter(
                        (ticketId) => projectTicketIds.includes(ticketId)
                    );
                    return buildIssueTypeStatsRow(
                        category.value,
                        validTicketIds,
                        tickets,
                        timeEntries
                    );
                }
            );

            const uncategorizedTicketIds = projectTicketIds.filter(
                (ticketId) => !categorizedTicketIds.has(ticketId)
            );
            issueTypeStats.push(
                buildIssueTypeStatsRow(
                    UNCATEGORIZED_ISSUE_TYPE,
                    uncategorizedTicketIds,
                    tickets,
                    timeEntries
                )
            );

            return {
                helperStats,
                issueTypeStats,
                keyStats,
            };
        },
        enabled:
            !!projectId && helpers !== undefined && timeEntries !== undefined,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}
