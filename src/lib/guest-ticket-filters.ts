/**
 * Abandoned guest tickets: a ticket opened by a visitor who never signed in
 * (`guest = true`) that the cleanup cron has cancelled. They are noise for
 * helpers and admins, so no helper/admin list, table or count includes them.
 * An adopted ticket has `guest = false` and is treated like any other ticket,
 * cancelled or not.
 *
 * Customer-side queries must NOT use these: the guest still has to reach
 * their own ticket.
 */

/** PostgREST `or` filter keeping every ticket that is not an abandoned guest ticket. */
export const NOT_ABANDONED_GUEST_TICKET_FILTER = "guest.eq.false,status.neq.cancelled";

/**
 * Narrows a `tickets` query to everything except abandoned guest tickets.
 * Pass `referencedTable` when `tickets` is an embedded (`!inner`) resource.
 */
export function excludeAbandonedGuestTickets<Q extends { or: (filters: string, options?: any) => unknown }>(
    query: Q,
    referencedTable?: string
): Q {
    return (
        referencedTable
            ? query.or(NOT_ABANDONED_GUEST_TICKET_FILTER, { referencedTable })
            : query.or(NOT_ABANDONED_GUEST_TICKET_FILTER)
    ) as Q;
}

type GuestTicketFields = { guest?: boolean | null; status?: string | null };

/** Row predicate for client-side filtering; the row must have been selected with `guest` and `status`. */
export function isAbandonedGuestTicket(ticket: GuestTicketFields | null | undefined): boolean {
    return ticket?.guest === true && ticket.status === "cancelled";
}

/** Drops abandoned guest tickets from already-fetched rows. */
export function withoutAbandonedGuestTickets<T extends GuestTicketFields>(tickets: readonly T[]): T[] {
    return tickets.filter((ticket) => !isAbandonedGuestTicket(ticket));
}
