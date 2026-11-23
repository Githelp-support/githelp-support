import { describe, it, expect } from "vitest";
import {
    hasUnreadMessage,
    isAutomaticMessage,
    latestReadableMessageId,
    summarizeTicketMessages,
} from "../ticket-message-summary";

const auto = (id: string, kind: string, ticket_id = "t1") => ({
    id,
    ticket_id,
    content: `auto ${kind}`,
    is_automatic: true,
    metadata: { kind },
});
const msg = (id: string, ticket_id = "t1") => ({ id, ticket_id, content: `text ${id}`, is_automatic: false, metadata: null });

describe("isAutomaticMessage", () => {
    it("matches the server-written welcome, start note and auto-reply", () => {
        expect(isAutomaticMessage(auto("a", "welcome"))).toBe(true);
        expect(isAutomaticMessage(auto("a", "start_note"))).toBe(true);
        expect(isAutomaticMessage(auto("a", "auto_reply"))).toBe(true);
    });

    it("keeps other system messages and anything a client wrote", () => {
        expect(isAutomaticMessage(auto("a", "payment_required"))).toBe(false);
        expect(isAutomaticMessage({ is_automatic: true, metadata: null })).toBe(false);
        expect(isAutomaticMessage({ is_automatic: false, metadata: { kind: "welcome" } })).toBe(false);
        expect(isAutomaticMessage({})).toBe(false);
    });
});

describe("latestReadableMessageId", () => {
    it("skips trailing automatic rows", () => {
        expect(latestReadableMessageId([auto("w", "welcome"), auto("n", "start_note"), msg("m1"), auto("r", "auto_reply")])).toBe("m1");
    });

    it("is null for a thread with only automatic rows, or none", () => {
        expect(latestReadableMessageId([auto("w", "welcome"), auto("n", "start_note")])).toBeNull();
        expect(latestReadableMessageId([])).toBeNull();
        expect(latestReadableMessageId(undefined)).toBeNull();
    });
});

describe("summarizeTicketMessages / hasUnreadMessage", () => {
    it("a new or backfilled ticket has no preview, no count and nothing unread", () => {
        const summary = summarizeTicketMessages([auto("w", "welcome"), auto("n", "start_note")]).get("t1");
        expect(summary).toMatchObject({ count: 0, firstContent: null, lastMessageId: null });
        expect(hasUnreadMessage(summary, null)).toBe(false);
    });

    it("counts and previews only real messages, per ticket", () => {
        const byTicket = summarizeTicketMessages([
            auto("w", "welcome"),
            auto("n", "start_note"),
            msg("m1"),
            auto("r", "auto_reply"),
            msg("x1", "t2"),
            msg("m2"),
        ]);
        expect(byTicket.get("t1")).toMatchObject({ count: 2, firstContent: "text m1", lastMessageId: "m2" });
        expect(byTicket.get("t2")).toMatchObject({ count: 1, firstContent: "text x1", lastMessageId: "x1" });
    });

    it("an auto-reply after the last read message is not unread", () => {
        const summary = summarizeTicketMessages([msg("m1"), auto("r", "auto_reply")]).get("t1");
        expect(hasUnreadMessage(summary, "m1")).toBe(false);
        // Read state stored before automatic rows were skipped.
        expect(hasUnreadMessage(summary, "r")).toBe(false);
        expect(hasUnreadMessage(summary, null)).toBe(true);
    });

    it("a real message after the last read one is unread", () => {
        const summary = summarizeTicketMessages([msg("m1"), auto("r", "auto_reply"), msg("m2")]).get("t1");
        expect(hasUnreadMessage(summary, "m1")).toBe(true);
        expect(hasUnreadMessage(summary, "r")).toBe(true);
        expect(hasUnreadMessage(summary, "m2")).toBe(false);
    });

    it("no summary means nothing unread", () => {
        expect(hasUnreadMessage(undefined, null)).toBe(false);
    });
});
