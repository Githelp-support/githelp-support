/**
 * Which `tickets_messages` rows count as "a message" outside the thread
 * itself: previews, message counts, unread dots and recent interactions.
 *
 * The server writes a welcome and a start note when a ticket is opened (and
 * backfills them on older tickets), plus an auto-reply after the first user
 * message. They are part of the thread, but nobody wrote them, so they are
 * never the latest message, never unread and never counted.
 */

/** `metadata.kind` of the rows the server writes for the customer. */
export const AUTOMATIC_MESSAGE_KINDS: ReadonlySet<string> = new Set(["welcome", "start_note", "auto_reply"]);

/**
 * The columns the rule reads; select them alongside your own. Deliberately
 * not `is_automatic`: that column only exists once migration
 * 20261123120000_ticket_welcome_messages is applied, and selecting a missing
 * column fails the whole query (previews, counts and unread dots would go
 * blank on a database that is one migration behind).
 */
export const AUTOMATIC_MESSAGE_COLUMNS = "sender_type, sender_id, metadata";

type AutomaticFields = {
    is_automatic?: boolean | null;
    sender_type?: string | null;
    sender_id?: string | null;
    metadata?: Record<string, unknown> | null;
};

/**
 * A server-written welcome, start note or auto-reply. "Server-written" is
 * `is_automatic` when the row carries it (clients cannot set it), otherwise a
 * system row without a sender (a client insert always has `sender_id =
 * auth.uid()`). The kind must match too, so the other system messages
 * (payments, time logged, guest notices) still count.
 */
export function isAutomaticMessage(row: AutomaticFields): boolean {
    const serverWritten =
        row.is_automatic != null ? row.is_automatic : row.sender_type === "system" && row.sender_id == null;
    if (!serverWritten) return false;
    const kind = row.metadata?.kind;
    return typeof kind === "string" && AUTOMATIC_MESSAGE_KINDS.has(kind);
}

/**
 * Id to store as `last_read_message_id` for a thread (oldest first): the
 * newest message that is not automatic, or null when there is none yet.
 */
export function latestReadableMessageId(messages: Array<AutomaticFields & { id: string }> | null | undefined): string | null {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!isAutomaticMessage(messages[i])) return messages[i].id;
    }
    return null;
}

export interface TicketMessageSummary {
    /** Messages on the ticket, automatic rows left out. */
    count: number;
    /** Content of the oldest non-automatic message, if the rows carried `content`. */
    firstContent: string | null;
    /** Id of the newest non-automatic message. */
    lastMessageId: string | null;
    /** Automatic rows that came after `lastMessageId`: reading up to one of them means everything is read. */
    trailingAutomaticIds: string[];
}

type SummaryRow = AutomaticFields & { id?: string; ticket_id: string; content?: string | null };

/** Per-ticket summary of message rows that are ordered oldest first. */
export function summarizeTicketMessages(rows: SummaryRow[] | null | undefined): Map<string, TicketMessageSummary> {
    const byTicket = new Map<string, TicketMessageSummary>();
    (rows ?? []).forEach((row) => {
        let summary = byTicket.get(row.ticket_id);
        if (!summary) {
            summary = { count: 0, firstContent: null, lastMessageId: null, trailingAutomaticIds: [] };
            byTicket.set(row.ticket_id, summary);
        }
        if (isAutomaticMessage(row)) {
            if (row.id) summary.trailingAutomaticIds.push(row.id);
            return;
        }
        if (summary.count === 0) summary.firstContent = row.content ?? null;
        summary.count += 1;
        summary.lastMessageId = row.id ?? null;
        summary.trailingAutomaticIds = [];
    });
    return byTicket;
}

/**
 * Whether the ticket has a message the participant has not read: its newest
 * non-automatic message is not the one they last read. A `lastReadMessageId`
 * pointing at an automatic row after that message counts as read.
 */
export function hasUnreadMessage(summary: TicketMessageSummary | undefined, lastReadMessageId: string | null | undefined): boolean {
    if (!summary?.lastMessageId) return false;
    if (lastReadMessageId === summary.lastMessageId) return false;
    return !(lastReadMessageId != null && summary.trailingAutomaticIds.includes(lastReadMessageId));
}
