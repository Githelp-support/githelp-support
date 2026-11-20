import { describe, it, expect } from "vitest";
import { groupChatMessages, type ChatRenderItem } from "../chat-grouping";
import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";

/** Local-time ISO instant, so the day boundaries hold in any timezone. */
const at = (day: number, hour: number, minute: number, second = 0) =>
    new Date(2026, 10, day, hour, minute, second).toISOString();

const msg = (id: string, createdAt: string | null, overrides: Partial<TicketChatMessage> = {}): TicketChatMessage => ({
    id,
    senderType: "user",
    senderId: "user-1",
    senderName: "Ada",
    timestamp: "",
    content: id,
    createdAt,
    ...overrides,
});

/** Compact view: "day" for a divider, "+id" for a group start, "id" for a continuation. */
const shape = (items: ChatRenderItem[]) =>
    items.map((item) => (item.type === "day" ? "day" : `${item.isGroupStart ? "+" : ""}${item.id}`));

describe("groupChatMessages", () => {
    it("returns nothing for an empty thread", () => {
        expect(groupChatMessages([])).toEqual([]);
    });

    it("puts a day divider before the first dated message", () => {
        const items = groupChatMessages([msg("a", at(15, 10, 0))]);
        expect(shape(items)).toEqual(["day", "+a"]);
        expect(items[0]).toEqual({ type: "day", id: "day-a", date: at(15, 10, 0) });
    });

    it("groups messages from the same sender less than 5 minutes apart", () => {
        const items = groupChatMessages([
            msg("a", at(15, 10, 0)),
            msg("b", at(15, 10, 2)),
            msg("c", at(15, 10, 6, 59)),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "b", "c"]);
    });

    it("starts a new group at exactly 5 minutes, measured from the previous message", () => {
        const items = groupChatMessages([
            msg("a", at(15, 10, 0)),
            msg("b", at(15, 10, 5)),
            msg("c", at(15, 10, 9, 59)),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "+b", "c"]);
    });

    it("starts a new group when the sender changes", () => {
        const helper = { senderType: "helper" as const, senderId: "helper-1", senderName: "Grace" };
        const items = groupChatMessages([
            msg("a", at(15, 10, 0)),
            msg("b", at(15, 10, 1), helper),
            msg("c", at(15, 10, 2), helper),
            msg("d", at(15, 10, 3)),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "+b", "c", "+d"]);
    });

    it("falls back to sender type + name when there is no senderId", () => {
        const anon = { senderId: null };
        const items = groupChatMessages([
            msg("a", at(15, 10, 0), anon),
            msg("b", at(15, 10, 1), anon),
            msg("c", at(15, 10, 2), { ...anon, senderName: "Linus" }),
            msg("d", at(15, 10, 3), { ...anon, senderName: "Linus", senderType: "helper" }),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "b", "+c", "+d"]);
    });

    it("adds a divider and starts a new group when the local day changes", () => {
        const items = groupChatMessages([
            msg("a", at(15, 23, 58)),
            msg("b", at(16, 0, 1)),
            msg("c", at(16, 0, 2)),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "day", "+b", "c"]);
        expect(items[2]).toMatchObject({ type: "day", id: "day-b", date: at(16, 0, 1) });
    });

    it("never groups system messages, and they break the group around them", () => {
        const system = { senderType: "system" as const, senderId: null, senderName: "Acme Team" };
        const items = groupChatMessages([
            msg("a", at(15, 10, 0)),
            msg("s1", at(15, 10, 1), system),
            msg("s2", at(15, 10, 1), system),
            msg("b", at(15, 10, 2)),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "+s1", "+s2", "+b"]);
    });

    it("treats the claimed and ended banners as group breaks, even with a senderId", () => {
        const helper = { senderType: "helper" as const, senderId: "helper-1", senderName: "Grace" };
        const items = groupChatMessages([
            msg("a", at(15, 10, 0), helper),
            msg("claimed", at(15, 10, 1), { senderType: "system", senderId: "helper-1", kind: "claimed" }),
            msg("b", at(15, 10, 2), helper),
            msg("ended", at(15, 10, 3), { senderType: "system", senderId: "helper-1", kind: "ended" }),
            msg("c", at(15, 10, 4), helper),
        ]);
        expect(shape(items)).toEqual(["day", "+a", "+claimed", "+b", "+ended", "+c"]);
    });

    it("starts a new group for a message without createdAt, and for the one after it", () => {
        const items = groupChatMessages([
            msg("a", at(15, 10, 0)),
            msg("b", null),
            msg("c", at(15, 10, 1)),
            msg("d", at(15, 10, 2)),
        ]);
        // No divider for the undated message; the day itself has not changed.
        expect(shape(items)).toEqual(["day", "+a", "+b", "+c", "d"]);
    });

    it("adds no divider when no message is dated", () => {
        const items = groupChatMessages([msg("a", null), msg("b", undefined as unknown as null), msg("c", "not a date")]);
        expect(shape(items)).toEqual(["+a", "+b", "+c"]);
    });

    it("does not group a message that is dated before the previous one", () => {
        const items = groupChatMessages([msg("a", at(15, 10, 3)), msg("b", at(15, 10, 1))]);
        expect(shape(items)).toEqual(["day", "+a", "+b"]);
    });

    it("keeps the message order and passes the messages through untouched", () => {
        const messages = [msg("a", at(15, 10, 0)), msg("b", at(14, 9, 0)), msg("c", null)];
        const items = groupChatMessages(messages);
        const rendered = items.flatMap((item) => (item.type === "message" ? [item.message] : []));
        expect(rendered).toEqual(messages);
        expect(rendered[0]).toBe(messages[0]);
    });
});
