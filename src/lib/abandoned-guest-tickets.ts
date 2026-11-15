/**
 * Abandoned guest tickets.
 *
 * A ticket is an abandoned guest ticket when it was opened by a guest
 * (`guest === true`) and is now `status === 'cancelled'`.
 *
 * The `close_abandoned_guest_tickets` cron cancels guest tickets that have
 * been unseen for 15 minutes and posts a `visitor_left` system message in the
 * chat. These tickets are noise for the team and must not appear in any
 * Helper/Admin list, table or overview.
 *
 * Adopted tickets (a guest who signed in and claimed the ticket) have
 * `guest = false`, so they are never matched, even when cancelled later.
 *
 * This file is the single shared definition. Use
 * `excludeAbandonedGuestTickets` on Supabase queries and
 * `isAbandonedGuestTicket` for client-side filtering rather than repeating
 * the condition per page.
 */

/**
 * PostgREST `.or()` filter that keeps a row when it is not a guest ticket OR
 * not cancelled, i.e. drops rows that are both guest and cancelled.
 */
export const ABANDONED_GUEST_TICKET_EXCLUSION =
  "guest.eq.false,status.neq.cancelled";

/**
 * Adds the abandoned-guest-ticket exclusion to a Supabase tickets query.
 */
export function excludeAbandonedGuestTickets<
  Q extends { or(filters: string): Q },
>(query: Q): Q {
  return query.or(ABANDONED_GUEST_TICKET_EXCLUSION);
}

/**
 * True when the ticket was opened by a guest and has been cancelled.
 * A null or undefined `guest` is treated as not a guest.
 */
export function isAbandonedGuestTicket(ticket: {
  guest?: boolean | null;
  status?: string | null;
}): boolean {
  return ticket.guest === true && ticket.status === "cancelled";
}
