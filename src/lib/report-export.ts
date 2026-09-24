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
    monthLabel,
    parseCalendarDay,
    transferDate,
    transferTicketType,
} from "@/lib/helper-payout-reports"

export interface ReportColumn {
    label: string
    align?: "left" | "right"
}

export interface ReportSection {
    heading: string
    /** Short explanation printed under the heading. */
    note?: string
    columns: ReportColumn[]
    rows: string[][]
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

function sumBy<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0)
}

function byDateAsc<T>(date: (item: T) => string) {
    return (a: T, b: T) => new Date(date(a)).getTime() - new Date(date(b)).getTime()
}

function currencyOf(transfers: Array<{ currency: string }>, fallback = "usd"): string {
    return transfers.find((t) => t.currency)?.currency || fallback
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

    const payouts: ReportSection = {
        heading: "Payouts",
        note: "One line per payout transferred (or scheduled) to your connected Stripe account.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Type" },
            { label: "Status" },
            { label: "Stripe transfer" },
            { label: "Amount", align: "right" },
        ],
        rows: transfers.map((t) => [
            formatReportDate(transferDate(t)),
            shortId(t.ticket?.id ?? t.ticket_id),
            t.ticket?.title?.trim() || "Untitled ticket",
            transferTicketType(t),
            TRANSFER_STATUS[t.status] ?? t.status,
            t.transfer_id || "-",
            formatMoney(t.amount_smallest_unit, t.currency || currency),
        ]),
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

    const charges: ReportSection = {
        heading: "Customer payments",
        note: "Ticket charges for this project. Only captured payments count towards the totals; the split is shown for captured payments only.",
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
        rows: payments.map((p) => {
            const isCaptured = CAPTURED_STATUSES.has(p.status)
            const money = (value: number | null | undefined) => (isCaptured ? formatMoney(value || 0, p.currency || currency) : "-")
            return [
                formatReportDate(paymentDate(p)),
                shortId(p.ticket_id),
                titleOf(p.ticket_id),
                PAYMENT_STATUS[p.status] ?? p.status,
                p.stripe_payment_intent_id || p.transaction_id || "-",
                formatMoney(chargedAmount(p), p.currency || currency),
                money(p.amount_platform_smallest_unit),
                money(p.amount_helper_smallest_unit),
                money(p.amount_project_smallest_unit),
            ]
        }),
        totals: [
            ["Captured", formatMoney(gross, currency)],
            ["Platform fees", formatMoney(platformFees, currency)],
        ],
        emptyMessage: "No customer payments in this period.",
    }

    const payouts: ReportSection = {
        heading: "Helper payouts",
        note: "Transfers from Githelp to each helper's connected Stripe account.",
        columns: [
            { label: "Date" },
            { label: "Ticket" },
            { label: "Description" },
            { label: "Helper" },
            { label: "Status" },
            { label: "Stripe transfer" },
            { label: "Amount", align: "right" },
        ],
        rows: helperTransfers.map((t) => [
            formatReportDate(transferDate(t)),
            shortId(t.ticket?.id ?? t.ticket_id),
            titleOf(t.ticket?.id ?? t.ticket_id),
            helperName(t),
            TRANSFER_STATUS[t.status] ?? t.status,
            t.transfer_id || "-",
            formatMoney(t.amount_smallest_unit, t.currency || currency),
        ]),
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
        rows: projectTransfers.map((t) => [
            formatReportDate(transferDate(t)),
            shortId(t.ticket?.id ?? t.ticket_id),
            titleOf(t.ticket?.id ?? t.ticket_id),
            TRANSFER_STATUS[t.status] ?? t.status,
            t.transfer_id || "-",
            formatMoney(t.amount_smallest_unit, t.currency || currency),
        ]),
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
            "Customer charges are collected by Githelp through Stripe; helper and project shares are transferred via Stripe Connect. Stripe's processing fees are included in the platform fee. This report is issued for the project's records and is not a tax invoice.",
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

/** RFC 4180 CSV (CRLF line endings) of one section: header row, data rows, then totals as label/value rows. */
export function sectionToCsv(section: ReportSection): string {
    const lines: string[] = [section.columns.map((c) => csvCell(c.label)).join(",")]
    for (const row of section.rows) lines.push(row.map(csvCell).join(","))
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
