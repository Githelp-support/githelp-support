import { describe, expect, it } from "vitest"
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import {
    aggregateProjectIncomeMonthly,
    projectTransferFor,
    toProjectTicketIncomeRow,
} from "./project-income-reports"

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
        created_at: "2026-08-10T10:00:00.000Z",
        completed_at: "2026-08-11T10:00:00.000Z",
        ticket: { id: "abcdef0-ticket", title: "  Login broken " },
        stripe_receipt_url: "https://pay.stripe.com/r/1",
        ...overrides,
    }
}

function transfer(overrides: Partial<PaymentTransfer> = {}): PaymentTransfer {
    return {
        id: "t-1",
        project_id: "proj-1",
        helper_id: null,
        ticket_id: "abcdef0-ticket",
        payment_id: "p-1",
        transfer_user_type: "project",
        status: "completed",
        amount_smallest_unit: 1500,
        currency: "usd",
        transfer_id: "tr_project",
        created_at: "2026-08-11T12:00:00.000Z",
        completed_at: "2026-08-12T12:00:00.000Z",
        ...overrides,
    }
}

describe("projectTransferFor", () => {
    it("matches the project's own transfer by payment id, then by ticket, never a helper's", () => {
        const helper = transfer({ id: "t-h", transfer_user_type: "helper", helper_id: "h-1" })
        const byTicket = transfer({ id: "t-2", payment_id: null })
        expect(projectTransferFor(payment(), [helper, transfer()])?.id).toBe("t-1")
        expect(projectTransferFor(payment(), [helper, byTicket])?.id).toBe("t-2")
        expect(projectTransferFor(payment({ id: "p-9", ticket_id: "zzz" }), [helper, transfer()])).toBeNull()
    })
})

describe("toProjectTicketIncomeRow", () => {
    it("reports the captured split and marks the share received once transferred", () => {
        const row = toProjectTicketIncomeRow(payment(), [transfer()])
        expect(row).toMatchObject({
            id: "p-1",
            ticketShortId: "abcdef0",
            ticketTitle: "Login broken",
            date: "2026-08-11T10:00:00.000Z",
            captured: true,
            chargedSmallestUnit: 4200,
            platformFeeSmallestUnit: 700,
            helperShareSmallestUnit: 2000,
            projectIncomeSmallestUnit: 1500,
            status: "received",
            stripeTransferId: "tr_project",
            receiptUrl: "https://pay.stripe.com/r/1",
        })
        expect(toProjectTicketIncomeRow(payment(), [transfer({ status: "pending", completed_at: null, transfer_id: null })]).status).toBe("pending")
        expect(toProjectTicketIncomeRow(payment(), [transfer({ status: "failed" })]).status).toBe("failed")
        expect(toProjectTicketIncomeRow(payment(), []).status).toBe("pending")
        expect(toProjectTicketIncomeRow(payment({ amount_project_smallest_unit: 0 }), []).status).toBe("no_share")
    })

    it("shows nothing as income while the customer has not been charged", () => {
        const held = toProjectTicketIncomeRow(payment({ status: "authorized", captured_amount_smallest_unit: null, completed_at: null }), [])
        expect(held).toMatchObject({
            captured: false,
            date: "2026-08-10T10:00:00.000Z",
            chargedSmallestUnit: 5000,
            platformFeeSmallestUnit: 0,
            helperShareSmallestUnit: 0,
            projectIncomeSmallestUnit: 0,
            status: "on_hold",
        })
        expect(toProjectTicketIncomeRow(payment({ status: "processing" }), []).status).toBe("awaiting_payment")
        expect(toProjectTicketIncomeRow(payment({ status: "requires_action" }), []).status).toBe("action_required")
        expect(toProjectTicketIncomeRow(payment({ status: "cancelled" }), []).status).toBe("cancelled")
        expect(toProjectTicketIncomeRow(payment({ status: "failed" }), []).status).toBe("failed")
    })
})

describe("aggregateProjectIncomeMonthly", () => {
    it("sums captured charges per month, tracks received income and skips holds", () => {
        const rows = [
            toProjectTicketIncomeRow(payment(), [transfer()]),
            toProjectTicketIncomeRow(payment({ id: "p-2", ticket_id: "other", completed_at: "2026-08-20T10:00:00.000Z", captured_amount_smallest_unit: 1000, amount_project_smallest_unit: 300 }), []),
            toProjectTicketIncomeRow(payment({ id: "p-3", completed_at: "2026-09-02T10:00:00.000Z" }), []),
            toProjectTicketIncomeRow(payment({ id: "p-4", status: "authorized", completed_at: null }), []),
        ]
        const monthly = aggregateProjectIncomeMonthly(rows)
        expect(monthly.map((m) => m.period)).toEqual(["September 2026", "August 2026"])
        expect(monthly[1]).toMatchObject({
            id: "2026-08",
            ticketCount: 2,
            chargedSmallestUnit: 5200,
            platformFeeSmallestUnit: 1400,
            helperShareSmallestUnit: 4000,
            projectIncomeSmallestUnit: 1800,
            receivedSmallestUnit: 1500,
            allReceived: false,
        })
        expect(monthly[0]).toMatchObject({ ticketCount: 1, projectIncomeSmallestUnit: 1500, receivedSmallestUnit: 0, allReceived: false })
    })

    it("treats a month with no outstanding project share as fully received", () => {
        const rows = [toProjectTicketIncomeRow(payment({ amount_project_smallest_unit: 0 }), [])]
        expect(aggregateProjectIncomeMonthly(rows)[0].allReceived).toBe(true)
        expect(aggregateProjectIncomeMonthly([])).toEqual([])
    })
})
