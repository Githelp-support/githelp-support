/**
 * One shared rule for "the visitor left before signing in".
 *
 * A guest ticket (`guest === true`) that ends up `cancelled` was never
 * adopted by a real account: the visitor left before signing in. Those
 * tickets are hidden from lists and counts. Once a guest signs in the ticket
 * is adopted (`guest` becomes false) and it is kept, whatever its status.
 */
export function isAbandonedGuestTicket(ticket: {
  guest?: boolean | null
  status?: string | null
}): boolean {
  return ticket.guest === true && ticket.status === "cancelled"
}

/**
 * The same rule as a PostgREST filter for queries on `tickets`: keeps every
 * row that is not an abandoned guest ticket. Use as
 * `.or(HIDE_ABANDONED_GUEST_TICKETS_OR)`.
 */
export const HIDE_ABANDONED_GUEST_TICKETS_OR = "guest.is.false,status.neq.cancelled"
