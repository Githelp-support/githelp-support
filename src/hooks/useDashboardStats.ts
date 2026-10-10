import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
    computeDashboardStats,
    EMPTY_DASHBOARD_STATS,
    type DashboardHelpCategory,
    type DashboardTicket,
    type DashboardTicketHelpCategory,
} from "@/lib/dashboard-stats";
import { useHelpers } from "./useHelpers";
import { useTimeEntries } from "./useTimeEntries";

// The aggregation and its types live in @/lib/dashboard-stats; re-exported so
// existing imports (e.g. useHelperDashboardStats) keep working.
export {
    buildIssueTypeStatsRow,
    UNCATEGORIZED_ISSUE_TYPE,
    type HelperStats,
    type IssueTypeStats,
    type KeyStats,
    type DashboardStats,
} from "@/lib/dashboard-stats";

interface DashboardRawData {
    tickets: DashboardTicket[];
    helpCategories: DashboardHelpCategory[];
    ticketsHelpCategories: DashboardTicketHelpCategory[];
}

const EMPTY_RAW_DATA: DashboardRawData = {
    tickets: [],
    helpCategories: [],
    ticketsHelpCategories: [],
};

/**
 * Admin Overview stats for a project.
 *
 * The raw data (tickets, help categories, their links, plus helpers and time
 * entries from their own hooks) is fetched once per project; switching the
 * period only re-aggregates in memory. `targetMonth` is `null` for "All" or a
 * `monthLabel()` string ("October 2026"); a ticket belongs to the month it
 * closed in (see `@/lib/dashboard-stats`).
 */
export function useDashboardStats(
    projectId?: string,
    targetMonth: string | null = null
) {
    const { data: helpers } = useHelpers(projectId);
    const { data: timeEntries } = useTimeEntries({ projectId });

    const query = useQuery({
        queryKey: ["dashboard-stats", projectId],
        queryFn: async (): Promise<DashboardRawData> => {
            if (!projectId) return EMPTY_RAW_DATA;

            // Get project (need both project_id UUID and id bigint)
            const { data: project } = await supabase
                .from("projects")
                .select("id, project_id")
                .eq("project_id", projectId)
                .single();

            if (!project) return EMPTY_RAW_DATA;

            // Get all (non-deleted) tickets for the project
            const { data: tickets } = await supabase
                .from("tickets")
                .select("id, status, created_at, completed_at, cancelled_at")
                .eq("project_id", projectId)
                .is("deleted_at", null);

            // Get help categories (project_id in help_categories is bigint referencing projects.id)
            const { data: helpCategories } = await supabase
                .from("projects_help_categories")
                .select("id, value")
                .eq("project_id", projectId);

            if (!tickets || tickets.length === 0) {
                return {
                    tickets: [],
                    helpCategories: helpCategories ?? [],
                    ticketsHelpCategories: [],
                };
            }

            const {
                data: ticketsHelpCategories,
                error: ticketsHelpCategoriesError,
            } = await supabase
                .from("tickets_help_categories")
                .select("ticket_id, help_category_id")
                .in(
                    "ticket_id",
                    tickets.map((t) => t.id)
                );

            if (ticketsHelpCategoriesError) {
                console.error(
                    "Error fetching tickets_help_categories:",
                    ticketsHelpCategoriesError
                );
            }

            return {
                tickets,
                helpCategories: helpCategories ?? [],
                ticketsHelpCategories: ticketsHelpCategories ?? [],
            };
        },
        enabled:
            !!projectId && helpers !== undefined && timeEntries !== undefined,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });

    const raw = query.data;
    const data = useMemo(() => {
        if (!projectId || !raw || helpers === undefined || timeEntries === undefined) {
            return EMPTY_DASHBOARD_STATS;
        }
        return computeDashboardStats(
            {
                tickets: raw.tickets,
                timeEntries,
                helpers,
                helpCategories: raw.helpCategories,
                ticketsHelpCategories: raw.ticketsHelpCategories,
            },
            targetMonth
        );
    }, [projectId, raw, helpers, timeEntries, targetMonth]);

    return { ...query, data };
}
