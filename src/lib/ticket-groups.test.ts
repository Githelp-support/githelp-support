import { describe, expect, it } from "vitest"
import { groupByTicket, transactionCountLabel } from "./ticket-groups"

type Row = { id: string; ticket: string | null; helper?: string }

describe("groupByTicket", () => {
    const rows: Row[] = [
        { id: "a", ticket: "t-1", helper: "h-1" },
        { id: "b", ticket: null },
        { id: "c", ticket: "t-2" },
        { id: "d", ticket: "t-1", helper: "h-2" },
        { id: "e", ticket: null },
        { id: "f", ticket: "t-1", helper: "h-1" },
    ]

    it("buckets by ticket in first-seen order and keeps ticketless rows apart", () => {
        const groups = groupByTicket(rows, (r) => r.ticket, (r) => r.id)
        expect(groups.map((g) => [g.key, g.items.map((r) => r.id)])).toEqual([
            ["ticket:t-1", ["a", "d", "f"]],
            ["row:b", ["b"]],
            ["ticket:t-2", ["c"]],
            ["row:e", ["e"]],
        ])
        expect(groups[1].ticketId).toBeNull()
    })

    it("splits a ticket further by sub key", () => {
        const groups = groupByTicket(rows, (r) => r.ticket, (r) => r.id, (r) => r.helper)
        expect(groups.filter((g) => g.ticketId === "t-1").map((g) => [g.key, g.items.map((r) => r.id)])).toEqual([
            ["ticket:t-1:h-1", ["a", "f"]],
            ["ticket:t-1:h-2", ["d"]],
        ])
    })
})

describe("transactionCountLabel", () => {
    it("pluralises", () => {
        expect(transactionCountLabel(1)).toBe("1 transaction")
        expect(transactionCountLabel(2, "payout")).toBe("2 payouts")
    })
})
