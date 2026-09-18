import { describe, expect, it } from "vitest"
import type { PaymentTransfer } from "@/hooks/usePayments"
import type { HelperTimeEntry } from "@/hooks/useHelperTimeEntries"
import {
    aggregateHelperMonthly,
    aggregateProjectMonthly,
    formatMinutes,
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
