import { describe, expect, it, vi } from "vitest";
import {
  ABANDONED_GUEST_TICKET_EXCLUSION,
  excludeAbandonedGuestTickets,
  isAbandonedGuestTicket,
} from "./abandoned-guest-tickets";

describe("isAbandonedGuestTicket", () => {
  it("is true for a cancelled guest ticket", () => {
    expect(isAbandonedGuestTicket({ guest: true, status: "cancelled" })).toBe(
      true
    );
  });

  it("is false for a guest ticket that is still available", () => {
    expect(isAbandonedGuestTicket({ guest: true, status: "available" })).toBe(
      false
    );
  });

  it("is false for a cancelled non-guest ticket", () => {
    expect(isAbandonedGuestTicket({ guest: false, status: "cancelled" })).toBe(
      false
    );
  });

  it("is false when guest is null or undefined", () => {
    expect(isAbandonedGuestTicket({ guest: null, status: "cancelled" })).toBe(
      false
    );
    expect(
      isAbandonedGuestTicket({ guest: undefined, status: "cancelled" })
    ).toBe(false);
    expect(isAbandonedGuestTicket({ status: "cancelled" })).toBe(false);
  });
});

describe("excludeAbandonedGuestTickets", () => {
  it("applies the shared exclusion filter and returns the query", () => {
    const query = { or: vi.fn() };
    query.or.mockReturnValue(query);

    expect(excludeAbandonedGuestTickets(query)).toBe(query);
    expect(query.or).toHaveBeenCalledWith(ABANDONED_GUEST_TICKET_EXCLUSION);
    expect(ABANDONED_GUEST_TICKET_EXCLUSION).toBe(
      "guest.eq.false,status.neq.cancelled"
    );
  });
});
