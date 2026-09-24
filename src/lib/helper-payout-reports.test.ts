import { describe, expect, it } from "vitest"
import type { PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"
import {
    aggregateHelperMonthly,
    aggregateProjectMonthly,
    buildPayoutStatement,
    formatMinutes,
    payoutReference,
    transferTicketType,
} from "./helper-payout-reports"

function transfer(overrides: Partial<PaymentTransfer> = {}): PaymentTransfer {
    return {
        id: "t-1",
        project_id: "proj-1",
        helper_id: "helper-1",
        ticket_id: "ticket-1",
        transfer_user_type: "helper",
        status: "completed",
        amount_smallest_unit: 1000,
        currency: "usd",
        transfer_id: null,
        created_at: "2026-08-10T12:00:00.000Z",
        completed_at: "2026-08-12T12:00:00.000Z",
        ...overrides,
    }
}

function entry(overrides: Partial<HelperTimeEntry> = {}): HelperTimeEntry {
    return {
        id: "e-1",
        ticket_id: "ticket-1",
        helper_id: "helper-1",
        type: "solo",
        time_milliseconds: 30 * 60000,
        date: "2026-08-11",
        created_at: "2026-08-11T12:00:00.000Z",
        ...overrides,
    }
}

describe("transferTicketType", () => {
    it("uses the first help category, capitalised, else Support", () => {
        expect(
            transferTicketType({
                ticket: { id: "x", title: "t", categories: [{ help_category: null }, { help_category: { value: "bug" } }] },
            }),
        ).toBe("Bug")
        expect(transferTicketType({ ticket: { id: "x", title: "t" } })).toBe("Support")
    })
})

describe("payoutReference", () => {
    it("prefers the Stripe transfer id and falls back to a short payout id", () => {
        expect(payoutReference(transfer({ transfer_id: "tr_123abc" }))).toBe("tr_123abc")
        expect(payoutReference(transfer({ id: "9f8e7d6c-5b4a-4321-8765-0123456789ab", transfer_id: null }))).toBe(
            "GH-9F8E7D6C",
        )
    })
})

describe("buildPayoutStatement", () => {
    const full = () =>
        transfer({
            id: "9f8e7d6c-5b4a-4321-8765-0123456789ab",
            transfer_id: "tr_123abc",
            destination_account_id: "acct_777",
            payment_id: "pay-1",
            helper: { user_id: "u-1", user: { name: "  Ada  ", username: "ada", email: "ada@example.com" } },
            project: { name: "Acme" },
            ticket: {
                id: "abcdef0-ticket",
                title: "  Login broken  ",
                sla: { name: "Gold" },
                categories: [{ help_category: { value: "bug" } }],
            },
        })

    it("collects payee, project, ticket and Stripe references for a completed payout", () => {
        const statement = buildPayoutStatement(full())
        expect(statement.reference).toBe("tr_123abc")
        expect(statement.date).toBe("2026-08-12T12:00:00.000Z")
        expect(statement.statusLabel).toBe("Paid out")
        expect(statement.payee).toEqual({ name: "Ada", email: "ada@example.com", stripeAccountId: "acct_777" })
        expect(statement.projectName).toBe("Acme")
        expect(statement.ticketShortId).toBe("abcdef0")
        expect(statement.ticketTitle).toBe("Login broken")
        expect(statement.ticketType).toBe("Bug")
        expect(statement.slaName).toBe("Gold")
        expect(statement.amountSmallestUnit).toBe(1000)
        expect(statement.currency).toBe("usd")
        expect(statement.payoutId).toBe("9f8e7d6c-5b4a-4321-8765-0123456789ab")
        expect(statement.paymentId).toBe("pay-1")
        expect(statement.failureReason).toBeNull()
    })

    it("degrades gracefully for a pending payout with no embeds", () => {
        const statement = buildPayoutStatement(
            transfer({ status: "pending", completed_at: null, ticket_id: null, transfer_id: null }),
        )
        expect(statement.reference).toBe("GH-T1")
        expect(statement.date).toBe("2026-08-10T12:00:00.000Z")
        expect(statement.statusLabel).toBe("Pending")
        expect(statement.payee).toEqual({ name: "Helper", email: null, stripeAccountId: null })
        expect(statement.projectName).toBe("Project")
        expect(statement.ticketShortId).toBe("-")
        expect(statement.ticketTitle).toBe("Payout")
        expect(statement.ticketType).toBe("Support")
        expect(statement.slaName).toBeNull()
    })

    it("only surfaces the failure reason on failed payouts", () => {
        expect(buildPayoutStatement(transfer({ failure_reason: "stale" })).failureReason).toBeNull()
        const failed = buildPayoutStatement(transfer({ status: "failed", failure_reason: "Insufficient funds" }))
        expect(failed.statusLabel).toBe("Failed")
        expect(failed.failureReason).toBe("Insufficient funds")
    })
})

describe("formatMinutes", () => {
    it("renders hours and minutes compactly", () => {
        expect(formatMinutes(0)).toBe("0m")
        expect(formatMinutes(45)).toBe("45m")
        expect(formatMinutes(60)).toBe("1h")
        expect(formatMinutes(275)).toBe("4h 35m")
    })
})

describe("aggregateHelperMonthly", () => {
    it("groups payouts and logged time per month, ignores failed, newest first", () => {
        const rows = aggregateHelperMonthly(
            [
                transfer({ id: "a", amount_smallest_unit: 1000 }),
                transfer({ id: "b", ticket_id: "ticket-2", amount_smallest_unit: 500, status: "pending", completed_at: null }),
                transfer({ id: "c", amount_smallest_unit: 999, status: "failed" }),
                transfer({ id: "d", ticket_id: "ticket-3", completed_at: "2026-09-01T12:00:00.000Z", amount_smallest_unit: 300 }),
            ],
            [entry(), entry({ id: "e-2", time_milliseconds: 40 * 60000 }), entry({ id: "e-3", date: "2026-07-31", time_milliseconds: 60000 })],
        )
        expect(rows.map((r) => r.id)).toEqual(["2026-09", "2026-08", "2026-07"])
        expect(rows[1]).toMatchObject({
            ticketsClosed: 2,
            minutesLogged: 70,
            earningsSmallestUnit: 1500,
            paidOutSmallestUnit: 1000,
        })
        expect(rows[0]).toMatchObject({ ticketsClosed: 1, minutesLogged: 0, earningsSmallestUnit: 300 })
        expect(rows[2]).toMatchObject({ ticketsClosed: 0, minutesLogged: 1, earningsSmallestUnit: 0 })
    })
})

describe("aggregateProjectMonthly", () => {
    it("keeps helper payouts apart from the project's own share", () => {
        const rows = aggregateProjectMonthly([
            transfer({ id: "a", amount_smallest_unit: 850 }),
            transfer({ id: "b", transfer_user_type: "project", helper_id: null, amount_smallest_unit: 150 }),
            transfer({ id: "c", ticket_id: "ticket-2", amount_smallest_unit: 425, status: "pending", completed_at: null }),
        ])
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
            id: "2026-08",
            ticketCount: 2,
            helperPayoutSmallestUnit: 1275,
            projectShareSmallestUnit: 150,
            allPaidOut: false,
        })
    })
})
