import { describe, expect, it, vi } from "vitest";
import {
    excludeAbandonedGuestTickets,
    isAbandonedGuestTicket,
    NOT_ABANDONED_GUEST_TICKET_FILTER,
    withoutAbandonedGuestTickets,
} from "../guest-ticket-filters";

describe("excludeAbandonedGuestTickets", () => {
    it("applies the guest/status or-filter and returns the narrowed query", () => {
        const narrowed = { narrowed: true };
        const query = { or: vi.fn(() => narrowed) };

        const result = excludeAbandonedGuestTickets(query);

        expect(query.or).toHaveBeenCalledTimes(1);
        expect(query.or).toHaveBeenCalledWith("guest.eq.false,status.neq.cancelled");
        expect(result).toBe(narrowed);
    });

    it("targets an embedded tickets resource when a referenced table is given", () => {
        const query = { or: vi.fn().mockReturnThis() };

        excludeAbandonedGuestTickets(query, "ticket");

        expect(query.or).toHaveBeenCalledWith(NOT_ABANDONED_GUEST_TICKET_FILTER, { referencedTable: "ticket" });
    });
});

describe("isAbandonedGuestTicket", () => {
    it("is true only for a cancelled ticket that is still a guest ticket", () => {
        expect(isAbandonedGuestTicket({ guest: true, status: "cancelled" })).toBe(true);
    });

    it("keeps adopted tickets, even when cancelled", () => {
        expect(isAbandonedGuestTicket({ guest: false, status: "cancelled" })).toBe(false);
    });

    it("keeps guest tickets that are still open or completed", () => {
        for (const status of ["available", "claimed", "in-progress", "completed"]) {
            expect(isAbandonedGuestTicket({ guest: true, status })).toBe(false);
        }
    });

    it("keeps rows without guest information and missing rows", () => {
        expect(isAbandonedGuestTicket({ status: "cancelled" })).toBe(false);
        expect(isAbandonedGuestTicket({ guest: null, status: "cancelled" })).toBe(false);
        expect(isAbandonedGuestTicket(null)).toBe(false);
        expect(isAbandonedGuestTicket(undefined)).toBe(false);
    });
});

describe("withoutAbandonedGuestTickets", () => {
    it("drops abandoned guest tickets and keeps the order of the rest", () => {
        const rows = [
            { id: "a", guest: true, status: "available" },
            { id: "b", guest: true, status: "cancelled" },
            { id: "c", guest: false, status: "cancelled" },
            { id: "d", guest: false, status: "completed" },
        ];

        expect(withoutAbandonedGuestTickets(rows).map((r) => r.id)).toEqual(["a", "c", "d"]);
    });
});
