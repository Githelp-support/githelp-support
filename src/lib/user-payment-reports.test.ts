import { describe, expect, it } from "vitest"
import {
    aggregateMonthly,
    groupUserPaymentsByTicket,
    summarizeUserPaymentStatus,
    toDisplayStatus,
    toUserPaymentRow,
    userFacingAmount,
    type UserPaymentRecord,
    type UserPaymentRow,
} from "./user-payment-reports"

function record(overrides: Partial<UserPaymentRecord> = {}): UserPaymentRecord {
    return {
        id: "pay-1",
        ticket_id: "abcdef0-1234",
        project_id: "proj-1",
        status: "completed",
        currency: "usd",
        created_at: "2026-09-02T10:00:00.000Z",
        completed_at: "2026-09-03T10:00:00.000Z",
        amount_smallest_unit: 5000,
        authorized_amount_smallest_unit: 6000,
        captured_amount_smallest_unit: 4200,
        ticket: {
            id: "abcdef0-1234",
            title: "  Login broken  ",
            project_id: "proj-1",
            project: { name: "Acme" },
            categories: [{ help_category: null }, { help_category: { value: "bug" } }],
        },
        ...overrides,
    }
}

describe("toDisplayStatus", () => {
    it("collapses the payment_status enum into customer-facing buckets", () => {
        expect(toDisplayStatus("completed")).toBe("paid")
        expect(toDisplayStatus("distributing")).toBe("paid")
        expect(toDisplayStatus("authorized")).toBe("on_hold")
        expect(toDisplayStatus("requires_action")).toBe("action_required")
        expect(toDisplayStatus("processing")).toBe("pending")
        expect(toDisplayStatus("pending")).toBe("pending")
        expect(toDisplayStatus("failed")).toBe("failed")
        expect(toDisplayStatus("cancelled")).toBe("cancelled")
    })
})

describe("userFacingAmount", () => {
    it("uses the captured amount once paid", () => {
        expect(userFacingAmount(record())).toBe(4200)
    })

    it("falls back to the hold, then the base amount, while not yet captured", () => {
        expect(userFacingAmount(record({ status: "authorized" }))).toBe(6000)
        expect(
            userFacingAmount(record({ status: "pending", authorized_amount_smallest_unit: null })),
        ).toBe(5000)
    })
})

describe("toUserPaymentRow", () => {
    it("maps ticket details, first category and paid date", () => {
        const row = toUserPaymentRow(record())
        expect(row.ticketShortId).toBe("abcdef0")
        expect(row.ticketTitle).toBe("Login broken")
        expect(row.projectName).toBe("Acme")
        expect(row.ticketType).toBe("Bug")
        expect(row.date).toBe("2026-09-03T10:00:00.000Z")
        expect(row.displayStatus).toBe("paid")
    })

    it("exposes the Stripe receipt link only once the backend has stored one", () => {
        expect(toUserPaymentRow(record()).receiptUrl).toBeNull()
        expect(toUserPaymentRow(record({ stripe_receipt_url: "" })).receiptUrl).toBeNull()
        expect(
            toUserPaymentRow(record({ stripe_receipt_url: "https://pay.stripe.com/receipts/abc" })).receiptUrl,
        ).toBe("https://pay.stripe.com/receipts/abc")
    })

    it("degrades gracefully without a ticket embed", () => {
        const row = toUserPaymentRow(record({ ticket: null, ticket_id: null, status: "authorized" }))
        expect(row.ticketShortId).toBe("-")
        expect(row.ticketTitle).toBe("Untitled ticket")
        expect(row.ticketType).toBe("Support")
        expect(row.date).toBe("2026-09-02T10:00:00.000Z")
    })
})

