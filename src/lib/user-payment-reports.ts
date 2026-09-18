/**
 * Pure helpers for the end-user ("User" role) Reports page.
 *
 * The user's view is built from `payments` rows (what the customer was
 * charged for each ticket they created), not from `payments_transfers`
 * (helper payouts), which RLS hides from customers.
 */

/** `public.payment_status` enum values. */
export type PaymentRowStatus =
    | "pending"
    | "processing"
    | "distributing"
    | "completed"
    | "failed"
    | "cancelled"
    | "authorized"
    | "requires_action"

/** Shape returned by `useUserPayments` (payments + the embedded ticket). */
export interface UserPaymentRecord {
    id: string
    ticket_id: string | null
    project_id: string | null
    status: PaymentRowStatus
    currency: string
    created_at: string
    completed_at: string | null
    amount_smallest_unit: number
    authorized_amount_smallest_unit: number | null
    captured_amount_smallest_unit: number | null
    ticket: {
        id: string
        title: string
        project_id: string
        project?: { name: string } | null
        categories?: Array<{ help_category: { value: string } | null }> | null
    } | null
}

/** Customer-facing status buckets, collapsed from the raw enum. */
export type UserPaymentDisplayStatus =
    | "paid"
    | "on_hold"
    | "pending"
    | "action_required"
    | "failed"
    | "cancelled"

export interface UserPaymentRow {
    id: string
    ticketId: string | null
    /** First 7 chars of the ticket id, or "-" when the payment has no ticket. */
    ticketShortId: string
    ticketTitle: string
    projectId: string | null
    projectName: string
    /** First help category of the ticket, capitalised; "Support" when none. */
    ticketType: string
    /** ISO timestamp used for display, sorting and month grouping. */
    date: string
    amountSmallestUnit: number
    currency: string
    displayStatus: UserPaymentDisplayStatus
}

export interface UserMonthlyReportRow {
    /** Stable key, e.g. "2026-09". */
    id: string
    /** Label matching the month filter, e.g. "September 2026". */
    period: string
    periodRaw: number
    ticketCount: number
    amountSmallestUnit: number
    currency: string
}

export const USER_PAYMENT_STATUS_LABELS: Record<UserPaymentDisplayStatus, string> = {
    paid: "Paid",
    on_hold: "On hold",
    pending: "Pending",
    action_required: "Action required",
    failed: "Failed",
    cancelled: "Cancelled",
}

export function toDisplayStatus(status: PaymentRowStatus): UserPaymentDisplayStatus {
    switch (status) {
        case "completed":
        case "distributing":
            return "paid"
        case "authorized":
            return "on_hold"
        case "requires_action":
            return "action_required"
        case "failed":
            return "failed"
        case "cancelled":
            return "cancelled"
        case "pending":
        case "processing":
        default:
            return "pending"
    }
}

/**
 * The amount that matters to the customer for this row: what was actually
 * captured once the ticket is paid, otherwise the hold that is reserved on
 * their card, falling back to the row's base amount.
 */
export function userFacingAmount(record: UserPaymentRecord): number {
    const display = toDisplayStatus(record.status)
    if (display === "paid" && record.captured_amount_smallest_unit != null) {
        return record.captured_amount_smallest_unit
    }
    if (record.authorized_amount_smallest_unit != null) {
        return record.authorized_amount_smallest_unit
    }
    return record.amount_smallest_unit
}

function capitalise(value: string): string {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function toUserPaymentRow(record: UserPaymentRecord): UserPaymentRow {
    const ticket = record.ticket
    const firstCategory = ticket?.categories?.find((c) => c.help_category?.value)?.help_category?.value
    const display = toDisplayStatus(record.status)
    return {
        id: record.id,
        ticketId: ticket?.id ?? record.ticket_id,
        ticketShortId: (ticket?.id ?? record.ticket_id)?.slice(0, 7) || "-",
        ticketTitle: ticket?.title?.trim() || "Untitled ticket",
        projectId: ticket?.project_id ?? record.project_id,
        projectName: ticket?.project?.name?.trim() || "Project",
        ticketType: firstCategory ? capitalise(firstCategory) : "Support",
        date: (display === "paid" && record.completed_at) || record.created_at,
        amountSmallestUnit: userFacingAmount(record),
        currency: record.currency || "usd",
        displayStatus: display,
    }
}

/** "September 2026" — the same label the month filter dropdown uses. */
export function monthLabel(dateIso: string): string {
    return new Date(dateIso).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function monthKey(dateIso: string): string {
    const d = new Date(dateIso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Group paid rows into one line per calendar month, newest first. Only rows
 * the customer has actually been charged for count towards spending.
 */
export function aggregateMonthly(rows: UserPaymentRow[]): UserMonthlyReportRow[] {
    const grouped = new Map<string, UserMonthlyReportRow & { tickets: Set<string> }>()
    for (const row of rows) {
        if (row.displayStatus !== "paid") continue
        const key = monthKey(row.date)
        let group = grouped.get(key)
        if (!group) {
            const d = new Date(row.date)
            group = {
                id: key,
                period: monthLabel(row.date),
                periodRaw: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
                ticketCount: 0,
                amountSmallestUnit: 0,
                currency: row.currency,
                tickets: new Set<string>(),
            }
            grouped.set(key, group)
        }
        group.amountSmallestUnit += row.amountSmallestUnit
        group.tickets.add(row.ticketId ?? row.id)
        group.ticketCount = group.tickets.size
    }
    return Array.from(grouped.values())
        .map(({ tickets: _tickets, ...rest }) => rest)
        .sort((a, b) => b.periodRaw - a.periodRaw)
}
