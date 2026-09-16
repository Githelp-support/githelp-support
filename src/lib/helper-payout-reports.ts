/**
 * Pure helpers for the helper ("Helper" role) Reports page and the admin
 * Support reports: payout rows come from `payments_transfers`, hours from
 * `tickets_time_entries`.
 */
import type { PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"

export interface HelperMonthlyReportRow {
    /** Stable key, e.g. "2026-09". */
    id: string
    /** Label matching the month filter, e.g. "September 2026". */
    period: string
    periodRaw: number
    /** Distinct tickets with a payout row dated in this month. */
    ticketsClosed: number
    /** Total logged time in this month, in minutes. */
    minutesLogged: number
    /** Sum of non-failed payout rows dated in this month. */
    earningsSmallestUnit: number
    /** Portion of `earningsSmallestUnit` already transferred (status completed). */
    paidOutSmallestUnit: number
    currency: string
}

/** "September 2026" — the same label the month filter dropdown uses. */
export function monthLabel(dateIso: string): string {
    return new Date(dateIso).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Parse a `date` column value (YYYY-MM-DD) as a local calendar day so it
 * lands in the same month regardless of the viewer's timezone.
 */
export function parseCalendarDay(day: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
    if (!m) return new Date(day)
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** The date a payout row belongs to: when it settled, else when it was created. */
export function transferDate(transfer: Pick<PaymentTransfer, "completed_at" | "created_at">): string {
    return transfer.completed_at || transfer.created_at
}

function capitalise(value: string): string {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

/** First help category of the payout's ticket, capitalised; "Support" when none. */
export function transferTicketType(transfer: Pick<PaymentTransfer, "ticket">): string {
    const value = transfer.ticket?.categories?.find((c) => c.help_category?.value)?.help_category?.value
    return value ? capitalise(value) : "Support"
}

export function formatMinutes(minutes: number): string {
    const total = Math.max(0, Math.round(minutes))
    const hours = Math.floor(total / 60)
    const rest = total % 60
    if (hours === 0) return `${rest}m`
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

interface Group extends HelperMonthlyReportRow {
    tickets: Set<string>
}

function groupFor(groups: Map<string, Group>, date: Date, currency: string): Group {
    const key = monthKey(date)
    let group = groups.get(key)
    if (!group) {
        const first = new Date(date.getFullYear(), date.getMonth(), 1)
        group = {
            id: key,
            period: monthLabel(first.toISOString()),
            periodRaw: first.getTime(),
            ticketsClosed: 0,
            minutesLogged: 0,
            earningsSmallestUnit: 0,
            paidOutSmallestUnit: 0,
            currency,
            tickets: new Set<string>(),
        }
        groups.set(key, group)
    }
    return group
}

/**
 * One row per calendar month, newest first. Failed payouts are ignored. A
 * month with logged time but no payout (or the reverse) still gets a row.
 */
export function aggregateHelperMonthly(
    transfers: PaymentTransfer[],
    timeEntries: HelperTimeEntry[],
): HelperMonthlyReportRow[] {
    const groups = new Map<string, Group>()

    for (const transfer of transfers) {
        if (transfer.status === "failed") continue
        const group = groupFor(groups, new Date(transferDate(transfer)), transfer.currency || "usd")
        group.earningsSmallestUnit += transfer.amount_smallest_unit
        if (transfer.status === "completed") group.paidOutSmallestUnit += transfer.amount_smallest_unit
        group.tickets.add(transfer.ticket_id ?? transfer.id)
        group.ticketsClosed = group.tickets.size
    }

    for (const entry of timeEntries) {
        const group = groupFor(groups, parseCalendarDay(entry.date), "usd")
        group.minutesLogged += Math.round((entry.time_milliseconds || 0) / 60000)
    }

    return Array.from(groups.values())
        .map(({ tickets: _tickets, ...rest }) => rest)
        .sort((a, b) => b.periodRaw - a.periodRaw)
}

export interface ProjectMonthlyReportRow {
    id: string
    period: string
    periodRaw: number
    /** Distinct tickets with a helper payout row in this month. */
    ticketCount: number
    /** Helper payouts (transfer_user_type "helper"), excluding failed rows. */
    helperPayoutSmallestUnit: number
    /** The project's own share (transfer_user_type "project"), excluding failed rows. */
    projectShareSmallestUnit: number
    /** True once every helper payout in the month has settled. */
    allPaidOut: boolean
    currency: string
}

/**
 * Admin view: helper payouts and the project's own share per month, kept
 * apart so "paid out" never silently includes money the project kept.
 */
export function aggregateProjectMonthly(transfers: PaymentTransfer[]): ProjectMonthlyReportRow[] {
    const groups = new Map<string, ProjectMonthlyReportRow & { tickets: Set<string>; pending: number }>()

    for (const transfer of transfers) {
        if (transfer.status === "failed") continue
        const date = new Date(transferDate(transfer))
        const key = monthKey(date)
        let group = groups.get(key)
        if (!group) {
            const first = new Date(date.getFullYear(), date.getMonth(), 1)
            group = {
                id: key,
                period: monthLabel(first.toISOString()),
                periodRaw: first.getTime(),
                ticketCount: 0,
                helperPayoutSmallestUnit: 0,
                projectShareSmallestUnit: 0,
                allPaidOut: true,
                currency: transfer.currency || "usd",
                tickets: new Set<string>(),
                pending: 0,
            }
            groups.set(key, group)
        }
        if (transfer.transfer_user_type === "helper") {
            group.helperPayoutSmallestUnit += transfer.amount_smallest_unit
            group.tickets.add(transfer.ticket_id ?? transfer.id)
            group.ticketCount = group.tickets.size
            if (transfer.status !== "completed") group.pending += 1
        } else if (transfer.transfer_user_type === "project") {
            group.projectShareSmallestUnit += transfer.amount_smallest_unit
        }
    }

    return Array.from(groups.values())
        .map(({ tickets: _tickets, pending, ...rest }) => ({ ...rest, allPaidOut: pending === 0 }))
        .sort((a, b) => b.periodRaw - a.periodRaw)
}
