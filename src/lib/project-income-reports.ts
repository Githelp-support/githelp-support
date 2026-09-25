/**
 * Pure helpers for the admin Reports page: what the *project* earns from
 * each ticket. Rows come from `payments` (the customer charge and its
 * platform/helper/project split) joined with the project's own
 * `payments_transfers` row, which says whether that share has actually been
 * transferred to the project's Stripe account yet.
 */
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import { monthLabel } from "@/lib/helper-payout-reports"
import { toDisplayStatus } from "@/lib/user-payment-reports"

export type ProjectIncomeStatus =
    /** Project share transferred to the project's Stripe account. */
    | "received"
    /** Charge captured; the project's share is scheduled but not transferred yet. */
    | "pending"
    /** Charge captured but the project keeps nothing (100% helper share). */
    | "no_share"
    /** Customer's card is authorised; nothing captured yet. */
    | "on_hold"
    /** Payment not yet authorised or still processing. */
    | "awaiting_payment"
    | "action_required"
    | "failed"
    | "cancelled"

export const PROJECT_INCOME_STATUS_LABELS: Record<ProjectIncomeStatus, string> = {
    received: "Received",
    pending: "Pending",
    no_share: "No project share",
    on_hold: "On hold",
    awaiting_payment: "Awaiting payment",
    action_required: "Action required",
    failed: "Failed",
    cancelled: "Cancelled",
}

export interface ProjectTicketIncomeRow {
    /** The payment row id. */
    id: string
    ticketId: string | null
    ticketShortId: string
    ticketTitle: string
    /** ISO timestamp: when captured, else when the payment was created. */
    date: string
    /** True once the customer has actually been charged. */
    captured: boolean
    /** What the customer was (or will be) charged. */
    chargedSmallestUnit: number
    platformFeeSmallestUnit: number
    helperShareSmallestUnit: number
    projectIncomeSmallestUnit: number
    currency: string
    status: ProjectIncomeStatus
    /** Stripe transfer that moved the project's share, once it exists. */
    stripeTransferId: string | null
    receiptUrl: string | null
}

/** The project's own transfer for a payment: matched on payment_id, else on ticket. */
export function projectTransferFor(payment: Payment, transfers: PaymentTransfer[]): PaymentTransfer | null {
    const own = transfers.filter((t) => t.transfer_user_type === "project")
    return (
        own.find((t) => t.payment_id && t.payment_id === payment.id) ??
        own.find((t) => !t.payment_id && !!payment.ticket_id && t.ticket_id === payment.ticket_id) ??
        null
    )
}

function incomeStatus(payment: Payment, transfer: PaymentTransfer | null, projectIncome: number): ProjectIncomeStatus {
    const display = toDisplayStatus(payment.status)
    if (display !== "paid") {
        if (display === "on_hold") return "on_hold"
        if (display === "pending") return "awaiting_payment"
        return display
    }
    if (transfer?.status === "completed") return "received"
    if (transfer?.status === "failed") return "failed"
    if (projectIncome <= 0 && !transfer) return "no_share"
    return "pending"
}

export function toProjectTicketIncomeRow(payment: Payment, transfers: PaymentTransfer[]): ProjectTicketIncomeRow {
    const transfer = projectTransferFor(payment, transfers)
    const captured = toDisplayStatus(payment.status) === "paid"
    const projectIncome = captured ? payment.amount_project_smallest_unit || 0 : 0
    return {
        id: payment.id,
        ticketId: payment.ticket_id,
        ticketShortId: payment.ticket_id?.slice(0, 7) || "-",
        ticketTitle: payment.ticket?.title?.trim() || "Untitled ticket",
        date: (captured && payment.completed_at) || payment.created_at,
        captured,
        chargedSmallestUnit: payment.captured_amount_smallest_unit ?? payment.amount_smallest_unit,
        platformFeeSmallestUnit: captured ? payment.amount_platform_smallest_unit || 0 : 0,
        helperShareSmallestUnit: captured ? payment.amount_helper_smallest_unit || 0 : 0,
        projectIncomeSmallestUnit: projectIncome,
        currency: payment.currency || "usd",
        status: incomeStatus(payment, transfer, projectIncome),
        stripeTransferId: transfer?.transfer_id || null,
        receiptUrl: payment.stripe_receipt_url || null,
    }
}

export interface ProjectIncomeMonthlyRow {
    /** Stable key, e.g. "2026-09". */
    id: string
    period: string
    periodRaw: number
    /** Distinct tickets with a captured charge in the month. */
    ticketCount: number
    chargedSmallestUnit: number
    platformFeeSmallestUnit: number
    helperShareSmallestUnit: number
    projectIncomeSmallestUnit: number
    /** Portion of `projectIncomeSmallestUnit` already transferred to the project. */
    receivedSmallestUnit: number
    currency: string
    /** True once every project share in the month has been received (or there was none). */
    allReceived: boolean
}

/**
 * One row per calendar month, newest first, built from captured charges
 * only: income the project cannot count on yet (holds, pending payments)
 * is left out so the monthly figures are bookable.
 */
export function aggregateProjectIncomeMonthly(rows: ProjectTicketIncomeRow[]): ProjectIncomeMonthlyRow[] {
    const groups = new Map<string, ProjectIncomeMonthlyRow & { tickets: Set<string>; outstanding: number }>()
    for (const row of rows) {
        if (!row.captured) continue
        const date = new Date(row.date)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        let group = groups.get(key)
        if (!group) {
            const first = new Date(date.getFullYear(), date.getMonth(), 1)
            group = {
                id: key,
                period: monthLabel(first.toISOString()),
                periodRaw: first.getTime(),
                ticketCount: 0,
                chargedSmallestUnit: 0,
                platformFeeSmallestUnit: 0,
                helperShareSmallestUnit: 0,
                projectIncomeSmallestUnit: 0,
                receivedSmallestUnit: 0,
                currency: row.currency,
                allReceived: true,
                tickets: new Set<string>(),
                outstanding: 0,
            }
            groups.set(key, group)
        }
        group.tickets.add(row.ticketId ?? row.id)
        group.ticketCount = group.tickets.size
        group.chargedSmallestUnit += row.chargedSmallestUnit
        group.platformFeeSmallestUnit += row.platformFeeSmallestUnit
        group.helperShareSmallestUnit += row.helperShareSmallestUnit
        group.projectIncomeSmallestUnit += row.projectIncomeSmallestUnit
        if (row.status === "received") group.receivedSmallestUnit += row.projectIncomeSmallestUnit
        else if (row.projectIncomeSmallestUnit > 0) group.outstanding += 1
    }
    return Array.from(groups.values())
        .map(({ tickets: _tickets, outstanding, ...rest }) => ({ ...rest, allReceived: outstanding === 0 }))
        .sort((a, b) => b.periodRaw - a.periodRaw)
}
