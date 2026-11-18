import { describe, it, expect } from "vitest"
import { VISIBLE_TICKETS_OR_FILTER, isHiddenGuestTicket } from "../guest-tickets"

describe("isHiddenGuestTicket", () => {
  it("hides a cancelled guest ticket", () => {
    expect(isHiddenGuestTicket({ guest: true, status: "cancelled" })).toBe(true)
  })

  it("keeps guest tickets that are still open or were completed", () => {
    expect(isHiddenGuestTicket({ guest: true, status: "available" })).toBe(false)
    expect(isHiddenGuestTicket({ guest: true, status: "completed" })).toBe(false)
  })

  it("keeps a signed-in customer's cancelled ticket", () => {
    expect(isHiddenGuestTicket({ guest: false, status: "cancelled" })).toBe(false)
    expect(isHiddenGuestTicket({ status: "cancelled" })).toBe(false)
  })

  it("is false for a missing ticket", () => {
    expect(isHiddenGuestTicket(null)).toBe(false)
    expect(isHiddenGuestTicket(undefined)).toBe(false)
  })
})

describe("VISIBLE_TICKETS_OR_FILTER", () => {
  it("is the PostgREST form of NOT (guest AND cancelled)", () => {
    expect(VISIBLE_TICKETS_OR_FILTER).toBe("guest.eq.false,status.neq.cancelled")
  })
})
