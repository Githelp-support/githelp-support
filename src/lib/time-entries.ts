/**
 * Pure helpers and types for tickets_time_entries. Kept free of the Supabase
 * client so components and tests can import them without env vars.
 */

/**
 * Customer review of a logged entry (migrations
 * 20260925120000_time_entries_customer_review.sql and
 * 20261008120000_time_entries_summary_confirmation.sql). Every entry starts
 * out `pending` and stays that way during the session. When the helper is
 * ready to end they send the logged-time summary; the ticket creator confirms
 * it once (`confirm_time_entries`), optionally declining single entries with a
 * reason. Declined entries are not billed and are left out of the totals.
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
    /** When the entry was logged and became pending. */
    review_requested_at?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    decline_reason?: string | null;
    /** Accepted by the 24h job rather than the customer. */
    auto_accepted?: boolean | null;
}

/**
 * Once the helper has sent the summary (`tickets.time_review_requested_at`),
 * pending entries are accepted automatically this long after it (DB job).
 */
export const TIME_ENTRY_AUTO_ACCEPT_HOURS = 24;

/**
 * "in about 5 hours" / "in less than an hour" / "any moment now" — when the
 * outstanding summary will be accepted automatically, counted from
 * `tickets.time_review_requested_at`. Null when there is no request.
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

/**
 * `metadata` of a chat system message, as stored on `tickets_messages`. Only
 * the keys the time-review helpers read are checked, so any message metadata
 * can be passed in.
 */
export type TimeReviewMessageMetadata = Record<string, unknown> | null | undefined;

/** A `time_entries_confirmed` message written by the customer, not by the 24h job. */
function isManualTimeEntriesConfirmed(metadata: TimeReviewMessageMetadata): metadata is Record<string, unknown> {
    return !!metadata && metadata.kind === "time_entries_confirmed" && metadata.auto !== true;
}

function getDeclinedEntries(metadata: Record<string, unknown>): unknown[] {
    return Array.isArray(metadata.declined) ? metadata.declined : [];
}

/**
 * The customer rejected the whole summary: a manual `time_entries_confirmed`
 * message in which nothing was accepted and every entry was declined with the
 * same explanation (the "Reject logged time" action sends one explanation for
 * all pending entries). Returns who rejected and why, or null for anything
 * else, including per-entry declines with different reasons.
 */
export function getTimeEntriesRejection(
    metadata: TimeReviewMessageMetadata
): { reviewerName: string; reason: string } | null {
    if (!isManualTimeEntriesConfirmed(metadata) || metadata.accepted_count !== 0) return null;
    const declined = getDeclinedEntries(metadata);
    if (declined.length === 0) return null;
    const reasons = declined.map((d) =>
        d && typeof d === "object" ? (d as Record<string, unknown>).reason : undefined
    );
    const reason = reasons[0];
    // A blank explanation cannot be shown as a quote; the message's own text is used instead.
    if (typeof reason !== "string" || reason.trim().length === 0) return null;
    if (reasons.some((r) => r !== reason)) return null;
    const reviewerName =
        typeof metadata.reviewer_name === "string" && metadata.reviewer_name.trim().length > 0
            ? metadata.reviewer_name
            : "The user";
    return { reviewerName, reason };
}

/**
 * Whether the latest round of the time review ended in a rejection. Takes the
 * metadata of the ticket's messages in chronological order and looks at the
 * last `time_review_requested` / `time_entries_confirmed` one: true when that
 * is a manual confirmation that accepted nothing and declined at least one
 * entry. A newer summary request (or confirmation) clears it.
 */
export function isTimeReviewRejected(messages: TimeReviewMessageMetadata[]): boolean {
    for (let i = messages.length - 1; i >= 0; i--) {
        const metadata = messages[i];
        if (!metadata) continue;
        if (metadata.kind !== "time_review_requested" && metadata.kind !== "time_entries_confirmed") continue;
        return (
            isManualTimeEntriesConfirmed(metadata) &&
            metadata.accepted_count === 0 &&
            getDeclinedEntries(metadata).length > 0
        );
    }
    return false;
}

/** The customer (not the 24h job) confirmed at least one entry in this `time_entries_confirmed` message. */
export function isManualTimeConfirmation(metadata: TimeReviewMessageMetadata): boolean {
    return (
        isManualTimeEntriesConfirmed(metadata) &&
        typeof metadata.accepted_count === "number" &&
        metadata.accepted_count > 0
    );
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

/** Longest single entry the drawer accepts (24 hours), in milliseconds. */
export const MAX_TIME_ENTRY_MS = 24 * 60 * 60 * 1000;

export type LoggedDurationValidation =
    | { ok: true; hours: number; minutes: number; timeMilliseconds: number }
    | { ok: false; error: string };

/**
 * Validate the hours/minutes typed into the Log time drawer. Only whole,
 * non-negative numbers are accepted, minutes must be below 60, and the total
 * must be between 1 minute and 24 hours — there is no CHECK on
 * `time_milliseconds`, and a zero/negative entry would reduce what another
 * helper is paid at capture.
 */
export function validateLoggedDuration(hoursInput: string, minutesInput: string): LoggedDurationValidation {
    const hoursText = hoursInput.trim();
    const minutesText = minutesInput.trim();
    const wholeNumber = /^\d+$/;
    if ((hoursText && !wholeNumber.test(hoursText)) || (minutesText && !wholeNumber.test(minutesText))) {
        return { ok: false, error: "Enter whole, non-negative numbers for hours and minutes." };
    }
    const hours = hoursText ? Number.parseInt(hoursText, 10) : 0;
    const minutes = minutesText ? Number.parseInt(minutesText, 10) : 0;
    if (minutes >= 60) {
        return { ok: false, error: "Minutes must be less than 60." };
    }
    const timeMilliseconds = (hours * 60 + minutes) * 60 * 1000;
    if (timeMilliseconds < 60 * 1000) {
        return { ok: false, error: "Log at least 1 minute." };
    }
    if (timeMilliseconds > MAX_TIME_ENTRY_MS) {
        return { ok: false, error: "A single entry can be at most 24 hours." };
    }
    return { ok: true, hours, minutes, timeMilliseconds };
}
