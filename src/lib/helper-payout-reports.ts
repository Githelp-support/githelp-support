/**
 * Pure helpers for the helper ("Helper" role) Reports page and the admin
 * Support reports: payout rows come from `payments_transfers`, hours from
 * `tickets_time_entries`.
 */
import type { PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"
import { groupByTicket, sortByDateAsc, sumOf, type TicketGroup } from "@/lib/ticket-groups"

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

/**
 * Everything the helper's payout statement (their payment proof) shows for one
 * `payments_transfers` row. Helpers are paid by Stripe transfer to their own
 * connected account, which has no Stripe-hosted receipt, so the platform
 * issues this statement instead.
 */
export interface PayoutStatement {
    /** Human-facing reference: the Stripe transfer id, else a short form of the payout id. */
    reference: string
    /** ISO timestamp: when the money moved, else when the payout was recorded. */
    date: string
    status: PaymentTransfer["status"]
    statusLabel: string
    statusNote: string
    payee: {
        name: string
        email: string | null
        /** Stripe connected account the transfer was sent to (acct_...). */
        stripeAccountId: string | null
    }
    projectName: string
    ticketId: string | null
    ticketShortId: string
    ticketTitle: string
    ticketType: string
    slaName: string | null
    amountSmallestUnit: number
    currency: string
    payoutId: string
    stripeTransferId: string | null
    /** The customer's `payments` row this payout was split from. */
    paymentId: string | null
    failureReason: string | null
}

const STATEMENT_STATUS: Record<PaymentTransfer["status"], { label: string; note: string }> = {
    completed: {
        label: "Paid out",
        note: "The amount has been transferred to your connected Stripe account. Stripe pays it out to your bank according to your payout schedule.",
    },
    pending: {
        label: "Pending",
        note: "The transfer has been scheduled and is sent once the customer's payment has settled.",
    },
    failed: {
        label: "Failed",
        note: "Stripe could not complete this transfer, so nothing has been paid for it. Contact the project admin or Githelp support to have it re-sent.",
    },
}

/** Short, uppercase form of a payout row id used when no Stripe transfer id exists yet. */
export function payoutReference(transfer: Pick<PaymentTransfer, "id" | "transfer_id">): string {
    if (transfer.transfer_id) return transfer.transfer_id
    return `GH-${transfer.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export function buildPayoutStatement(transfer: PaymentTransfer): PayoutStatement {
    const user = transfer.helper?.user
    const status = STATEMENT_STATUS[transfer.status] ?? STATEMENT_STATUS.pending
    const ticketId = transfer.ticket?.id ?? transfer.ticket_id
    return {
        reference: payoutReference(transfer),
        date: transferDate(transfer),
        status: transfer.status,
        statusLabel: status.label,
        statusNote: status.note,
        payee: {
            name: user?.name?.trim() || user?.username?.trim() || user?.email?.trim() || "Helper",
            email: user?.email?.trim() || null,
            stripeAccountId: transfer.destination_account_id || null,
        },
        projectName: transfer.project?.name?.trim() || "Project",
        ticketId,
        ticketShortId: ticketId?.slice(0, 7) || "-",
        ticketTitle: transfer.ticket?.title?.trim() || (ticketId ? "Untitled ticket" : "Payout"),
        ticketType: transferTicketType(transfer),
        slaName: transfer.ticket?.sla?.name?.trim() || transfer.sla?.name?.trim() || null,
        amountSmallestUnit: transfer.amount_smallest_unit,
        currency: transfer.currency || "usd",
        payoutId: transfer.id,
        stripeTransferId: transfer.transfer_id || null,
        paymentId: transfer.payment_id || null,
        failureReason: transfer.status === "failed" ? transfer.failure_reason || null : null,
    }
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

/** A ticket's payouts (to one payee) summarised as one record. */
export interface TransferGroupSummary {
    /** Everything owed on the ticket: failed transfers are left out unless every transfer failed. */
    amountSmallestUnit: number
    /** Transfers Stripe could not complete (nothing was paid for these). */
    failedSmallestUnit: number
    /** A failed transfer wins (money is missing), then pending, then completed. */
    status: PaymentTransfer["status"]
    /** Latest transfer date. */
    date: string
    currency: string
}

export function summarizeTransfers(transfers: PaymentTransfer[]): TransferGroupSummary {
    const failed = transfers.filter((t) => t.status === "failed")
    const counting = transfers.filter((t) => t.status !== "failed")
    const status: PaymentTransfer["status"] = failed.length > 0
        ? "failed"
        : transfers.some((t) => t.status === "pending")
          ? "pending"
          : "completed"
    const dates = transfers.map(transferDate).sort()
    return {
        amountSmallestUnit: sumOf(counting.length > 0 ? counting : transfers, (t) => t.amount_smallest_unit),
        failedSmallestUnit: counting.length > 0 ? sumOf(failed, (t) => t.amount_smallest_unit) : 0,
        status,
        date: dates[dates.length - 1] ?? "",
        currency: transfers.find((t) => t.currency)?.currency || "usd",
    }
}

export interface TransferTicketGroup extends TicketGroup<PaymentTransfer>, TransferGroupSummary {}

/**
 * One record per ticket (and per helper when `byHelper`), transfers oldest
 * first inside each, groups newest activity first.
 */
export function groupTransfersByTicket(
    transfers: PaymentTransfer[],
    options: { byHelper?: boolean } = {},
): TransferTicketGroup[] {
    return groupByTicket(
        transfers,
        (t) => t.ticket_id ?? t.ticket?.id,
        (t) => t.id,
        options.byHelper ? (t) => t.helper_id ?? t.helper?.user_id ?? "unknown" : undefined,
    )
        .map((group) => {
            const items = sortByDateAsc(group.items, transferDate)
            return { ...group, items, ...summarizeTransfers(items) }
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
