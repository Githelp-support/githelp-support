import { describe, it, expect } from "vitest";
import {
    calculateTotalTime,
    describeAutoAcceptDeadline,
    getTimeEntriesRejection,
    getTimeEntryReviewStatus,
    isBillableTimeEntry,
    isManualTimeConfirmation,
    isTimeReviewRejected,
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

/** `time_entries_confirmed` metadata as written by the `confirm_time_entries` RPC. */
function confirmed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        kind: "time_entries_confirmed",
        ticket_id: "t1",
        reviewer_user_id: "u1",
        reviewer_name: "Grace",
        auto: false,
        accepted_count: 0,
        accepted_milliseconds: 0,
        declined: [
            { entry_id: "e1", reason: "We agreed on one hour." },
            { entry_id: "e2", reason: "We agreed on one hour." },
        ],
        ...overrides,
    };
}

describe("getTimeEntriesRejection", () => {
    it("returns the reviewer and the shared explanation when everything was declined with one reason", () => {
        expect(getTimeEntriesRejection(confirmed())).toEqual({
            reviewerName: "Grace",
            reason: "We agreed on one hour.",
        });
        expect(getTimeEntriesRejection(confirmed({ declined: [{ entry_id: "e1", reason: "Too much" }] }))).toEqual({
            reviewerName: "Grace",
            reason: "Too much",
        });
    });

    it("falls back to a generic reviewer name", () => {
        expect(getTimeEntriesRejection(confirmed({ reviewer_name: null }))?.reviewerName).toBe("The user");
        expect(getTimeEntriesRejection(confirmed({ reviewer_name: "  " }))?.reviewerName).toBe("The user");
    });

    it("returns null for other kinds and for missing metadata", () => {
        expect(getTimeEntriesRejection(null)).toBeNull();
        expect(getTimeEntriesRejection(undefined)).toBeNull();
        expect(getTimeEntriesRejection({})).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ kind: "time_review_requested" }))).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ kind: "time_entry_declined" }))).toBeNull();
    });

    it("returns null when the 24h job wrote the message", () => {
        expect(getTimeEntriesRejection(confirmed({ auto: true }))).toBeNull();
    });

    it("returns null when any entry was accepted", () => {
        expect(getTimeEntriesRejection(confirmed({ accepted_count: 1 }))).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ accepted_count: undefined }))).toBeNull();
    });

    it("returns null without declined entries", () => {
        expect(getTimeEntriesRejection(confirmed({ declined: [] }))).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ declined: undefined }))).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ declined: "e1" }))).toBeNull();
    });

    it("returns null when the entries were declined for different reasons", () => {
        expect(
            getTimeEntriesRejection(
                confirmed({
                    declined: [
                        { entry_id: "e1", reason: "Too much" },
                        { entry_id: "e2", reason: "Not agreed" },
                    ],
                })
            )
        ).toBeNull();
        expect(
            getTimeEntriesRejection(confirmed({ declined: [{ entry_id: "e1", reason: "Too much" }, { entry_id: "e2" }] }))
        ).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ declined: [{ entry_id: "e1" }] }))).toBeNull();
        expect(getTimeEntriesRejection(confirmed({ declined: [null] }))).toBeNull();
    });
});

describe("isTimeReviewRejected", () => {
    const requested = { kind: "time_review_requested" };

    it("is false without a time review message", () => {
        expect(isTimeReviewRejected([])).toBe(false);
        expect(isTimeReviewRejected([null, undefined, { kind: "time_logged" }])).toBe(false);
    });

    it("is true when the last review message is a manual confirmation that declined everything", () => {
        expect(isTimeReviewRejected([requested, confirmed()])).toBe(true);
        // Later messages of other kinds don't change the outcome.
        expect(isTimeReviewRejected([requested, confirmed(), null, { kind: "time_logged" }])).toBe(true);
        // Unlike getTimeEntriesRejection, the reasons don't have to match.
        expect(
            isTimeReviewRejected([
                requested,
                confirmed({
                    declined: [
                        { entry_id: "e1", reason: "Too much" },
                        { entry_id: "e2", reason: "Not agreed" },
                    ],
                }),
            ])
        ).toBe(true);
    });

    it("is cleared by a newer summary request or confirmation", () => {
        expect(isTimeReviewRejected([requested, confirmed(), requested])).toBe(false);
        expect(isTimeReviewRejected([requested, confirmed(), requested, confirmed({ accepted_count: 2, declined: [] })])).toBe(
            false
        );
    });

    it("is false when something was accepted, nothing was declined or the job confirmed", () => {
        expect(isTimeReviewRejected([requested, confirmed({ accepted_count: 1 })])).toBe(false);
        expect(isTimeReviewRejected([requested, confirmed({ declined: [] })])).toBe(false);
        expect(isTimeReviewRejected([requested, confirmed({ auto: true })])).toBe(false);
    });
});

describe("isManualTimeConfirmation", () => {
    it("is true only when the customer confirmed at least one entry", () => {
        expect(isManualTimeConfirmation(confirmed({ accepted_count: 2, declined: [] }))).toBe(true);
        // Partly declined still counts: something was confirmed by hand.
        expect(isManualTimeConfirmation(confirmed({ accepted_count: 1 }))).toBe(true);
        expect(isManualTimeConfirmation(confirmed())).toBe(false);
        expect(isManualTimeConfirmation(confirmed({ accepted_count: 2, auto: true }))).toBe(false);
        expect(isManualTimeConfirmation({ kind: "time_review_requested", accepted_count: 2 })).toBe(false);
        expect(isManualTimeConfirmation(null)).toBe(false);
        expect(isManualTimeConfirmation(undefined)).toBe(false);
    });
});
