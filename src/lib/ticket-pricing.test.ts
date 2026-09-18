import { describe, it, expect } from "vitest"
import { formatTicketRates, isFreeSupport } from "./ticket-pricing"

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

  it("falls back to placeholders only when settings are missing", () => {
    expect(formatTicketRates(undefined)).toEqual({ startPrice: "10.00", first60Price: "1.50", after60Price: "1.00" })
  })
})
