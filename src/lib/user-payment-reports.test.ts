import { describe, expect, it } from "vitest"
import {
    aggregateMonthly,
    toDisplayStatus,
    toUserPaymentRow,
    userFacingAmount,
    type UserPaymentRecord,
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
