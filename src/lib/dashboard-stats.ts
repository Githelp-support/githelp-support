/**
 * Pure aggregation for the admin Overview dashboard. Kept free of the
 * Supabase client so the period logic can be unit tested.
 *
 * Period convention (same as the reports and the user Overview page): a
 * ticket belongs to the month it closed in — `completed_at` for completed
 * tickets, `cancelled_at` for cancelled ones (see `ticketClosedAt`). Time
 * logged on a ticket counts in the period the ticket closed, regardless of
 * the date of the individual entry.
 */
import { getAvatarColorHexForId } from "@/lib/constants";
import { ticketClosedAt } from "@/lib/helper-payout-reports";
import { monthLabel } from "@/lib/user-payment-reports";
import {
    calculateTotalTime,
    formatTime,
    isBillableTimeEntry,
    type TimeEntry,
} from "@/lib/time-entries";

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

export interface DashboardStats {
    helperStats: HelperStats[];
    issueTypeStats: IssueTypeStats[];
    keyStats: KeyStats;
}

export const UNCATEGORIZED_ISSUE_TYPE = "Uncategorized";

export const EMPTY_KEY_STATS: KeyStats = {
    totalTicketsSolved: 0,
    totalTimeSpent: "-",
    percentageSolved: 0,
};

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
    helperStats: [],
    issueTypeStats: [],
    keyStats: EMPTY_KEY_STATS,
};

/** The ticket columns the dashboard needs (non-deleted tickets only). */
export interface DashboardTicket {
    id: string;
    status: string | null;
    completed_at?: string | null;
    cancelled_at?: string | null;
}

/** Subset of a `projects_helpers` row (joined with its public user) the dashboard uses. */
export interface DashboardHelper {
    helper_id: string;
    user_id?: string | null;
    category?: string | null;
    user?: { name?: string | null } | null;
}

export interface DashboardHelpCategory {
    id: number;
    value: string;
}

export interface DashboardTicketHelpCategory {
    ticket_id: string;
    help_category_id: number;
}

export interface DashboardStatsInput {
    tickets: DashboardTicket[];
    timeEntries: TimeEntry[];
    helpers: DashboardHelper[];
    helpCategories: DashboardHelpCategory[];
    ticketsHelpCategories: DashboardTicketHelpCategory[];
}

export function buildIssueTypeStatsRow(
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

/**
 * Whether a ticket closed inside the selected period. `targetMonth` is `null`
 * for "All" (any closed ticket) or a `monthLabel()` string such as
 * "October 2026". Open tickets are never in a period.
 */
export function isTicketClosedInPeriod(
    ticket: DashboardTicket,
    targetMonth: string | null
): boolean {
    const closedAt = ticketClosedAt(ticket);
    if (!closedAt) return false;
    return targetMonth === null || monthLabel(closedAt) === targetMonth;
}

// DB stores "core" | "extended" | "community"; map display labels for legacy/UI values
const HELPER_CATEGORY_MAP: Record<string, string> = {
    "Core team": "core",
    Community: "community",
    Extended: "extended",
    Consultant: "consultant",
};

function normalizeHelperCategory(raw: string | null | undefined): string {
    const value = raw ?? "community";
    return value === "core" || value === "extended" || value === "community"
        ? value
        : HELPER_CATEGORY_MAP[value] ?? "community";
}

export function computeDashboardStats(
    { tickets, timeEntries, helpers, helpCategories, ticketsHelpCategories }: DashboardStatsInput,
    targetMonth: string | null
): DashboardStats {
    const periodTickets = tickets.filter((ticket) =>
        isTicketClosedInPeriod(ticket, targetMonth)
    );
    const periodTicketIds = new Set(periodTickets.map((ticket) => ticket.id));
    // Every entry on a ticket closed in the period, whatever the entry's own date.
    const periodTimeEntries = timeEntries.filter((entry) =>
        periodTicketIds.has(entry.ticket_id)
    );

    // --- Helpers table ---
    // AI agents are shown on Settings → AI agents, not as people.
    const helperStats: HelperStats[] = helpers
        .filter((helper) => helper.category !== "agent")
        .map((helper) => {
        const helperEntries = periodTimeEntries.filter(
            (entry) => entry.helper_id === helper.helper_id
        );
        const totalTime = calculateTotalTime(helperEntries);
        const ticketsWorkedOn = new Set(
            helperEntries
                .filter(isBillableTimeEntry)
                .map((entry) => entry.ticket_id)
        ).size;

        return {
            id: helper.helper_id,
            helper_id: helper.helper_id,
            name: helper.user?.name || "Unknown",
            initial: (helper.user?.name || "U")[0].toUpperCase(),
            tickets: ticketsWorkedOn > 0 ? ticketsWorkedOn : "-",
            time: totalTime > 0 ? formatTime(totalTime) : "-",
            color: getAvatarColorHexForId(helper.user_id ?? helper.helper_id),
            category: normalizeHelperCategory(helper.category),
        };
    });

    // --- Key stats ---
    const completedCount = periodTickets.filter(
        (ticket) => ticket.status === "completed"
    ).length;
    const cancelledCount = periodTickets.filter(
        (ticket) => ticket.status === "cancelled"
    ).length;
    const closedCount = completedCount + cancelledCount;
    const totalTime = calculateTotalTime(periodTimeEntries);

    const keyStats: KeyStats = {
        totalTicketsSolved: completedCount,
        totalTimeSpent: totalTime > 0 ? formatTime(totalTime) : "-",
        percentageSolved:
            closedCount > 0 ? Math.round((completedCount / closedCount) * 100) : 0,
    };

    // --- Issue types table ---
    if (tickets.length === 0) {
        return { helperStats, issueTypeStats: [], keyStats };
    }

    const validCategoryIds = new Set(helpCategories.map((c) => c.id));
    const categorizedTicketIds = new Set<string>();
    const categoryToTicketsMap = new Map<number, string[]>();
    for (const thc of ticketsHelpCategories) {
        if (!validCategoryIds.has(thc.help_category_id)) continue;
        if (!periodTicketIds.has(thc.ticket_id)) continue;
        categorizedTicketIds.add(thc.ticket_id);
        const existing = categoryToTicketsMap.get(thc.help_category_id) ?? [];
        if (!existing.includes(thc.ticket_id)) existing.push(thc.ticket_id);
        categoryToTicketsMap.set(thc.help_category_id, existing);
    }

    const issueTypeStats: IssueTypeStats[] = helpCategories.map((category) =>
        buildIssueTypeStatsRow(
            category.value,
            categoryToTicketsMap.get(category.id) ?? [],
            periodTickets,
            periodTimeEntries
        )
    );

    const uncategorizedTicketIds = periodTickets
        .map((ticket) => ticket.id)
        .filter((ticketId) => !categorizedTicketIds.has(ticketId));
    issueTypeStats.push(
        buildIssueTypeStatsRow(
            UNCATEGORIZED_ISSUE_TYPE,
            uncategorizedTicketIds,
            periodTickets,
            periodTimeEntries
        )
    );

    return { helperStats, issueTypeStats, keyStats };
}
