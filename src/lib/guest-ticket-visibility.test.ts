import { describe, it, expect } from "vitest"
import { HIDE_ABANDONED_GUEST_TICKETS_OR, isAbandonedGuestTicket } from "./guest-ticket-visibility"

describe("isAbandonedGuestTicket", () => {
  it("hides a cancelled guest ticket (the visitor left before signing in)", () => {
    expect(isAbandonedGuestTicket({ guest: true, status: "cancelled" })).toBe(true)
  })

  it("keeps a guest ticket that is still available", () => {
    expect(isAbandonedGuestTicket({ guest: true, status: "available" })).toBe(false)
  })

  it("keeps a cancelled ticket from a signed-in user", () => {
    expect(isAbandonedGuestTicket({ guest: false, status: "cancelled" })).toBe(false)
  })

  it("keeps an adopted ticket (guest false) whatever its status", () => {
    expect(isAbandonedGuestTicket({ guest: false, status: "available" })).toBe(false)
    expect(isAbandonedGuestTicket({ guest: false, status: "completed" })).toBe(false)
  })

  it("keeps tickets where guest or status is missing", () => {
    expect(isAbandonedGuestTicket({})).toBe(false)
    expect(isAbandonedGuestTicket({ guest: null, status: "cancelled" })).toBe(false)
    expect(isAbandonedGuestTicket({ guest: true, status: null })).toBe(false)
  })
})

describe("HIDE_ABANDONED_GUEST_TICKETS_OR", () => {
  it("keeps rows that are not guest tickets or not cancelled", () => {
    expect(HIDE_ABANDONED_GUEST_TICKETS_OR).toBe("guest.is.false,status.neq.cancelled")
  })
})
