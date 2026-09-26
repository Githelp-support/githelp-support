/**
 * Accounting exports for the Reports pages: pure builders that turn payout
 * and payment rows into a `ReportDocument`, plus a CSV serialiser. The PDF
 * renderer lives in `report-pdf.ts` (browser only); everything here is
 * side-effect free so it can be unit-tested.
 *
 * Why not Stripe? Helpers and projects are paid by Stripe Connect transfers
 * to Standard accounts. Stripe's own exports know the transfer amounts but
 * nothing about tickets, helpers or the platform/project/helper split, and
 * ticket charges are plain PaymentIntents, so Stripe issues no invoice or
 * statement PDFs for them. The platform's records are the only source that
 * has the whole picture, hence these documents.
 */
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"
import {
    aggregateHelperMonthly,
    formatMinutes,
    groupTransfersByTicket,
    monthLabel,
    parseCalendarDay,
    transferDate,
    transferTicketType,
} from "@/lib/helper-payout-reports"
import { groupByTicket, sortByDateAsc, sumOf, transactionCountLabel } from "@/lib/ticket-groups"
import {
    USER_PAYMENT_STATUS_LABELS,
    USER_TRANSACTION_DESCRIPTIONS,
    type UserPaymentRow,
    type UserTicketPaymentGroup,
} from "@/lib/user-payment-reports"

export interface ReportColumn {
    label: string
    align?: "left" | "right"
}

/**
 * `ticket`: one line per ticket (its only transaction, or the totals of
 * several). `transaction`: one of a ticket's transactions, printed indented
 * under its ticket line and not to be added to the totals again.
 */
export type ReportRowKind = "ticket" | "transaction"

export interface ReportSection {
    heading: string
    /** Short explanation printed under the heading. */
    note?: string
    columns: ReportColumn[]
    rows: string[][]
    /** Parallel to `rows`; omitted when every row is a plain line. */
    rowKinds?: ReportRowKind[]
    /** Label/value pairs printed under the table, e.g. ["Paid out", "USD 120.00"]. */
    totals?: Array<[string, string]>
    emptyMessage?: string
}

export interface ReportDocument {
    title: string
    /** "September 2026", "All time", or a custom label such as a single payout reference. */
    period: string
    /** Label/value pairs printed under the title (who the report is for, when it was generated). */
    meta: Array<[string, string]>
    sections: ReportSection[]
    footerNote: string
    /** Base file name without extension. */
    fileName: string
}

const ALL_TIME = "All time"

/** Same output as `formatAmount` in `usePayments`, kept here so this module stays free of the Supabase client. */
export function formatMoney(smallestUnit: number, currency: string = "usd"): string {
    const code = currency ? currency.toUpperCase() : "USD"
    return `${code} ${(smallestUnit / 100).toFixed(2)}`
}

