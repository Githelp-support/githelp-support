import { describe, expect, it } from "vitest"
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"
import { groupUserPaymentsByTicket, type UserPaymentRow } from "@/lib/user-payment-reports"
import {
    buildHelperPayoutReport,
    buildProjectPayoutReport,
    buildUserTicketReport,
    chargedAmount,
    csvCell,
    dayInPeriod,
    formatMoney,
    inPeriod,
    reportFileName,
    reportToCsv,
    sectionToCsv,
} from "./report-export"

const GENERATED = new Date(2026, 8, 24, 14, 5)

function transfer(overrides: Partial<PaymentTransfer> = {}): PaymentTransfer {
    return {
        id: "t-1",
        project_id: "proj-1",
        helper_id: "helper-1",
        ticket_id: "abcdef0-ticket",
        transfer_user_type: "helper",
        status: "completed",
        amount_smallest_unit: 1000,
        currency: "usd",
        transfer_id: "tr_1",
        created_at: "2026-08-10T12:00:00.000Z",
        completed_at: "2026-08-12T12:00:00.000Z",
        helper: { user_id: "u-1", user: { name: "Ada", username: null, email: "ada@example.com" } },
        ticket: { id: "abcdef0-ticket", title: "Login broken", categories: [{ help_category: { value: "bug" } }] },
        ...overrides,
    }
}

function payment(overrides: Partial<Payment> = {}): Payment {
    return {
        id: "p-1",
        project_id: "proj-1",
        ticket_id: "abcdef0-ticket",
        amount_smallest_unit: 5000,
        captured_amount_smallest_unit: 4200,
        currency: "usd",
        status: "completed",
        amount_platform_smallest_unit: 700,
        amount_project_smallest_unit: 1500,
        amount_helper_smallest_unit: 2000,
        transaction_id: null,
        stripe_payment_intent_id: "pi_1",
        created_at: "2026-08-10T10:00:00.000Z",
        completed_at: "2026-08-11T10:00:00.000Z",
        ...overrides,
    }
}

function entry(overrides: Partial<HelperTimeEntry> = {}): HelperTimeEntry {
    return {
        id: "e-1",
        ticket_id: "abcdef0-ticket",
        helper_id: "helper-1",
        type: "solo",
        time_milliseconds: 90 * 60000,
        date: "2026-08-11",
        created_at: "2026-08-11T12:00:00.000Z",
        ...overrides,
    }
}

describe("helpers", () => {
    it("formats money like the on-screen tables and matches months", () => {
        expect(formatMoney(1234)).toBe("USD 12.34")
        expect(formatMoney(500, "eur")).toBe("EUR 5.00")
        expect(inPeriod("2026-08-12T12:00:00.000Z", "August 2026")).toBe(true)
        expect(inPeriod("2026-08-12T12:00:00.000Z", "September 2026")).toBe(false)
        expect(inPeriod("2026-08-12T12:00:00.000Z", null)).toBe(true)
        // Calendar days are local days: the 1st and the last of a month stay in that month in every timezone.
        expect(dayInPeriod("2026-08-01", "August 2026")).toBe(true)
        expect(dayInPeriod("2026-08-31", "August 2026")).toBe(true)
        expect(dayInPeriod("2026-09-01", "August 2026")).toBe(false)
        expect(reportFileName("helper-payouts", "Acme Corp!", "All time")).toBe("githelp-helper-payouts-acme-corp-all-time")
        expect(chargedAmount(payment())).toBe(4200)
        expect(chargedAmount(payment({ captured_amount_smallest_unit: null }))).toBe(5000)
    })
})

