import { describe, it, expect } from "vitest";
import {
    composerPlaceholder,
    formatChatTime,
    formatDayDividerLabel,
    formatDayMonth,
    layoutThread,
    shortTicketId,
} from "../chat-thread";
import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";

// Local-time dates, so the tests hold in any time zone.
const at = (day: number, hour: number, minute: number, second = 0) => new Date(2026, 10, day, hour, minute, second);
const NOW = at(19, 15, 0);

let seq = 0;
const msg = (overrides: Partial<TicketChatMessage> & { date?: Date } = {}): TicketChatMessage => {
    const { date, ...rest } = overrides;
    return {
        id: `m${++seq}`,
        senderType: "user",
        senderId: "user-1",
        timestamp: "",
        content: "Hello",
        createdAt: date ? date.toISOString() : undefined,
        ...rest,
    };
};

/** Compact view of the layout: "day:<label>" or "<id>:<showHeader>". */
const shape = (messages: TicketChatMessage[]) =>
    layoutThread(messages, NOW).map((item) =>
        item.type === "day" ? `day:${item.label}` : `${item.msg.id}:${item.showHeader}`,
    );

describe("formatters", () => {
    it("formats the time as 24h HH:MM", () => {
        expect(formatChatTime(at(15, 9, 5))).toBe("09:05");
        expect(formatChatTime(at(15, 21, 30))).toBe("21:30");
        expect(formatChatTime(at(15, 0, 0).toISOString())).toBe("00:00");
    });

    it("labels today and yesterday", () => {
        expect(formatDayDividerLabel(at(19, 0, 1), NOW)).toBe("Today");
        expect(formatDayDividerLabel(at(18, 23, 59), NOW)).toBe("Yesterday");
    });

    it("labels yesterday across a month boundary", () => {
        expect(formatDayDividerLabel(new Date(2026, 9, 31, 12, 0), new Date(2026, 10, 1, 8, 0))).toBe("Yesterday");
    });

    it("labels older days with weekday, day and month", () => {
        expect(formatDayDividerLabel(at(15, 10, 0), NOW)).toBe("Sunday 15 November");
        expect(formatDayDividerLabel(at(17, 10, 0), NOW)).toBe("Tuesday 17 November");
    });

    it("formats day and short month", () => {
        expect(formatDayMonth(at(15, 10, 0))).toBe("15 Nov");
        expect(formatDayMonth(new Date(2026, 8, 3, 10, 0))).toBe("3 Sep");
    });

    it("shortens a ticket ID to its first 8 characters", () => {
        expect(shortTicketId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4");
        expect(shortTicketId("abc")).toBe("abc");
    });
});

describe("composerPlaceholder", () => {
    it("uses the slug when there is one", () => {
        expect(composerPlaceholder({ slug: "acme", name: "Acme Inc" })).toBe("Ask #acme");
    });

    it("falls back to the display name", () => {
        expect(composerPlaceholder({ slug: null, name: "Acme Inc" })).toBe("Ask Acme Inc");
        expect(composerPlaceholder({ slug: "  ", name: "Acme Inc" })).toBe("Ask Acme Inc");
    });

    it("truncates a long slug or name with an ellipsis", () => {
        const fromSlug = composerPlaceholder({ slug: "a-very-long-project-slug-indeed" });
        expect(fromSlug).toBe("Ask #a-very-long-projec…");
        expect(fromSlug).toHaveLength(24);

        const fromName = composerPlaceholder({ name: "The Extremely Long Project Name" });
        expect(fromName.endsWith("…")).toBe(true);
        expect(fromName.length).toBeLessThanOrEqual(24);
        expect(fromName.startsWith("Ask The Extremely Long")).toBe(true);
    });

    it("does not truncate at exactly the limit", () => {
        const slug = "x".repeat(19); // "Ask #" + 19 = 24
        expect(composerPlaceholder({ slug })).toBe(`Ask #${slug}`);
    });

    it("has a generic fallback", () => {
        expect(composerPlaceholder({})).toBe("Ask a question");
    });
});

describe("layoutThread", () => {
    it("groups messages from the same sender up to and including 5 minutes apart", () => {
        const a = msg({ date: at(19, 10, 0) });
        const b = msg({ date: at(19, 10, 5) });
        const c = msg({ date: at(19, 10, 10, 1) });
        expect(shape([a, b, c])).toEqual(["day:Today", `${a.id}:true`, `${b.id}:false`, `${c.id}:true`]);
    });

    it("starts a new group for a different sender", () => {
        const a = msg({ date: at(19, 10, 0) });
        const b = msg({ date: at(19, 10, 1), senderType: "helper", senderId: "helper-1" });
        const c = msg({ date: at(19, 10, 2), senderType: "helper", senderId: "helper-2" });
        const d = msg({ date: at(19, 10, 3), senderType: "helper", senderId: "helper-2" });
        expect(shape([a, b, c, d])).toEqual([
            "day:Today",
            `${a.id}:true`,
            `${b.id}:true`,
            `${c.id}:true`,
            `${d.id}:false`,
        ]);
    });

    it("starts a new group after a system message, and never groups system messages", () => {
        const a = msg({ date: at(19, 10, 0) });
        const s1 = msg({ date: at(19, 10, 1), senderType: "system", senderId: null });
        const s2 = msg({ date: at(19, 10, 1), senderType: "system", senderId: null });
        const b = msg({ date: at(19, 10, 2) });
        expect(shape([a, s1, s2, b])).toEqual([
            "day:Today",
            `${a.id}:true`,
            `${s1.id}:true`,
            `${s2.id}:true`,
            `${b.id}:true`,
        ]);
    });

    it("inserts a divider when the local day changes, which also breaks the group", () => {
        const a = msg({ date: at(15, 10, 0) });
        const b = msg({ date: at(18, 23, 58) });
        const c = msg({ date: at(19, 0, 1) });
        const d = msg({ date: at(19, 0, 2) });
        expect(shape([a, b, c, d])).toEqual([
            "day:Sunday 15 November",
            `${a.id}:true`,
            "day:Yesterday",
            `${b.id}:true`,
            "day:Today",
            `${c.id}:true`,
            `${d.id}:false`,
        ]);
    });

    it("puts the first divider before the first dated message, not before undated ones", () => {
        const welcome = msg({ senderType: "system", senderId: null });
        const a = msg({ date: at(19, 10, 0) });
        const summary = msg({ senderType: "system", senderId: null });
        expect(shape([welcome, a, summary])).toEqual([
            `${welcome.id}:true`,
            "day:Today",
            `${a.id}:true`,
            `${summary.id}:true`,
        ]);
    });

    it("does not group with an undated message and ignores it for day changes", () => {
        const a = msg({ date: at(19, 10, 0) });
        const undated = msg();
        const b = msg({ date: at(19, 10, 1) });
        expect(shape([a, undated, b])).toEqual(["day:Today", `${a.id}:true`, `${undated.id}:true`, `${b.id}:true`]);
    });

    it("gives day dividers unique keys", () => {
        const items = layoutThread([msg({ date: at(18, 10, 0) }), msg({ date: at(19, 10, 0) })], NOW);
        const keys = items.filter((i) => i.type === "day").map((i) => i.key);
        expect(new Set(keys).size).toBe(2);
    });

    it("returns nothing for an empty thread", () => {
        expect(layoutThread([], NOW)).toEqual([]);
    });
});
