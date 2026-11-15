import { describe, expect, it, vi } from "vitest";
import {
  ABANDONED_GUEST_TICKET_EXCLUSION,
  activeGuestAbandonedMessageId,
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

describe("activeGuestAbandonedMessageId", () => {
  const system = (id: string, kind: string) => ({
    id,
    sender_type: "system",
    metadata: { kind },
  });
  const helper = (id: string) => ({ id, sender_type: "helper", metadata: null });
  const openGuest = { guest: true, status: "available" };

  it("returns the latest guest_abandoned message of an open guest ticket", () => {
    expect(
      activeGuestAbandonedMessageId(
        [system("a", "guest_abandoned"), system("r", "guest_returned"), helper("h"), system("b", "guest_abandoned")],
        openGuest
      )
    ).toBe("b");
  });

  it("is null once the guest returned or signed in afterwards", () => {
    expect(
      activeGuestAbandonedMessageId([system("a", "guest_abandoned"), system("r", "guest_returned")], openGuest)
    ).toBeNull();
    expect(
      activeGuestAbandonedMessageId([system("a", "guest_abandoned"), system("s", "guest_signed_in")], openGuest)
    ).toBeNull();
  });

  it("is null for a closed ticket, a non-guest ticket or without messages", () => {
    const messages = [system("a", "guest_abandoned")];
    expect(activeGuestAbandonedMessageId(messages, { guest: true, status: "completed" })).toBeNull();
    expect(activeGuestAbandonedMessageId(messages, { guest: true, status: "cancelled" })).toBeNull();
    expect(activeGuestAbandonedMessageId(messages, { guest: false, status: "available" })).toBeNull();
    expect(activeGuestAbandonedMessageId(undefined, openGuest)).toBeNull();
    expect(activeGuestAbandonedMessageId([helper("h")], openGuest)).toBeNull();
  });
});
