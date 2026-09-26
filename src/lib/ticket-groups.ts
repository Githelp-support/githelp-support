/**
 * Groups payment-like records by ticket for the Reports pages and their
 * exports. One ticket can have several transactions (hold capture plus
 * overage, weekly captures on long tickets, or a retry after a decline);
 * listing them as separate records reads as separate tickets, so every
 * report shows one record per ticket with its transactions underneath.
 */

export interface TicketGroup<T> {
    /** Stable key: the ticket id (plus `subKey`), or the record's own id when it has no ticket. */
    key: string
    ticketId: string | null
    /** In input order. */
    items: T[]
}

/**
 * Buckets `items` by ticket, keeping the order in which each ticket first
 * appears. Records without a ticket each form their own group. `subKey`
 * splits a ticket further, e.g. one group per helper paid on the ticket.
 */
export function groupByTicket<T>(
    items: T[],
    ticketIdOf: (item: T) => string | null | undefined,
    idOf: (item: T) => string,
    subKey?: (item: T) => string | null | undefined,
): TicketGroup<T>[] {
    const groups = new Map<string, TicketGroup<T>>()
    for (const item of items) {
        const ticketId = ticketIdOf(item) || null
        const base = ticketId ? `ticket:${ticketId}` : `row:${idOf(item)}`
        const extra = ticketId && subKey ? subKey(item) : null
        const key = extra ? `${base}:${extra}` : base
        let group = groups.get(key)
        if (!group) {
            group = { key, ticketId, items: [] }
            groups.set(key, group)
        }
        group.items.push(item)
    }
    return Array.from(groups.values())
}

/** Oldest first by the given ISO date. */
export function sortByDateAsc<T>(items: T[], dateOf: (item: T) => string): T[] {
    return [...items].sort((a, b) => new Date(dateOf(a)).getTime() - new Date(dateOf(b)).getTime())
}

export function sumOf<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0)
}

/** "2 transactions" / "1 transaction". */
export function transactionCountLabel(count: number, noun = "transaction"): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}
