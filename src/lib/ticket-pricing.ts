/** The three per-ticket prices on `projects_payment_settings`, in cents. */
export interface TicketPriceSettings {
  ticket_start_price?: number | null
  ticket_price_minute_first_60?: number | null
  ticket_price_minute_after_60?: number | null
}

export interface TicketRates {
  startPrice: string
  first60Price: string
  after60Price: string
}

/**
 * A project offers support for free when the start price and both per-minute
 * rates are all zero. Mirrors `isFreeSupport` in the backend's
 * `_shared/payments/hold-amount.ts`: free tickets never get a `payments` row,
 * so UI that waits for an authorized payment must not wait on them.
 * Returns false while the settings haven't loaded.
 */
export function isFreeSupport(settings: TicketPriceSettings | null | undefined): boolean {
  if (!settings) return false
  return (
    (settings.ticket_start_price ?? 0) <= 0 &&
    (settings.ticket_price_minute_first_60 ?? 0) <= 0 &&
    (settings.ticket_price_minute_after_60 ?? 0) <= 0
  )
}

const centsToDollars = (cents: number | null | undefined, fallback: string) =>
  cents == null ? fallback : (cents / 100).toFixed(2)

/**
 * Ticket prices formatted as dollar strings. The fallbacks only apply while
 * the settings are missing — a stored price of 0 is a real price ("0.00").
 */
export function formatTicketRates(settings: TicketPriceSettings | null | undefined): TicketRates {
  return {
    startPrice: centsToDollars(settings?.ticket_start_price, "10.00"),
    first60Price: centsToDollars(settings?.ticket_price_minute_first_60, "1.50"),
    after60Price: centsToDollars(settings?.ticket_price_minute_after_60, "1.00"),
  }
}
