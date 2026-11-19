import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";

/**
 * Pure view-model helpers for the chat thread: time and day labels, short
 * ticket IDs, the composer placeholder and the grouping of messages into
 * render items (day dividers + messages with or without a header).
 * All day logic uses the viewer's local time zone.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/** Messages from the same sender within this window share one header. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Longest composer placeholder, including the ellipsis. */
export const PLACEHOLDER_MAX_LENGTH = 24;

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
    return value instanceof Date ? value : new Date(value);
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** Local calendar day, e.g. "2026-11-15". */
function dayKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'HH:MM' in 24-hour local time. */
export function formatChatTime(date: DateInput): string {
    const d = toDate(date);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'Today', 'Yesterday' or 'Sunday 15 November' (en-GB order). */
export function formatDayDividerLabel(date: DateInput, now: DateInput): string {
    const d = toDate(date);
    const n = toDate(now);
    if (dayKey(d) === dayKey(n)) return "Today";
    // Date arithmetic on the calendar day, so DST changes don't matter.
    const yesterday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** '15 Nov'. */
export function formatDayMonth(date: DateInput): string {
    const d = toDate(date);
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** First 8 characters of a ticket ID. */
export function shortTicketId(id: string): string {
    return id.slice(0, 8);
}

/**
 * Composer placeholder: 'Ask #slug' when the project has a slug, otherwise
 * 'Ask Name'; cut to PLACEHOLDER_MAX_LENGTH characters with a trailing '…'.
 */
export function composerPlaceholder({ slug, name }: { slug?: string | null; name?: string | null }): string {
    const trimmedSlug = slug?.trim();
    const trimmedName = name?.trim();
    const text = trimmedSlug ? `Ask #${trimmedSlug}` : trimmedName ? `Ask ${trimmedName}` : "Ask a question";
    if (text.length <= PLACEHOLDER_MAX_LENGTH) return text;
    return `${text.slice(0, PLACEHOLDER_MAX_LENGTH - 1).trimEnd()}…`;
}

export type ThreadItem =
    | { type: "day"; label: string; key: string }
    | { type: "message"; msg: TicketChatMessage; showHeader: boolean };

function parseCreatedAt(msg: TicketChatMessage): Date | null {
    if (!msg.createdAt) return null;
    const d = new Date(msg.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Turns the message list into render items. A day divider goes before the
 * first message that has `createdAt` and wherever the local day changes
 * between messages with `createdAt` (undated messages never get a divider).
 * `showHeader` is false only for a message that directly follows another
 * message from the same sender (`senderType` + `senderId`), neither being a
 * system message, on the same day and at most 5 minutes apart.
 */
export function layoutThread(messages: TicketChatMessage[], now: DateInput): ThreadItem[] {
    const items: ThreadItem[] = [];
    let lastDay: string | null = null;
    // The previous message, unless a day divider came in between.
    let prev: { msg: TicketChatMessage; at: Date | null } | null = null;

    for (const msg of messages) {
        const at = parseCreatedAt(msg);
        if (at) {
            const day = dayKey(at);
            if (day !== lastDay) {
                items.push({ type: "day", label: formatDayDividerLabel(at, now), key: `day-${day}-${msg.id}` });
                lastDay = day;
                prev = null;
            }
        }

        const grouped =
            !!prev &&
            !!at &&
            !!prev.at &&
            msg.senderType !== "system" &&
            prev.msg.senderType !== "system" &&
            prev.msg.senderType === msg.senderType &&
            (prev.msg.senderId ?? null) === (msg.senderId ?? null) &&
            Math.abs(at.getTime() - prev.at.getTime()) <= GROUP_WINDOW_MS;

        items.push({ type: "message", msg, showHeader: !grouped });
        prev = { msg, at };
    }

    return items;
}