describe("buildHelperPayoutReport", () => {
    const input = () => ({
        transfers: [
            transfer(),
            transfer({ id: "t-2", status: "pending", completed_at: null, amount_smallest_unit: 300, transfer_id: null }),
            transfer({ id: "t-3", status: "failed", completed_at: null, amount_smallest_unit: 250 }),
            transfer({ id: "t-4", created_at: "2026-09-02T12:00:00.000Z", completed_at: "2026-09-03T12:00:00.000Z", amount_smallest_unit: 800 }),
            transfer({ id: "t-5", transfer_user_type: "project", helper_id: null }),
        ],
        timeEntries: [
            entry(),
            entry({ id: "e-2", date: "2026-09-03", time_milliseconds: 30 * 60000 }),
            entry({ id: "e-3", date: "2026-08-01", time_milliseconds: 15 * 60000 }),
            entry({ id: "e-4", date: "2026-09-01", time_milliseconds: 45 * 60000 }),
        ],
        period: "August 2026",
        helper: { name: "Ada", email: "ada@example.com" },
        projectName: "Acme",
        generatedAt: GENERATED,
    })

    it("lists the helper's payouts in the period as one ticket line with its transfers underneath", () => {
        const report = buildHelperPayoutReport(input())
        expect(report.title).toBe("Helper payout report")
        expect(report.period).toBe("August 2026")
        expect(report.meta).toEqual([
            ["Helper", "Ada"],
            ["Email", "ada@example.com"],
            ["Project", "Acme"],
            ["Period", "August 2026"],
            ["Currency", "USD"],
            ["Generated", "24 September 2026, 14:05"],
        ])
        expect(report.fileName).toBe("githelp-helper-payouts-acme-august-2026")

        const [payouts, summary] = report.sections
        // Three transfers on one ticket: the ticket's total (failed transfer
        // left out of it, but flagged in the status) and each transfer below.
        expect(payouts.rows).toEqual([
            ["12/08/2026", "abcdef0", "Login broken", "Bug", "Failed", "3 transfers", "USD 13.00"],
            ["10/08/2026", "", "Transfer 1 of 3", "", "Pending", "-", "USD 3.00"],
            ["10/08/2026", "", "Transfer 2 of 3", "", "Failed", "tr_1", "USD 2.50"],
            ["12/08/2026", "", "Transfer 3 of 3", "", "Paid out", "tr_1", "USD 10.00"],
        ])
        expect(payouts.rowKinds).toEqual(["ticket", "transaction", "transaction", "transaction"])
        expect(payouts.totals).toEqual([
            ["Paid out", "USD 10.00"],
            ["Pending", "USD 3.00"],
            ["Failed (not paid)", "USD 2.50"],
            ["Total earned", "USD 13.00"],
        ])
        expect(summary.rows).toEqual([["August 2026", "1", "1h 45m", "USD 13.00", "USD 10.00"]])
        expect(summary.totals).toEqual([["Hours logged", "1h 45m"]])
    })

    it("covers all months when no period is given and allows a custom period title", () => {
        const report = buildHelperPayoutReport({ ...input(), period: null, periodTitle: "Payout tr_1" })
        expect(report.period).toBe("Payout tr_1")
        // One ticket line plus its four transfers.
        expect(report.sections[0].rows).toHaveLength(5)
        expect(report.sections[1].rows.map((r) => r[0])).toEqual(["September 2026", "August 2026"])
        expect(report.fileName).toBe("githelp-helper-payouts-acme-payout-tr-1")
    })

    it("produces empty sections with messages rather than failing", () => {
        const report = buildHelperPayoutReport({ ...input(), transfers: [], timeEntries: [] })
        expect(report.sections[0].rows).toEqual([])
        expect(report.sections[0].emptyMessage).toBe("No payouts in this period.")
        expect(report.sections[0].totals?.[0]).toEqual(["Paid out", "USD 0.00"])
    })
})

