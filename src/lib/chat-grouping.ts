import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";
import { isSameLocalDay } from "@/lib/format";

/** Consecutive messages from one sender join a group while each follows the previous within this window. */
export const CHAT_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type ChatRenderItem =
    | {
          type: "day";
          /** Stable React key, derived from the message the divider precedes. */
          id: string;
          /** ISO instant of the first message of that day (label it with `formatDayLabel`). */
          date: string;
      }
    | {
          type: "message";
          id: string;
          message: TicketChatMessage;
          /** First message of a sender group: shows the avatar, name and time. */
          isGroupStart: boolean;
      };

function parseInstant(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** `senderId`, falling back to sender type + name for messages without one. */
function senderKey(message: TicketChatMessage): string {
    return message.senderId ? `id:${message.senderId}` : `${message.senderType}:${message.senderName ?? ""}`;
}

/**
 * Turns a thread into render items: a day divider whenever the local calendar
 * day changes (including before the first dated message), and for every
 * message whether it starts a new sender group.
 *
 * A message continues the group only when the previous item is a non-system
 * message from the same sender, on the same day, less than 5 minutes earlier.
 * A day divider, any system message (the claimed/ended banners included) or a
 * missing `createdAt` always starts a new group. Order is never changed.
 */
export function groupChatMessages(messages: TicketChatMessage[]): ChatRenderItem[] {
    const items: ChatRenderItem[] = [];
    /** Day of the last dated message, which is what the next divider is measured against. */
    let currentDay: Date | null = null;
    let previous: { message: TicketChatMessage; at: Date | null } | null = null;

    for (const message of messages) {
        const at = parseInstant(message.createdAt);

        let dividerAdded = false;
        if (at && (!currentDay || !isSameLocalDay(at, currentDay))) {
            items.push({ type: "day", id: `day-${message.id}`, date: message.createdAt as string });
            dividerAdded = true;
        }
        if (at) currentDay = at;

        let continuesGroup = false;
        if (
            !dividerAdded &&
            at &&
            previous?.at &&
            message.senderType !== "system" &&
            previous.message.senderType !== "system" &&
            senderKey(message) === senderKey(previous.message) &&
            isSameLocalDay(at, previous.at)
        ) {
            const elapsed = at.getTime() - previous.at.getTime();
            continuesGroup = elapsed >= 0 && elapsed < CHAT_GROUP_WINDOW_MS;
        }

        items.push({ type: "message", id: message.id, message, isGroupStart: !continuesGroup });
        previous = { message, at };
    }

    return items;
}
