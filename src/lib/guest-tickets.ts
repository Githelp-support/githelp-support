/**
 * Abandoned guest tickets.
 *
 * When a guest leaves an unanswered ticket the backend cancels it after about
 * two minutes, but only sets `deleted_at` half an hour later. For helpers and
 * admins such a ticket is gone the moment it is cancelled: every helper/admin
 * list, count and overview drops rows where `guest = true AND status =
 * 'cancelled'`. (`guest` is cleared when the visitor signs in, so a signed-in
 * customer's cancelled ticket is never affected.)
 *
 * Not for the guest's own reads (`findOpenTicket`, the support chat's ticket
 * fetch): the visitor still sees their own conversation.
 */

/**
 * PostgREST `or` expression that keeps every ticket except the hidden ones:
 * `NOT (guest AND status = 'cancelled')`. Use as `.or(VISIBLE_TICKETS_OR_FILTER)`;
 * it is ANDed with the query's other filters (including other `.or()` groups).
 */
export const VISIBLE_TICKETS_OR_FILTER = "guest.eq.false,status.neq.cancelled"

/** JS twin of the filter above, for rows that are read one at a time. */
export function isHiddenGuestTicket(
  ticket: { guest?: boolean | null; status?: string | null } | null | undefined,
): boolean {
  return ticket?.guest === true && ticket.status === "cancelled"
}
