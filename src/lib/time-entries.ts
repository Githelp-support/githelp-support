/**
 * Pure helpers and types for tickets_time_entries. Kept free of the Supabase
 * client so components and tests can import them without env vars.
 */

/**
 * Customer review of a logged entry (migration
 * 20260925120000_time_entries_customer_review.sql). Every entry starts out
 * `pending`; the ticket creator accepts or declines it before the helper can
 * end the session. Declined entries are not billed and are left out of the
 * logged-time totals.
 */
export type TimeEntryReviewStatus = "pending" | "accepted" | "declined";

export interface TimeEntry {
    id: string;
    ticket_id: string;
    helper_id: string;
    type: "together" | "solo";
    time_milliseconds: number;
    note: string | null;
    date: string;
    created_at: string;
    review_status?: TimeEntryReviewStatus | null;
    /** When the current review was requested; auto-accepted TIME_ENTRY_AUTO_ACCEPT_HOURS after this. */
    review_requested_at?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    decline_reason?: string | null;
    /** Accepted by the 24h job rather than the customer. */
    auto_accepted?: boolean | null;
}

/** Pending entries are accepted automatically this long after `review_requested_at` (DB job). */
export const TIME_ENTRY_AUTO_ACCEPT_HOURS = 24;

/**
 * "in about 5 hours" / "in less than an hour" / "any moment now" — when a
 * pending entry will be accepted automatically. Null when the deadline is unknown.
 */
export function describeAutoAcceptDeadline(
    reviewRequestedAt: string | null | undefined,
    nowMs: number = Date.now()
): string | null {
    if (!reviewRequestedAt) return null;
    const requested = Date.parse(reviewRequestedAt);
    if (Number.isNaN(requested)) return null;
    const remainingMs = requested + TIME_ENTRY_AUTO_ACCEPT_HOURS * 3_600_000 - nowMs;
    if (remainingMs <= 5 * 60_000) return "any moment now";
    if (remainingMs < 3_600_000) return "in less than an hour";
    const hours = Math.round(remainingMs / 3_600_000);
    return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Rows written before the review column existed have no status and count as accepted. */
export function getTimeEntryReviewStatus(entry: Pick<TimeEntry, "review_status">): TimeEntryReviewStatus {
    return entry.review_status ?? "accepted";
}

/** Everything the customer has not declined counts towards logged time and the charge. */
export function isBillableTimeEntry(entry: Pick<TimeEntry, "review_status">): boolean {
    return getTimeEntryReviewStatus(entry) !== "declined";
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

// Helper function to calculate total time from entries (declined entries excluded)
export function calculateTotalTime(entries: TimeEntry[]): number {
    return entries
        .filter(isBillableTimeEntry)
        .reduce((total, entry) => total + entry.time_milliseconds, 0);
}

/** Convert time_milliseconds to { hours, minutes } for display */
export function timeMillisecondsToHoursMinutes(ms: number): { hours: number; minutes: number } {
    const totalMinutes = Math.floor(ms / 60000);
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
