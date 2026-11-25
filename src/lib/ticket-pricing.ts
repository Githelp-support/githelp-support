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

/**
 * A flat-fee ticket: both per-minute rates are zero, so once the start price
 * is collected more time costs nothing. Mirrors the flat-fee branch of the DB
 * gate `enforce_time_entry_payment_gate` (which reads the ticket's pricing
 * snapshot): logging stays open after the start price was captured, and the
 * weekly rehold places no further hold. Returns false while the settings
 * haven't loaded.
 */
export function isFlatFeePricing(settings: TicketPriceSettings | null | undefined): boolean {
  if (!settings) return false
  return (settings.ticket_price_minute_first_60 ?? 0) <= 0 && (settings.ticket_price_minute_after_60 ?? 0) <= 0
}

const centsToDollars =(cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2)

/**
 * Ticket prices formatted as dollar strings. Returns `null` while the settings
 * are missing or still loading — callers render "Rates not configured" (or
 * nothing) instead of placeholder prices. A stored price of 0 is a real price
 * ("0.00"); a null column counts as 0, like `isFreeSupport`.
 */
export function formatTicketRates(settings: TicketPriceSettings | null | undefined): TicketRates | null {
  if (!settings) return null
  return {
    startPrice: centsToDollars(settings.ticket_start_price),
    first60Price: centsToDollars(settings.ticket_price_minute_first_60),
    after60Price: centsToDollars(settings.ticket_price_minute_after_60),
  }
}

/**
 * The rate snapshot stored on a ticket (`tickets.rate_*`, taken by the insert
 * trigger when the ticket was opened), in cents.
 */
export interface TicketRateSnapshotColumns {
  rate_start_price?: number | null
  rate_first_60?: number | null
  rate_after_60?: number | null
  rate_is_free?: boolean | null
  rates_snapshot_at?: string | null
}

/**
 * The same snapshot as copied into the welcome message's metadata
 * (`metadata.kind === "welcome"`): `is_free` is always present; the three
 * rates only when the ticket is paid.
 */
export interface WelcomeRateMetadata {
  is_free?: unknown
  rate_start_price?: unknown
  rate_first_60?: unknown
  rate_after_60?: unknown
}

export type TicketRatesSnapshot = { isFree: true } | ({ isFree: false } & TicketRates)

const centsOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

/**
 * Rates from a ticket's stored snapshot (the ticket row, or the welcome
 * message metadata), so a ticket keeps the prices it was opened with even if
 * the project changes its settings later. Returns `{ isFree: true }` for a free
 * ticket, the formatted rates (via `formatTicketRates`) for a paid one, and
 * `null` when there is no snapshot (callers fall back to the live settings or
 * `RATES_NOT_CONFIGURED`).
 */
export function ticketRatesFromSnapshot(
  source: TicketRateSnapshotColumns | WelcomeRateMetadata | null | undefined,
): TicketRatesSnapshot | null {
  if (!source) return null

  let storedFree: boolean | null
  if ("is_free" in source) {
    storedFree = typeof source.is_free === "boolean" ? source.is_free : null
  } else {
    const ticket = source as TicketRateSnapshotColumns
    storedFree = ticket.rate_is_free ?? null
  }

  const settings: TicketPriceSettings = {
    ticket_start_price: centsOrNull(source.rate_start_price),
    ticket_price_minute_first_60: centsOrNull(source.rate_first_60),
    ticket_price_minute_after_60: centsOrNull(source.rate_after_60),
  }
  const hasAnyRate =
    settings.ticket_start_price != null ||
    settings.ticket_price_minute_first_60 != null ||
    settings.ticket_price_minute_after_60 != null

  // No flag and no prices: nothing was snapshotted.
  if (storedFree == null && !hasAnyRate) return null

  const isFree = storedFree ?? isFreeSupport(settings)
  if (isFree) return { isFree: true }
  // Paid, but the prices are missing: don't render placeholder "0.00" rates.
  if (!hasAnyRate) return null

  const rates = formatTicketRates(settings)
  return rates ? { isFree: false, ...rates } : null
}

/** Copy shown wherever rates would be listed but the project has no payment settings row. */
export const RATES_NOT_CONFIGURED = "Rates not configured"