/** dd/mm/yyyy, matching the on-screen tables. */
export function formatReportDate(iso: string): string {
    const date = new Date(iso)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${day}/${month}/${date.getFullYear()}`
}

/** "24 September 2026, 14:05" for the generated-at stamp. */
export function formatGeneratedAt(date: Date): string {
    const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    return `${day}, ${time}`
}

/** True when `iso` falls in the month named by `period` ("September 2026"); a null period matches everything. */
export function inPeriod(iso: string, period: string | null): boolean {
    return !period || monthLabel(iso) === period
}

/** Same as `inPeriod` for a `YYYY-MM-DD` calendar day, read as a local day so the 1st never slips into the previous month. */
export function dayInPeriod(day: string, period: string | null): boolean {
    return !period || monthLabel(parseCalendarDay(day).toISOString()) === period
}

export function periodLabel(period: string | null): string {
    return period ?? ALL_TIME
}

function slug(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "report"
    )
}

export function reportFileName(...parts: string[]): string {
    return ["githelp", ...parts.map(slug)].join("-")
}

function shortId(id: string | null | undefined): string {
    return id ? id.slice(0, 7) : "-"
}

const TRANSFER_STATUS: Record<PaymentTransfer["status"], string> = {
    completed: "Paid out",
    pending: "Pending",
    failed: "Failed",
}

const PAYMENT_STATUS: Record<string, string> = {
    completed: "Captured",
    distributing: "Captured",
    authorized: "On hold",
    requires_action: "Action required",
    processing: "Processing",
    pending: "Pending",
    failed: "Failed",
    cancelled: "Cancelled",
}

/** Only these payment statuses represent money the customer has actually been charged. */
const CAPTURED_STATUSES = new Set(["completed", "distributing"])

/** Charges still in flight; one of these decides a multi-charge ticket's status. */
const OPEN_PAYMENT_STATUSES = new Set(["requires_action", "authorized", "processing", "pending"])

/**
 * Totals line for a ticket paid out in several transfers. `middle` fills the
 * columns between description and status (type, helper, or nothing).
 */
function transferTicketLine(
    items: PaymentTransfer[],
    currency: string,
    middle: (first: PaymentTransfer) => string[],
    titleOf?: (ticketId: string | null) => string,
): string[] {
    const first = items[0]
    const ticketId = first.ticket?.id ?? first.ticket_id
    const failed = items.filter((t) => t.status === "failed")
    const counting = items.filter((t) => t.status !== "failed")
    const status = failed.length > 0 ? "failed" : items.some((t) => t.status === "pending") ? "pending" : "completed"
    return [
        formatReportDate(latestDate(items, transferDate)),
        shortId(ticketId),
        titleOf ? titleOf(ticketId) : first.ticket?.title?.trim() || "Untitled ticket",
        ...middle(first),
        TRANSFER_STATUS[status],
        transactionCountLabel(items.length, "transfer"),
        formatMoney(sumOf(counting.length > 0 ? counting : items, (t) => t.amount_smallest_unit), first.currency || currency),
    ]
}

/** One transfer under its ticket line; `blanks` pads the type/helper columns. */
function transferTransactionLine(t: PaymentTransfer, index: number, count: number, currency: string, blanks: number): string[] {
    return [
        formatReportDate(transferDate(t)),
        "",
        `Transfer ${index + 1} of ${count}`,
        ...Array.from({ length: blanks }, () => ""),
        TRANSFER_STATUS[t.status] ?? t.status,
        t.transfer_id || "-",
        formatMoney(t.amount_smallest_unit, t.currency || currency),
    ]
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0)
}

function byDateAsc<T>(date: (item: T) => string) {
    return (a: T, b: T) => new Date(date(a)).getTime() - new Date(date(b)).getTime()
}

function currencyOf(transfers: Array<{ currency: string }>, fallback = "usd"): string {
    return transfers.find((t) => t.currency)?.currency || fallback
}

interface GroupedRows {
    rows: string[][]
    rowKinds?: ReportRowKind[]
}

/**
 * Rows for records grouped per ticket. A ticket with one transaction stays
 * a single line (`single`); with several it gets a totals line (`ticket`)
 * followed by one line per transaction (`transaction`), oldest first.
 * `rowKinds` is only returned when some ticket has several transactions,
 * so documents without any keep their plain layout.
 */
function groupedRows<T>(
    groups: Array<{ items: T[] }>,
    single: (item: T) => string[],
    ticket: (items: T[]) => string[],
    transaction: (item: T, index: number, count: number) => string[],
): GroupedRows {
    const rows: string[][] = []
    const kinds: ReportRowKind[] = []
    for (const { items } of groups) {
        if (items.length === 1) {
            rows.push(single(items[0]))
            kinds.push("ticket")
            continue
        }
        rows.push(ticket(items))
        kinds.push("ticket")
        items.forEach((item, index) => {
            rows.push(transaction(item, index, items.length))
            kinds.push("transaction")
        })
    }
    return kinds.includes("transaction") ? { rows, rowKinds: kinds } : { rows }
}

/** Groups oldest ticket first (by each ticket's first record), records oldest first inside each. */
function chronologicalGroups<T>(groups: Array<{ items: T[] }>, dateOf: (item: T) => string) {
    return groups
        .map((group) => ({ ...group, items: sortByDateAsc(group.items, dateOf) }))
        .sort((a, b) => new Date(dateOf(a.items[0])).getTime() - new Date(dateOf(b.items[0])).getTime())
}

function latestDate<T>(items: T[], dateOf: (item: T) => string): string {
    const dates = items.map(dateOf).sort()
    return dates[dates.length - 1] ?? ""
}

function helperName(transfer: PaymentTransfer): string {
    const user = transfer.helper?.user
    return user?.name?.trim() || user?.username?.trim() || user?.email?.trim() || "Unknown"
}

export interface HelperPayoutReportInput {
    transfers: PaymentTransfer[]
    timeEntries: HelperTimeEntry[]
    /** Month label to restrict to, or null for everything. */
    period: string | null
    /** Overrides the period shown in the document, e.g. for a single-payout export. */
    periodTitle?: string
    helper: { name: string; email?: string | null }
    projectName: string
    generatedAt?: Date
}

/**
 * The helper's earnings report for one project: every payout row in the
 * period (failed ones included, marked as such) and a per-month summary
 * with hours logged. Amounts are the helper's share only.
 */
export function buildHelperPayoutReport(input: HelperPayoutReportInput): ReportDocument {
    const generatedAt = input.generatedAt ?? new Date()
    const transfers = input.transfers
        .filter((t) => t.transfer_user_type === "helper" && inPeriod(transferDate(t), input.period))
        .sort(byDateAsc(transferDate))
    const entries = input.timeEntries.filter((e) => dayInPeriod(e.date, input.period))
    const currency = currencyOf(transfers)

    const paidOut = sumBy(transfers.filter((t) => t.status === "completed"), (t) => t.amount_smallest_unit)
    const pending = sumBy(transfers.filter((t) => t.status === "pending"), (t) => t.amount_smallest_unit)
    const failed = sumBy(transfers.filter((t) => t.status === "failed"), (t) => t.amount_smallest_unit)

    const payoutLine = (t: PaymentTransfer) => [
        formatReportDate(transferDate(t)),
        shortId(t.ticket?.id ?? t.ticket_id),
        t.ticket?.title?.trim() || "Untitled ticket",
        transferTicketType(t),
        TRANSFER_STATUS[t.status] ?? t.status,
        t.transfer_id || "-",
        formatMoney(t.amount_smallest_unit, t.currency || currency),
    ]
    const payoutRows = groupedRows(
        chronologicalGroups(groupTransfersByTicket(transfers), transferDate),
        payoutLine,
        (items) => transferTicketLine(items, currency, (t) => [transferTicketType(t)]),
        (t, index, count) => transferTransactionLine(t, index, count, currency, 1),
    )

    const payouts: ReportSection = {
        heading: "Payouts",
        note: "One line per ticket. A ticket paid out in more than one transfer shows its total first, with each transfer listed underneath.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Type" },
            { label: "Status" },
            { label: "Stripe transfer" },
            { label: "Amount", align: "right" },
        ],
        ...payoutRows,
        totals: [
            ["Paid out", formatMoney(paidOut, currency)],
            ["Pending", formatMoney(pending, currency)],
            ...(failed > 0 ? [["Failed (not paid)", formatMoney(failed, currency)] as [string, string]] : []),
            ["Total earned", formatMoney(paidOut + pending, currency)],
        ],
        emptyMessage: "No payouts in this period.",
    }

    const monthly = aggregateHelperMonthly(transfers, entries)
    const summary: ReportSection = {
        heading: "Monthly summary",
        columns: [
            { label: "Month" },
            { label: "Tickets", align: "right" },
            { label: "Hours logged", align: "right" },
            { label: "Earned", align: "right" },
            { label: "Paid out", align: "right" },
        ],
        rows: monthly.map((m) => [
            m.period,
            String(m.ticketsClosed),
            formatMinutes(m.minutesLogged),
            formatMoney(m.earningsSmallestUnit, m.currency),
            formatMoney(m.paidOutSmallestUnit, m.currency),
        ]),
        totals: [["Hours logged", formatMinutes(sumBy(monthly, (m) => m.minutesLogged))]],
        emptyMessage: "Nothing logged in this period.",
    }

    const period = input.periodTitle ?? periodLabel(input.period)
    return {
        title: "Helper payout report",
        period,
        meta: [
            ["Helper", input.helper.name],
            ...(input.helper.email ? [["Email", input.helper.email] as [string, string]] : []),
            ["Project", input.projectName],
            ["Period", period],
            ["Currency", currency.toUpperCase()],
            ["Generated", formatGeneratedAt(generatedAt)],
        ],
        sections: [payouts, summary],
        footerNote:
            "Amounts are the helper's share of ticket payments, transferred by Githelp via Stripe Connect. Stripe pays the balance out to your bank according to your payout schedule; see your Stripe dashboard for bank payouts. This report is issued for your records and is not a tax invoice.",
        fileName: reportFileName("helper-payouts", input.projectName, period),
    }
}

export interface ProjectPayoutReportInput {
    transfers: PaymentTransfer[]
    payments: Payment[]
    period: string | null
    periodTitle?: string
    projectName: string
    generatedAt?: Date
}

/** What the customer was actually charged for a payment row. */
export function chargedAmount(payment: Payment): number {
    return payment.captured_amount_smallest_unit ?? payment.amount_smallest_unit
}

/**
 * The project's accounting report: customer charges with their
 * platform/helper/project split, the payouts made to helpers, and the
 * project's own share, all for the same period.
 */
export function buildProjectPayoutReport(input: ProjectPayoutReportInput): ReportDocument {
    const generatedAt = input.generatedAt ?? new Date()
    const paymentDate = (p: Payment) => p.completed_at || p.created_at
    const payments = input.payments.filter((p) => inPeriod(paymentDate(p), input.period)).sort(byDateAsc(paymentDate))
    const transfers = input.transfers.filter((t) => inPeriod(transferDate(t), input.period)).sort(byDateAsc(transferDate))
    const helperTransfers = transfers.filter((t) => t.transfer_user_type === "helper")
    const projectTransfers = transfers.filter((t) => t.transfer_user_type === "project")
    const currency = currencyOf(payments, currencyOf(transfers))

    // Ticket titles come with the transfer embeds; fall back to the payment's own embed.
    const titles = new Map<string, string>()
    for (const t of transfers) if (t.ticket?.id && t.ticket.title) titles.set(t.ticket.id, t.ticket.title.trim())
    for (const p of payments) if (p.ticket?.id && p.ticket.title) titles.set(p.ticket.id, p.ticket.title.trim())
    const titleOf = (ticketId: string | null) => (ticketId && titles.get(ticketId)) || "Untitled ticket"

    const captured = payments.filter((p) => CAPTURED_STATUSES.has(p.status))
    const gross = sumBy(captured, chargedAmount)
    const platformFees = sumBy(captured, (p) => p.amount_platform_smallest_unit || 0)
    const helperShare = sumBy(captured, (p) => p.amount_helper_smallest_unit || 0)
    const projectShare = sumBy(captured, (p) => p.amount_project_smallest_unit || 0)
    const paidToHelpers = sumBy(helperTransfers.filter((t) => t.status === "completed"), (t) => t.amount_smallest_unit)
    const pendingToHelpers = sumBy(helperTransfers.filter((t) => t.status === "pending"), (t) => t.amount_smallest_unit)
    const projectReceived = sumBy(projectTransfers.filter((t) => t.status === "completed"), (t) => t.amount_smallest_unit)
    const projectPending = sumBy(projectTransfers.filter((t) => t.status === "pending"), (t) => t.amount_smallest_unit)

    const summary: ReportSection = {
        heading: "Summary",
        columns: [{ label: "Item" }, { label: "Amount", align: "right" }],
        rows: [
            ["Charged to customers (captured)", formatMoney(gross, currency)],
            ["Platform fees", formatMoney(platformFees, currency)],
            ["Helper share of charges", formatMoney(helperShare, currency)],
            ["Project share of charges", formatMoney(projectShare, currency)],
            ["Paid out to helpers", formatMoney(paidToHelpers, currency)],
            ["Pending to helpers", formatMoney(pendingToHelpers, currency)],
            ["Received by project", formatMoney(projectReceived, currency)],
            ["Pending to project", formatMoney(projectPending, currency)],
        ],
    }

    const chargeLine = (p: Payment, date: string, ticketCell: string, description: string, reference: string) => {
        const isCaptured = CAPTURED_STATUSES.has(p.status)
        const money = (value: number | null | undefined) => (isCaptured ? formatMoney(value || 0, p.currency || currency) : "-")
        return [
            date,
            ticketCell,
            description,
            PAYMENT_STATUS[p.status] ?? p.status,
            reference,
            formatMoney(chargedAmount(p), p.currency || currency),
            money(p.amount_platform_smallest_unit),
            money(p.amount_helper_smallest_unit),
            money(p.amount_project_smallest_unit),
        ]
    }
    const chargeRows = groupedRows(
        chronologicalGroups(
            groupByTicket(payments, (p) => p.ticket_id, (p) => p.id),
            paymentDate,
        ),
        (p) => chargeLine(p, formatReportDate(paymentDate(p)), shortId(p.ticket_id), titleOf(p.ticket_id), p.stripe_payment_intent_id || p.transaction_id || "-"),
        (items) => {
            const first = items[0]
            const capturedItems = items.filter((p) => CAPTURED_STATUSES.has(p.status))
            const open = items.find((p) => OPEN_PAYMENT_STATUSES.has(p.status))
            const cur = first.currency || currency
            const split = (pick: (p: Payment) => number | null | undefined) =>
                capturedItems.length > 0 ? formatMoney(sumOf(capturedItems, (p) => pick(p) || 0), cur) : "-"
            const amount =
                capturedItems.length > 0
                    ? sumOf(capturedItems, chargedAmount)
                    : chargedAmount(items[items.length - 1])
            return [
                formatReportDate(latestDate(items, paymentDate)),
                shortId(first.ticket_id),
                titleOf(first.ticket_id),
                open ? PAYMENT_STATUS[open.status] ?? open.status : capturedItems.length > 0 ? "Captured" : PAYMENT_STATUS[items[items.length - 1].status] ?? "-",
                transactionCountLabel(items.length, "charge"),
                formatMoney(amount, cur),
                split((p) => p.amount_platform_smallest_unit),
                split((p) => p.amount_helper_smallest_unit),
                split((p) => p.amount_project_smallest_unit),
            ]
        },
        (p, index, count) =>
            chargeLine(p, formatReportDate(paymentDate(p)), "", `Charge ${index + 1} of ${count}`, p.stripe_payment_intent_id || p.transaction_id || "-"),
    )

    const charges: ReportSection = {
        heading: "Customer payments",
        note: "Ticket charges for this project, one line per ticket; a ticket charged in more than one transaction shows its captured total first, with each charge underneath. Only captured payments count towards the totals; the split is shown for captured payments only.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Status" },
            { label: "Stripe payment" },
            { label: "Amount", align: "right" },
            { label: "Platform fee", align: "right" },
            { label: "Helper share", align: "right" },
            { label: "Project share", align: "right" },
        ],
        ...chargeRows,
        totals: [
            ["Captured", formatMoney(gross, currency)],
            ["Platform fees", formatMoney(platformFees, currency)],
        ],
        emptyMessage: "No customer payments in this period.",
    }

    const helperPayoutRows = groupedRows(
        chronologicalGroups(groupTransfersByTicket(helperTransfers, { byHelper: true }), transferDate),
        (t) => [
            formatReportDate(transferDate(t)),
            shortId(t.ticket?.id ?? t.ticket_id),
            titleOf(t.ticket?.id ?? t.ticket_id),
            helperName(t),
            TRANSFER_STATUS[t.status] ?? t.status,
            t.transfer_id || "-",
            formatMoney(t.amount_smallest_unit, t.currency || currency),
        ],
        (items) => transferTicketLine(items, currency, (t) => [helperName(t)], titleOf),
        (t, index, count) => transferTransactionLine(t, index, count, currency, 1),
    )
    const shareRows = groupedRows(
        chronologicalGroups(groupTransfersByTicket(projectTransfers), transferDate),
        (t) => [
            formatReportDate(transferDate(t)),
            shortId(t.ticket?.id ?? t.ticket_id),
            titleOf(t.ticket?.id ?? t.ticket_id),
            TRANSFER_STATUS[t.status] ?? t.status,
            t.transfer_id || "-",
            formatMoney(t.amount_smallest_unit, t.currency || currency),
        ],
        (items) => transferTicketLine(items, currency, () => [], titleOf),
        (t, index, count) => transferTransactionLine(t, index, count, currency, 0),
    )

    const payouts: ReportSection = {
        heading: "Helper payouts",
        note: "Transfers from Githelp to each helper's connected Stripe account, one line per ticket and helper.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Helper" },
            { label: "Status" },
            { label: "Stripe transfer" },
            { label: "Amount", align: "right" },
        ],
        ...helperPayoutRows,
        totals: [
            ["Paid out", formatMoney(paidToHelpers, currency)],
            ["Pending", formatMoney(pendingToHelpers, currency)],
        ],
        emptyMessage: "No helper payouts in this period.",
    }

    const share: ReportSection = {
        heading: "Project share",
        note: "The project's own cut of each charge, transferred to the project's connected Stripe account.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Status" },
            { label: "Stripe transfer" },
            { label: "Amount", align: "right" },
        ],
        ...shareRows,
        totals: [
            ["Received", formatMoney(projectReceived, currency)],
            ["Pending", formatMoney(projectPending, currency)],
        ],
        emptyMessage: "No project share transfers in this period.",
    }

    const period = input.periodTitle ?? periodLabel(input.period)
    return {
        title: "Project payments report",
        period,
        meta: [
            ["Project", input.projectName],
            ["Period", period],
            ["Currency", currency.toUpperCase()],
            ["Generated", formatGeneratedAt(generatedAt)],
        ],
        sections: [summary, charges, payouts, share],
        footerNote:
            "Customer charges are collected by Githelp through Stripe; helper and project shares are transferred via Stripe Connect. Stripe's processing fees are included in the platform fee. A ticket charged in more than one transaction (hold capture plus overage, weekly captures on long tickets, or a retry after a decline) incurs Stripe's fee on each transaction; each fee is deducted from its own charge before the split. This report is issued for the project's records and is not a tax invoice.",
        fileName: reportFileName("project-payments", input.projectName, period),
    }
}

/**
 * One CSV cell. Besides RFC 4180 quoting, cells that a spreadsheet would
 * read as a formula (leading `=`, `+`, `-`, `@`, tab or CR) get a leading
 * apostrophe: ticket titles are customer-controlled and must never execute
 * when an admin opens the export in Excel or LibreOffice.
 */
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * RFC 4180 CSV (CRLF line endings) of one section: header row, data rows,
 * then totals as label/value rows. Sections with per-ticket groups get a
 * leading "Line" column ("Ticket" / "Transaction") so a spreadsheet can
 * filter on ticket lines and sum them without counting transactions twice.
 */
export function sectionToCsv(section: ReportSection): string {
    const kinds = section.rowKinds
    const lead = (index: number) => (kinds ? [kinds[index] === "transaction" ? "Transaction" : "Ticket"] : [])
    const lines: string[] = [[...(kinds ? ["Line"] : []), ...section.columns.map((c) => c.label)].map(csvCell).join(",")]
    section.rows.forEach((row, index) => lines.push([...lead(index), ...row].map(csvCell).join(",")))
    for (const [label, value] of section.totals ?? []) lines.push([csvCell(label), csvCell(value)].join(","))
    return lines.join("\r\n")
}

/**
 * Whole document as one CSV: a title block, then each section preceded by
 * its heading and separated by a blank line. Spreadsheet apps open it as a
 * single sheet with clearly delimited blocks.
 */
export function reportToCsv(document: ReportDocument): string {
    const blocks: string[] = [
        [
            [csvCell(document.title), csvCell(document.period)].join(","),
            ...document.meta.map(([label, value]) => [csvCell(label), csvCell(value)].join(",")),
        ].join("\r\n"),
    ]
    for (const section of document.sections) {
        blocks.push([csvCell(section.heading), sectionToCsv(section)].join("\r\n"))
    }
    return blocks.join("\r\n\r\n") + "\r\n"
}

export interface UserTicketReportInput {
    ticket: UserTicketPaymentGroup
    customer: { name: string; email?: string | null }
    generatedAt?: Date
}

/**
 * The customer's report for one ticket: every transaction behind it (hold
 * captures, overage, weekly captures, retried charges) with the ticket's
 * totals, so a ticket charged more than once reads as one support case.
 */
export function buildUserTicketReport(input: UserTicketReportInput): ReportDocument {
    const generatedAt = input.generatedAt ?? new Date()
    const { ticket } = input
    const currency = ticket.currency || "usd"
    const transactions: UserPaymentRow[] = ticket.transactions
    const failed = sumOf(transactions.filter((t) => t.displayStatus === "failed"), (t) => t.amountSmallestUnit)

    const section: ReportSection = {
        heading: "Transactions",
        note:
            transactions.length > 1
                ? "This ticket was charged in more than one transaction, e.g. a card hold captured at the end plus extra time, weekly captures on a long ticket, or a charge retried after a decline."
                : undefined,
        columns: [
            { label: "#" },
            { label: "Date" },
            { label: "Description" },
            { label: "Status" },
            { label: "Amount", align: "right" },
        ],
        rows: transactions.map((t, index) => [
            String(index + 1),
            formatReportDate(t.date),
            USER_TRANSACTION_DESCRIPTIONS[t.displayStatus],
            USER_PAYMENT_STATUS_LABELS[t.displayStatus],
            formatMoney(t.amountSmallestUnit, t.currency || currency),
        ]),
        totals: [
            ["Paid", formatMoney(ticket.paidSmallestUnit, currency)],
            ...(ticket.openSmallestUnit > 0
                ? [["Held, not charged yet", formatMoney(ticket.openSmallestUnit, currency)] as [string, string]]
                : []),
            ...(failed > 0 ? [["Declined (not charged)", formatMoney(failed, currency)] as [string, string]] : []),
            ["Ticket total", formatMoney(ticket.paidSmallestUnit + ticket.openSmallestUnit, currency)],
        ],
        emptyMessage: "No transactions for this ticket.",
    }

    const period = `Ticket ${ticket.ticketShortId}`
    return {
        title: "Ticket payment report",
        period,
        meta: [
            ["Ticket", `${ticket.ticketShortId} · ${ticket.ticketTitle}`],
            ["Project", ticket.projectName],
            ["Type", ticket.ticketType],
            ["Customer", input.customer.name],
            ...(input.customer.email ? [["Email", input.customer.email] as [string, string]] : []),
            ["Transactions", String(transactions.length)],
            ["Currency", currency.toUpperCase()],
            ["Generated", formatGeneratedAt(generatedAt)],
        ],
        sections: [section],
        footerNote:
            "Charges are collected by Githelp through Stripe. Card holds reserve an amount on your card and are released or captured when the ticket ends; only captured charges are billed. Stripe's receipt for each charge is available from the Reports page. This report is issued for your records and is not a tax invoice.",
        fileName: reportFileName("ticket", ticket.ticketShortId, ticket.projectName),
    }
}
