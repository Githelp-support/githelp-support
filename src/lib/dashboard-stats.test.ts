import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { monthLabel } from "@/lib/user-payment-reports"
import {
    computeDashboardStats,
    isTicketClosedInPeriod,
    UNCATEGORIZED_ISSUE_TYPE,
    type DashboardStatsInput,
    type DashboardTicket,
} from "./dashboard-stats"

const HOUR = 3_600_000

// Mid-month noon timestamps so local-time month labels are stable in any timezone.
const SEP = "2026-09-15T12:00:00.000Z"
const OCT = "2026-10-15T12:00:00.000Z"
const SEPTEMBER = monthLabel(SEP)
const OCTOBER = monthLabel(OCT)

function ticket(overrides: Partial<DashboardTicket> & { id: string }): DashboardTicket {
    return { status: "open", completed_at: null, cancelled_at: null, ...overrides }
}

function entry(overrides: Partial<TimeEntry> & { id: string; ticket_id: string }): TimeEntry {
    return {
        helper_id: "helper-1",
        type: "solo",
        time_milliseconds: HOUR,
        note: null,
        date: OCT,
        created_at: OCT,
        review_status: "accepted",
        ...overrides,
    }
}

function input(overrides: Partial<DashboardStatsInput> = {}): DashboardStatsInput {
    return {
        tickets: [],
        timeEntries: [],
        helpers: [{ helper_id: "helper-1", user_id: "user-1", category: "core", user: { name: "Ada" } }],
        helpCategories: [],
        ticketsHelpCategories: [],
        ...overrides,
    }
}

describe("isTicketClosedInPeriod", () => {
    it("uses completed_at for completed tickets and cancelled_at for cancelled ones", () => {
        expect(isTicketClosedInPeriod(ticket({ id: "a", status: "completed", completed_at: OCT }), OCTOBER)).toBe(true)
        expect(isTicketClosedInPeriod(ticket({ id: "b", status: "cancelled", cancelled_at: OCT }), OCTOBER)).toBe(true)
        expect(isTicketClosedInPeriod(ticket({ id: "c", status: "completed", completed_at: SEP }), OCTOBER)).toBe(false)
    })

    it("never counts an open ticket, even one that carries a stale completed_at", () => {
        expect(isTicketClosedInPeriod(ticket({ id: "a", status: "in-progress", completed_at: OCT }), OCTOBER)).toBe(false)
        expect(isTicketClosedInPeriod(ticket({ id: "a", status: "in-progress", completed_at: OCT }), null)).toBe(false)
    })

    it("accepts any closed ticket when the period is All (null)", () => {
        expect(isTicketClosedInPeriod(ticket({ id: "a", status: "completed", completed_at: SEP }), null)).toBe(true)
        expect(isTicketClosedInPeriod(ticket({ id: "b", status: "cancelled", cancelled_at: OCT }), null)).toBe(true)
    })
})

describe("computeDashboardStats key stats", () => {
    const tickets = [
        ticket({ id: "done-oct", status: "completed", completed_at: OCT }),
        ticket({ id: "cancelled-oct", status: "cancelled", cancelled_at: OCT }),
        ticket({ id: "done-sep", status: "completed", completed_at: SEP }),
        ticket({ id: "open", status: "in-progress" }),
    ]

    it("counts only tickets completed in the selected month as solved", () => {
        const { keyStats } = computeDashboardStats(input({ tickets }), OCTOBER)
        expect(keyStats.totalTicketsSolved).toBe(1)
    })

    it("uses completed + cancelled in period as the percentage denominator", () => {
        const { keyStats } = computeDashboardStats(input({ tickets }), OCTOBER)
        // 1 completed / (1 completed + 1 cancelled); the open ticket does not count
        expect(keyStats.percentageSolved).toBe(50)
    })

    it("includes every closed ticket for All", () => {
        const { keyStats } = computeDashboardStats(input({ tickets }), null)
        expect(keyStats.totalTicketsSolved).toBe(2)
        expect(keyStats.percentageSolved).toBe(67)
    })

    it("returns zeros and '-' when nothing closed in the period", () => {
        const { keyStats } = computeDashboardStats(input({ tickets }), monthLabel("2025-01-15T12:00:00.000Z"))
        expect(keyStats).toEqual({ totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 })
    })

    it("counts time logged in an earlier month when the ticket closed in the selected month", () => {
        const timeEntries = [
            entry({ id: "e1", ticket_id: "done-oct", date: SEP, time_milliseconds: 2 * HOUR }),
            entry({ id: "e2", ticket_id: "done-oct", date: OCT, time_milliseconds: 30 * 60_000 }),
            // Logged in October, but on a ticket that closed in September
            entry({ id: "e3", ticket_id: "done-sep", date: OCT, time_milliseconds: 5 * HOUR }),
            // Logged on a ticket that is still open
            entry({ id: "e4", ticket_id: "open", date: OCT, time_milliseconds: 5 * HOUR }),
        ]
        const { keyStats } = computeDashboardStats(input({ tickets, timeEntries }), OCTOBER)
        expect(keyStats.totalTimeSpent).toBe("2h 30min")
    })

    it("excludes declined time entries", () => {
        const timeEntries = [
            entry({ id: "e1", ticket_id: "done-oct", time_milliseconds: HOUR }),
            entry({ id: "e2", ticket_id: "done-oct", time_milliseconds: 3 * HOUR, review_status: "declined" }),
        ]
        const { keyStats } = computeDashboardStats(input({ tickets, timeEntries }), OCTOBER)
        expect(keyStats.totalTimeSpent).toBe("1h 0min")
    })
})

