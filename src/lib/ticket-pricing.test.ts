import { describe, it, expect } from "vitest"
import { formatTicketRates, isFlatFeePricing, isFreeSupport, ticketRatesFromSnapshot } from "./ticket-pricing"

describe("isFreeSupport", () => {
  it("is true only when all three prices are zero", () => {
    expect(
      isFreeSupport({ ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0 }),
    ).toBe(true)
  })

  it("is false when any single price is set", () => {
    expect(
      isFreeSupport({ ticket_start_price: 100, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0 }),
    ).toBe(false)
    expect(
      isFreeSupport({ ticket_start_price: 0, ticket_price_minute_first_60: 1, ticket_price_minute_after_60: 0 }),
    ).toBe(false)
    expect(
      isFreeSupport({ ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 1 }),
    ).toBe(false)
  })

  it("is false while settings have not loaded", () => {
    expect(isFreeSupport(null)).toBe(false)
    expect(isFreeSupport(undefined)).toBe(false)
  })
})

describe("formatTicketRates", () => {
  it("formats cents as dollars", () => {
    expect(
      formatTicketRates({ ticket_start_price: 1000, ticket_price_minute_first_60: 150, ticket_price_minute_after_60: 100 }),
    ).toEqual({ startPrice: "10.00", first60Price: "1.50", after60Price: "1.00" })
  })

  it("shows a stored price of zero as 0.00 instead of the placeholder", () => {
    expect(
      formatTicketRates({ ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0 }),
    ).toEqual({ startPrice: "0.00", first60Price: "0.00", after60Price: "0.00" })
  })

  it("returns null instead of placeholder prices when settings are missing", () => {
    expect(formatTicketRates(undefined)).toBeNull()
    expect(formatTicketRates(null)).toBeNull()
  })

  it("treats a null column as zero once settings exist", () => {
    expect(
      formatTicketRates({ ticket_start_price: 500, ticket_price_minute_first_60: null, ticket_price_minute_after_60: undefined }),
    ).toEqual({ startPrice: "5.00", first60Price: "0.00", after60Price: "0.00" })
  })
})

describe("isFlatFeePricing", () => {
  it("is true when both per-minute prices are zero", () => {
    expect(isFlatFeePricing({ ticket_start_price: 5000, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: null })).toBe(true)
  })

  it("is false when either per-minute price is set, or the settings are missing", () => {
    expect(isFlatFeePricing({ ticket_start_price: 5000, ticket_price_minute_first_60: 100, ticket_price_minute_after_60: 0 })).toBe(false)
    expect(isFlatFeePricing({ ticket_start_price: 5000, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 50 })).toBe(false)
    expect(isFlatFeePricing(null)).toBe(false)
  })
})

describe("ticketRatesFromSnapshot", () => {
  it("returns null without a snapshot", () => {
    expect(ticketRatesFromSnapshot(null)).toBeNull()
    expect(ticketRatesFromSnapshot({ rate_start_price: null, rate_first_60: null, rate_after_60: null, rate_is_free: null })).toBeNull()
    expect(ticketRatesFromSnapshot({})).toBeNull()
  })

  it("formats a paid ticket's snapshot columns", () => {
    expect(
      ticketRatesFromSnapshot({ rate_start_price: 500, rate_first_60: 150, rate_after_60: 100, rate_is_free: false }),
    ).toEqual({ isFree: false, startPrice: "5.00", first60Price: "1.50", after60Price: "1.00" })
  })

  it("returns the free state from the ticket flag", () => {
    expect(ticketRatesFromSnapshot({ rate_start_price: 0, rate_first_60: 0, rate_after_60: 0, rate_is_free: true })).toEqual({
      isFree: true,
    })
  })

  it("derives the free state from the rates when the flag is missing", () => {
    expect(ticketRatesFromSnapshot({ rate_start_price: 0, rate_first_60: 0, rate_after_60: null })).toEqual({ isFree: true })
  })

  it("reads welcome message metadata", () => {
    expect(ticketRatesFromSnapshot({ kind: "welcome", is_free: true } as Record<string, unknown>)).toEqual({ isFree: true })
    expect(
      ticketRatesFromSnapshot({ kind: "welcome", is_free: false, rate_start_price: 1000, rate_first_60: 200, rate_after_60: 0 } as Record<string, unknown>),
    ).toEqual({ isFree: false, startPrice: "10.00", first60Price: "2.00", after60Price: "0.00" })
  })

  it("returns null for a paid snapshot without prices", () => {
    expect(ticketRatesFromSnapshot({ is_free: false })).toBeNull()
  })
})
