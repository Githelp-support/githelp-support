import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))

const useProjectSlaBillingPeriods = vi.fn()
const useProjectSlaTickets = vi.fn()
vi.mock("@/hooks/useSlaReports", () => ({
  useProjectSlaBillingPeriods: (projectId?: string) => useProjectSlaBillingPeriods(projectId),
  useProjectSlaTickets: (projectId?: string) => useProjectSlaTickets(projectId),
  ticketLoggedMinutes: () => 0,
}))

vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/layout/header", () => ({ Header: () => null }))

import ReportsSLAsPage from "./page"

/** The page's period dropdown lists the last 12 months relative to today, so pick data months relative to today too. */
function monthAgo(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 15, 12)
  const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const periodStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  return { label, completedAt: date.toISOString(), periodStart }
}

const OLDER = monthAgo(2)
const NEWER = monthAgo(1)
const OLDER_SLA = "Alpha SLA"
const NEWER_SLA = "Beta SLA"

function billingPeriod(id: string, name: string, periodStart: string) {
  return {
    id,
    period_start: periodStart,
    period_end: "2099-01-01",
    minutes_included: 60,
    minutes_consumed: 0,
    minutes_rolled_over: 0,
    sla: {
      id: `sla-${id}`,
      name,
      payment_frequency: "monthly",
      subscription_amount_smallest_unit: 0,
      currency: "usd",
      ticket_price_minute_first_60: 0,
    },
  }
}

function ticket(id: string, name: string, completedAt: string) {
  return {
    id,
    title: `${name} ticket`,
    status: "completed",
    created_at: completedAt,
    completed_at: completedAt,
    sla_id: `sla-${id}`,
    sla_usage_recorded_at: null,
    sla: { id: `sla-${id}`, name },
    time_entries: [],
  }
}

function mockData() {
  useProjectSlaBillingPeriods.mockReturnValue({
    data: [
      billingPeriod("older", OLDER_SLA, OLDER.periodStart),
      billingPeriod("newer", NEWER_SLA, NEWER.periodStart),
    ],
    isLoading: false,
    error: null,
  })
  useProjectSlaTickets.mockReturnValue({
    data: [
      ticket("older", OLDER_SLA, OLDER.completedAt),
      ticket("newer", NEWER_SLA, NEWER.completedAt),
    ],
    isLoading: false,
    error: null,
  })
}

const periodSelect = () => screen.getByRole("combobox")
const openPeriodSelect = () => fireEvent.keyDown(periodSelect(), { key: "ArrowDown" })
const choosePeriod = (label: string) => {
  openPeriodSelect()
  fireEvent.click(screen.getByRole("option", { name: label }))
}
const openTicketsTab = () => fireEvent.click(screen.getByRole("button", { name: "Tickets" }))

describe("ReportsSLAsPage", () => {
  beforeEach(() => {
    mockData()
  })

  describe("period filter", () => {
    it("defaults the period dropdown to 'All'", () => {
      render(<ReportsSLAsPage />)

      expect(periodSelect()).toHaveTextContent("All")
    })

    it("has no standalone 'All' or 'Current month' buttons", () => {
      render(<ReportsSLAsPage />)

      expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Current month" })).not.toBeInTheDocument()
    })

    it("selecting a month narrows the Monthly rows to that month", () => {
      render(<ReportsSLAsPage />)

      expect(screen.getByText(OLDER_SLA)).toBeInTheDocument()
      expect(screen.getByText(NEWER_SLA)).toBeInTheDocument()

      choosePeriod(NEWER.label)

      expect(periodSelect()).toHaveTextContent(NEWER.label)
      expect(screen.getByText(NEWER_SLA)).toBeInTheDocument()
      expect(screen.queryByText(OLDER_SLA)).not.toBeInTheDocument()
    })

    it("selecting a month narrows the Tickets rows to that month", () => {
      render(<ReportsSLAsPage />)
      openTicketsTab()

      expect(screen.getByText(OLDER_SLA)).toBeInTheDocument()
      expect(screen.getByText(NEWER_SLA)).toBeInTheDocument()

      choosePeriod(NEWER.label)

      expect(periodSelect()).toHaveTextContent(NEWER.label)
      expect(screen.getByText(NEWER_SLA)).toBeInTheDocument()
      expect(screen.queryByText(OLDER_SLA)).not.toBeInTheDocument()
    })
  })
})