describe("computeDashboardStats helpers table", () => {
    const tickets = [
        ticket({ id: "done-oct", status: "completed", completed_at: OCT }),
        ticket({ id: "cancelled-oct", status: "cancelled", cancelled_at: OCT }),
        ticket({ id: "done-sep", status: "completed", completed_at: SEP }),
        ticket({ id: "open", status: "in-progress" }),
    ]
    const helpers = [
        { helper_id: "helper-1", user_id: "user-1", category: "core", user: { name: "Ada" } },
        { helper_id: "helper-2", user_id: "user-2", category: "Community", user: { name: "Bob" } },
    ]

    it("counts per helper the period tickets they logged billable time on", () => {
        const timeEntries = [
            entry({ id: "e1", ticket_id: "done-oct", helper_id: "helper-1", date: SEP, time_milliseconds: HOUR }),
            entry({ id: "e2", ticket_id: "done-oct", helper_id: "helper-1", time_milliseconds: HOUR }),
            entry({ id: "e3", ticket_id: "cancelled-oct", helper_id: "helper-1", time_milliseconds: HOUR }),
            entry({ id: "e4", ticket_id: "done-sep", helper_id: "helper-1", time_milliseconds: HOUR }),
            entry({ id: "e5", ticket_id: "open", helper_id: "helper-1", time_milliseconds: HOUR }),
            // Bob only has a declined entry in the period
            entry({ id: "e6", ticket_id: "done-oct", helper_id: "helper-2", review_status: "declined" }),
        ]
        const { helperStats } = computeDashboardStats(input({ tickets, timeEntries, helpers }), OCTOBER)
        const ada = helperStats.find((h) => h.helper_id === "helper-1")!
        const bob = helperStats.find((h) => h.helper_id === "helper-2")!
        expect(ada.tickets).toBe(2)
        expect(ada.time).toBe("3h 0min")
        expect(bob.tickets).toBe("-")
        expect(bob.time).toBe("-")
        expect(bob.category).toBe("community")
    })

    it("lists every helper even when they have no work in the period", () => {
        const { helperStats } = computeDashboardStats(input({ tickets, helpers }), OCTOBER)
        expect(helperStats.map((h) => h.name)).toEqual(["Ada", "Bob"])
        expect(helperStats.every((h) => h.tickets === "-" && h.time === "-")).toBe(true)
    })
})

describe("computeDashboardStats issue types table", () => {
    const tickets = [
        ticket({ id: "done-oct", status: "completed", completed_at: OCT }),
        ticket({ id: "done-sep", status: "completed", completed_at: SEP }),
        ticket({ id: "uncat-oct", status: "cancelled", cancelled_at: OCT }),
    ]
    const helpCategories = [
        { id: 1, value: "Bug" },
        { id: 2, value: "Question" },
    ]
    const ticketsHelpCategories = [
        { ticket_id: "done-oct", help_category_id: 1 },
        { ticket_id: "done-sep", help_category_id: 2 },
        // Category that no longer exists on the project
        { ticket_id: "uncat-oct", help_category_id: 99 },
    ]
    const timeEntries = [
        entry({ id: "e1", ticket_id: "done-oct", date: SEP, time_milliseconds: HOUR }),
        entry({ id: "e2", ticket_id: "done-sep", time_milliseconds: 2 * HOUR }),
        entry({ id: "e3", ticket_id: "uncat-oct", time_milliseconds: 45 * 60_000 }),
    ]

    it("only reflects tickets closed in the period, marking those categories as applied", () => {
        const { issueTypeStats } = computeDashboardStats(
            input({ tickets, timeEntries, helpCategories, ticketsHelpCategories }),
            OCTOBER,
        )
        expect(issueTypeStats).toEqual([
            { name: "Bug", tickets: 1, time: "1h 0min", applied: true },
            { name: "Question", tickets: "-", time: "-", applied: false },
            { name: UNCATEGORIZED_ISSUE_TYPE, tickets: 1, time: "45min", applied: true },
        ])
    })

    it("covers every closed ticket for All", () => {
        const { issueTypeStats } = computeDashboardStats(
            input({ tickets, timeEntries, helpCategories, ticketsHelpCategories }),
            null,
        )
        expect(issueTypeStats.find((row) => row.name === "Question")).toEqual({
            name: "Question",
            tickets: 1,
            time: "2h 0min",
            applied: true,
        })
    })

    it("returns no rows when the project has no tickets at all", () => {
        const { issueTypeStats } = computeDashboardStats(input({ helpCategories }), null)
        expect(issueTypeStats).toEqual([])
    })
})