describe("aggregateMonthly", () => {
    it("sums only paid rows per month, counts distinct tickets, newest first", () => {
        const rows = [
            record({ id: "a", completed_at: "2026-08-10T12:00:00.000Z", captured_amount_smallest_unit: 1000 }),
            record({ id: "b", completed_at: "2026-08-20T12:00:00.000Z", captured_amount_smallest_unit: 500 }),
            record({
                id: "c",
                ticket_id: "other",
                ticket: { id: "other", title: "Other", project_id: "proj-1" },
                completed_at: "2026-09-01T12:00:00.000Z",
                captured_amount_smallest_unit: 300,
            }),
            record({ id: "d", status: "authorized", created_at: "2026-09-05T12:00:00.000Z" }),
        ].map(toUserPaymentRow)

        const monthly = aggregateMonthly(rows)
        expect(monthly).toHaveLength(2)
        expect(monthly[0]).toMatchObject({ id: "2026-09", ticketCount: 1, amountSmallestUnit: 300 })
        expect(monthly[1]).toMatchObject({ id: "2026-08", ticketCount: 1, amountSmallestUnit: 1500 })
    })
})

describe("groupUserPaymentsByTicket", () => {
    const rows = (...overrides: Array<Partial<UserPaymentRecord>>): UserPaymentRow[] =>
        overrides.map((o) => toUserPaymentRow(record(o)))

    it("shows a ticket charged twice as one record with both transactions, oldest first", () => {
        const groups = groupUserPaymentsByTicket(
            rows(
                { id: "pay-2", captured_amount_smallest_unit: 1000, completed_at: "2026-09-10T10:00:00.000Z", stripe_receipt_url: "r2" },
                { id: "pay-1", stripe_receipt_url: "r1" },
                { id: "other", ticket_id: "other", ticket: null, completed_at: "2026-09-05T10:00:00.000Z" },
            ),
        )
        expect(groups.map((g) => g.id)).toEqual(["ticket:abcdef0-1234", "ticket:other"])
        const [ticket] = groups
        expect(ticket.transactions.map((t) => t.id)).toEqual(["pay-1", "pay-2"])
        expect(ticket.amountSmallestUnit).toBe(5200)
        expect(ticket.paidSmallestUnit).toBe(5200)
        expect(ticket.displayStatus).toBe("paid")
        expect(ticket.date).toBe("2026-09-10T10:00:00.000Z")
        // Each charge has its own receipt, so the record itself has none.
        expect(ticket.receiptUrl).toBeNull()
        expect(groups[1].transactions).toHaveLength(1)
    })

    it("leaves failed and cancelled attempts out of the amount", () => {
        const [ticket] = groupUserPaymentsByTicket(
            rows(
                { id: "declined", status: "failed", completed_at: null, created_at: "2026-09-01T10:00:00.000Z" },
                { id: "released", status: "cancelled", completed_at: null, created_at: "2026-09-02T10:00:00.000Z" },
                { id: "paid" },
            ),
        )
        expect(ticket.amountSmallestUnit).toBe(4200)
        expect(ticket.displayStatus).toBe("paid")
    })

    it("keeps a lone failed charge's amount instead of showing zero", () => {
        const [ticket] = groupUserPaymentsByTicket(rows({ status: "failed", completed_at: null }))
        expect(ticket.amountSmallestUnit).toBe(6000)
        expect(ticket.displayStatus).toBe("failed")
    })
})

describe("summarizeUserPaymentStatus", () => {
    const tx = (displayStatus: UserPaymentRow["displayStatus"]) => ({ displayStatus }) as UserPaymentRow

    it("lets anything still open win, then a failed latest charge, then paid", () => {
        expect(summarizeUserPaymentStatus([tx("paid"), tx("on_hold")])).toBe("on_hold")
        expect(summarizeUserPaymentStatus([tx("paid"), tx("action_required"), tx("on_hold")])).toBe("action_required")
        expect(summarizeUserPaymentStatus([tx("paid"), tx("failed")])).toBe("failed")
        expect(summarizeUserPaymentStatus([tx("failed"), tx("paid")])).toBe("paid")
        expect(summarizeUserPaymentStatus([tx("paid"), tx("cancelled")])).toBe("paid")
        expect(summarizeUserPaymentStatus([tx("cancelled")])).toBe("cancelled")
    })
})
