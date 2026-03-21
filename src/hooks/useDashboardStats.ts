import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useHelpers } from "./useHelpers";
import { useTimeEntries } from "./useTimeEntries";
import { formatTime, calculateTotalTime } from "./useTimeEntries";

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
            const helperStats: HelperStats[] = helpers.map((helper, index) => {
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

                const helperColors = [
                    "#f4bccc",
                    "#d0f6bc",
                    "#bcedf6",
                    "#f6e6bc",
                    "#cbbcf6",
                ];
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
                    color: helperColors[index % helperColors.length],
                    category,
                };
            });

            // Calculate key stats
            // Count tickets that have time entries (work has been done on them)
            const ticketsWithWork =
                tickets?.filter((ticket) =>
                    timeEntries.some((entry) => entry.ticket_id === ticket.id)
                ) || [];
            const totalTicketsSolved = ticketsWithWork.length;
            const totalTime = calculateTotalTime(timeEntries);
            const totalTimeSpent = totalTime > 0 ? formatTime(totalTime) : "-";
            const percentageSolved =
                tickets && tickets.length > 0
                    ? Math.round(
                          (ticketsWithWork.length / tickets.length) * 100
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

            if (!helpCategories || helpCategories.length === 0) {
                return {
                    helperStats,
                    issueTypeStats: [],
                    keyStats,
                };
            }

            // Get ticket IDs for this project
            const projectTicketIds = tickets.map((t) => t.id);

            // Fetch categories for all tickets in this project
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

            if (!helpCategories || helpCategories.length === 0) {
                return {
                    helperStats,
                    issueTypeStats: [],
                };
            }

            // Create a map of category_id -> ticket_ids for efficient lookup
            const categoryToTicketsMap = new Map<number, string[]>();
            ticketsHelpCategories?.forEach((thc) => {
                const existing =
                    categoryToTicketsMap.get(thc.help_category_id) || [];
                if (!existing.includes(thc.ticket_id)) {
                    existing.push(thc.ticket_id);
                }
                categoryToTicketsMap.set(thc.help_category_id, existing);
            });

            // Calculate issue type stats by summing up tickets per category
            const issueTypeStats: IssueTypeStats[] = helpCategories.map(
                (category) => {
                    // Get all ticket IDs for this category
                    const categoryTicketIds =
                        categoryToTicketsMap.get(category.id) || [];

                    // Filter to only include tickets that exist in our project tickets
                    const validTicketIds = categoryTicketIds.filter(
                        (ticketId) => projectTicketIds.includes(ticketId)
                    );

                    // Only count tickets that have time entries (work has been done)
                    const categoryTicketsWithWork = tickets.filter(
                        (ticket) =>
                            validTicketIds.includes(ticket.id) &&
                            timeEntries.some(
                                (entry) => entry.ticket_id === ticket.id
                            )
                    );

                    // Calculate time spent on tickets in this category
                    const categoryTimeEntries = timeEntries.filter((entry) =>
                        validTicketIds.includes(entry.ticket_id)
                    );
                    const totalTime = calculateTotalTime(categoryTimeEntries);

                    return {
                        name: category.value,
                        tickets:
                            categoryTicketsWithWork.length > 0
                                ? categoryTicketsWithWork.length
                                : "-",
                        time: totalTime > 0 ? formatTime(totalTime) : "-",
                        applied: categoryTicketsWithWork.length > 0,
                    };
                }
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