describe("buildProjectPayoutReport", () => {
    const input = () => ({
        transfers: [
            transfer(),
            transfer({ id: "t-2", transfer_user_type: "project", helper_id: null, helper: undefined, amount_smallest_unit: 1500, transfer_id: "tr_2" }),
            transfer({ id: "t-3", status: "pending", completed_at: null, amount_smallest_unit: 400, transfer_id: null, ticket_id: "other", ticket: { id: "other", title: "Slow page" } }),
        ],
        payments: [
            payment(),
            payment({ id: "p-2", status: "authorized", ticket_id: "other", captured_amount_smallest_unit: null, amount_smallest_unit: 900, completed_at: null, ticket: { id: "other", title: "Slow page" } }),
            payment({ id: "p-3", completed_at: "2026-07-01T10:00:00.000Z" }),
        ],
        period: "August 2026",
        projectName: "Acme",
        generatedAt: GENERATED,
    })

    it("summarises captured charges, helper payouts and the project's own share", () => {
        const report = buildProjectPayoutReport(input())
        expect(report.title).toBe("Project payments report")
        expect(report.fileName).toBe("githelp-project-payments-acme-august-2026")
        const [summary, charges, payouts, share] = report.sections

        expect(summary.rows).toEqual([
            ["Charged to customers (captured)", "USD 42.00"],
            ["Platform fees", "USD 7.00"],
            ["Helper share of charges", "USD 20.00"],
            ["Project share of charges", "USD 15.00"],
            ["Paid out to helpers", "USD 10.00"],
            ["Pending to helpers", "USD 4.00"],
            ["Received by project", "USD 15.00"],
            ["Pending to project", "USD 0.00"],
        ])
        expect(charges.rows).toEqual([
            ["10/08/2026", "other", "Slow page", "On hold", "pi_1", "USD 9.00", "-", "-", "-"],
            ["11/08/2026", "abcdef0", "Login broken", "Captured", "pi_1", "USD 42.00", "USD 7.00", "USD 20.00", "USD 15.00"],
        ])
        expect(payouts.rows).toEqual([
            ["10/08/2026", "other", "Slow page", "Ada", "Pending", "-", "USD 4.00"],
            ["12/08/2026", "abcdef0", "Login broken", "Ada", "Paid out", "tr_1", "USD 10.00"],
        ])
        expect(share.rows).toEqual([["12/08/2026", "abcdef0", "Login broken", "Paid out", "tr_2", "USD 15.00"]])
        // Every ticket here has a single transaction, so the plain layout is kept.
        expect(charges.rowKinds).toBeUndefined()
    })

    it("groups a ticket charged twice into one record with its charges and payouts underneath", () => {
        const report = buildProjectPayoutReport({
            transfers: [
                transfer({ id: "t-1", payment_id: "p-1", amount_smallest_unit: 2000, transfer_id: "tr_1" }),
                transfer({ id: "t-2", payment_id: "p-2", amount_smallest_unit: 600, transfer_id: "tr_2", completed_at: "2026-08-20T12:00:00.000Z" }),
            ],
            payments: [
                payment({ id: "p-1" }),
                payment({
                    id: "p-2",
                    stripe_payment_intent_id: "pi_2",
                    captured_amount_smallest_unit: 1200,
                    amount_platform_smallest_unit: 200,
                    amount_helper_smallest_unit: 600,
                    amount_project_smallest_unit: 400,
                    created_at: "2026-08-18T10:00:00.000Z",
                    completed_at: "2026-08-19T10:00:00.000Z",
                }),
            ],
            period: "August 2026",
            projectName: "Acme",
            generatedAt: GENERATED,
        })
        const [, charges, payouts] = report.sections
        expect(charges.rows).toEqual([
            ["19/08/2026", "abcdef0", "Login broken", "Captured", "2 charges", "USD 54.00", "USD 9.00", "USD 26.00", "USD 19.00"],
            ["11/08/2026", "", "Charge 1 of 2", "Captured", "pi_1", "USD 42.00", "USD 7.00", "USD 20.00", "USD 15.00"],
            ["19/08/2026", "", "Charge 2 of 2", "Captured", "pi_2", "USD 12.00", "USD 2.00", "USD 6.00", "USD 4.00"],
        ])
        expect(charges.rowKinds).toEqual(["ticket", "transaction", "transaction"])
        expect(payouts.rows).toEqual([
            ["20/08/2026", "abcdef0", "Login broken", "Ada", "Paid out", "2 transfers", "USD 26.00"],
            ["12/08/2026", "", "Transfer 1 of 2", "", "Paid out", "tr_1", "USD 20.00"],
            ["20/08/2026", "", "Transfer 2 of 2", "", "Paid out", "tr_2", "USD 6.00"],
        ])
        // Totals still add up the transactions once.
        expect(charges.totals?.[0]).toEqual(["Captured", "USD 54.00"])
    })
})

