import { describe, it, expect } from "vitest";
import {
    calculateTotalTime,
    describeAutoAcceptDeadline,
    getTimeEntryReviewStatus,
    isBillableTimeEntry,
    TIME_ENTRY_AUTO_ACCEPT_HOURS,
    type TimeEntry,
} from "@/lib/time-entries";

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
    return {
        id: "e1",
        ticket_id: "t1",
        helper_id: "h1",
        type: "solo",
        time_milliseconds: 30 * 60_000,
        note: null,
        date: "2026-09-25",
        created_at: "2026-09-25T10:00:00.000Z",
        review_status: "pending",
        ...overrides,
    };
}

describe("review status helpers", () => {
    it("treats rows without a status as accepted (logged before the column existed)", () => {
        expect(getTimeEntryReviewStatus({ review_status: null })).toBe("accepted");
        expect(getTimeEntryReviewStatus({ review_status: undefined })).toBe("accepted");
        expect(getTimeEntryReviewStatus({ review_status: "declined" })).toBe("declined");
    });

    it("counts everything but declined entries towards logged time", () => {
        expect(isBillableTimeEntry({ review_status: "pending" })).toBe(true);
        expect(isBillableTimeEntry({ review_status: "accepted" })).toBe(true);
        expect(isBillableTimeEntry({ review_status: "declined" })).toBe(false);
        expect(
            calculateTotalTime([
                entry({ review_status: "accepted" }),
                entry({ id: "e2", review_status: "declined", time_milliseconds: 60 * 60_000 }),
                entry({ id: "e3", review_status: "pending", time_milliseconds: 15 * 60_000 }),
            ])
        ).toBe(45 * 60_000);
    });
});

describe("describeAutoAcceptDeadline", () => {
    const requestedAt = "2026-09-25T10:00:00.000Z";
    const requestedMs = Date.parse(requestedAt);
    const hour = 3_600_000;

    it("returns null without a usable timestamp", () => {
        expect(describeAutoAcceptDeadline(null)).toBeNull();
        expect(describeAutoAcceptDeadline(undefined)).toBeNull();
        expect(describeAutoAcceptDeadline("not a date")).toBeNull();
    });

    it("counts down from the review request in whole hours", () => {
        expect(TIME_ENTRY_AUTO_ACCEPT_HOURS).toBe(24);
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs)).toBe("in about 24 hours");
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs + 19 * hour)).toBe("in about 5 hours");
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs + 23 * hour)).toBe("in about 1 hour");
    });

    it("switches to coarser wording near the deadline and past it", () => {
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs + 23.5 * hour)).toBe("in less than an hour");
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs + 24 * hour - 60_000)).toBe("any moment now");
        expect(describeAutoAcceptDeadline(requestedAt, requestedMs + 30 * hour)).toBe("any moment now");
    });
});
