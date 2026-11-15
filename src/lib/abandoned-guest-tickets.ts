/**
 * Abandoned guest tickets.
 *
 * A ticket is an abandoned guest ticket when it was opened by a guest
 * (`guest === true`) and is now `status === 'cancelled'`.
 *
 * A guest ticket counts as left when it has been unseen for 15 minutes, or
 * when the visitor closed the window about two minutes ago
 * (`leave_guest_ticket`, see `useGuestPresence`). What the
 * `close_abandoned_guest_tickets` cron then does depends on whether a helper
 * has written in the ticket (backend migration
 * 20261115130000_guest_ticket_abandonment):
 *
 * - No helper message: the ticket is cancelled with a `visitor_left` system
 *   message and deleted 30 minutes after the visitor left. These tickets are
 *   noise for the team and must not appear in any Helper/Admin list, table
 *   or overview.
 * - A helper has written: the ticket stays open and listed, and a
 *   `guest_abandoned` system message offers the helper to formally end it
 *   (`end_abandoned_guest_ticket`, which completes the ticket so it is
 *   kept). After 30 minutes the helpers who wrote in it get a "Ticket
 *   abandoned" notification; if nobody ends it within 24 hours of that, it
 *   is cancelled and deleted, which hides it here too.
 *
 * The visitor can re-enter for 30 minutes after leaving: the next
 * `touch_guest_ticket` reopens the ticket and posts `guest_returned`.
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

type AbandonmentMessage = {
  id: string;
  sender_type: string;
  metadata?: unknown;
};

/**
 * The id of the `guest_abandoned` system message a helper can act on ("End
 * ticket"), or null. Only the latest one counts, and only while the ticket
 * is still an open guest ticket and the visitor has not come back
 * (`guest_returned`) or signed in (`guest_signed_in`) after it.
 */
export function activeGuestAbandonedMessageId(
  messages: readonly AbandonmentMessage[] | null | undefined,
  ticket: { guest?: boolean | null; status?: string | null } | null | undefined
): string | null {
  if (!messages || ticket?.guest !== true) return null;
  if (ticket.status === "completed" || ticket.status === "cancelled") return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender_type !== "system") continue;
    const kind = (m.metadata as { kind?: unknown } | null | undefined)?.kind;
    if (kind === "guest_returned" || kind === "guest_signed_in") return null;
    if (kind === "guest_abandoned") return m.id;
  }
  return null;
}