describe("buildUserTicketReport", () => {
    const row = (overrides: Partial<UserPaymentRow>): UserPaymentRow => ({
        id: "p-1",
        ticketId: "abcdef0-ticket",
        ticketShortId: "abcdef0",
        ticketTitle: "Login broken",
        projectId: "proj-1",
        projectName: "Acme",
        ticketType: "Bug",
        date: "2026-08-11T10:00:00.000Z",
        amountSmallestUnit: 4200,
        currency: "usd",
        displayStatus: "paid",
        receiptUrl: "https://pay.stripe.com/r/1",
        ...overrides,
    })

    it("reports one ticket with every transaction and the ticket's totals", () => {
        const [ticket] = groupUserPaymentsByTicket([
            row({}),
            row({ id: "p-2", date: "2026-08-05T10:00:00.000Z", amountSmallestUnit: 900, displayStatus: "failed", receiptUrl: null }),
            row({ id: "p-3", date: "2026-08-19T10:00:00.000Z", amountSmallestUnit: 1200 }),
            row({ id: "p-4", date: "2026-08-20T10:00:00.000Z", amountSmallestUnit: 3000, displayStatus: "on_hold", receiptUrl: null }),
        ])
        const report = buildUserTicketReport({ ticket, customer: { name: "Grace", email: "grace@example.com" }, generatedAt: GENERATED })
        expect(report.title).toBe("Ticket payment report")
        expect(report.period).toBe("Ticket abcdef0")
        expect(report.meta).toContainEqual(["Ticket", "abcdef0 · Login broken"])
        expect(report.meta).toContainEqual(["Transactions", "4"])
        expect(report.fileName).toBe("githelp-ticket-abcdef0-acme")
        const [transactions] = report.sections
        expect(transactions.rows).toEqual([
            ["1", "05/08/2026", "Declined charge", "Failed", "USD 9.00"],
            ["2", "11/08/2026", "Charge", "Paid", "USD 42.00"],
            ["3", "19/08/2026", "Charge", "Paid", "USD 12.00"],
            ["4", "20/08/2026", "Card hold", "On hold", "USD 30.00"],
        ])
        expect(transactions.totals).toEqual([
            ["Paid", "USD 54.00"],
            ["Held, not charged yet", "USD 30.00"],
            ["Declined (not charged)", "USD 9.00"],
            ["Ticket total", "USD 84.00"],
        ])
        expect(transactions.note).toMatch(/more than one transaction/)
    })
})

describe("CSV", () => {
    it("adds a Line column to grouped sections so ticket totals can be summed on their own", () => {
        const csv = sectionToCsv({
            heading: "Payouts",
            columns: [{ label: "Ticket" }, { label: "Amount" }],
            rows: [
                ["abcdef0", "USD 13.00"],
                ["", "USD 3.00"],
                ["", "USD 10.00"],
            ],
            rowKinds: ["ticket", "transaction", "transaction"],
        })
        expect(csv).toBe("Line,Ticket,Amount\r\nTicket,abcdef0,USD 13.00\r\nTransaction,,USD 3.00\r\nTransaction,,USD 10.00")
    })

    it("neutralises cells a spreadsheet would run as a formula", () => {
        expect(csvCell('=HYPERLINK("http://evil")')).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"")
        expect(csvCell("+1")).toBe("'+1")
        expect(csvCell("-2+3")).toBe("'-2+3")
        expect(csvCell("@cmd")).toBe("'@cmd")
        expect(csvCell("USD -2.50")).toBe("USD -2.50")
        expect(csvCell("12/08/2026")).toBe("12/08/2026")
    })

    it("quotes cells that need it and separates sections", () => {
        const section = {
            heading: "Payouts",
            columns: [{ label: "Date" }, { label: "Description" }, { label: "Amount", align: "right" as const }],
            rows: [["12/08/2026", 'Fix "login", again', "USD 10.00"]],
            totals: [["Paid out", "USD 10.00"] as [string, string]],
        }
        expect(sectionToCsv(section)).toBe(
            'Date,Description,Amount\r\n12/08/2026,"Fix ""login"", again",USD 10.00\r\nPaid out,USD 10.00',
        )
        const csv = reportToCsv({
            title: "Helper payout report",
            period: "August 2026",
            meta: [["Helper", "Ada"]],
            sections: [section],
            footerNote: "n/a",
            fileName: "x",
        })
        expect(csv).toBe(
            "Helper payout report,August 2026\r\nHelper,Ada\r\n\r\nPayouts\r\nDate,Description,Amount\r\n12/08/2026,\"Fix \"\"login\"\", again\",USD 10.00\r\nPaid out,USD 10.00\r\n",
        )
    })
})
