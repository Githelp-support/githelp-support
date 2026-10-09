import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { PaymentTransfer } from "@/hooks/usePayments"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))

const useSLAs = vi.fn()
vi.mock("@/hooks/useSLAs", () => ({
  useSLAs: (projectId?: string) => useSLAs(projectId),
}))

const usePaymentTransfers = vi.fn()
vi.mock("@/hooks/usePayments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePayments")>()
  return {
    ...actual,
    usePaymentTransfers: (filters?: unknown) => usePaymentTransfers(filters),
  }
})

vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/layout/header", () => ({ Header: () => null }))

import ReportsSLAsPage from "./page"

/** The page's period dropdown lists the last 12 months relative to today, so pick data months relative to today too. */
function monthAgo(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 15, 12)
  return {
    label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    completedAt: date.toISOString(),
  }
}

const OLDER = monthAgo(2)
const NEWER = monthAgo(1)
const OLDER_SLA = "Alpha SLA"
const NEWER_SLA = "Beta SLA"

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
    created_at: OLDER.completedAt,
    completed_at: OLDER.completedAt,
    ...overrides,
  }
}

const defaultTransfers = () => [
  transfer({ id: "pt-older", ticket_id: "ticket-older", completed_at: OLDER.completedAt, sla: { name: OLDER_SLA } }),
  transfer({ id: "pt-newer", ticket_id: "ticket-newer", completed_at: NEWER.completedAt, sla: { name: NEWER_SLA } }),
]

function mockData(transfers: PaymentTransfer[] = defaultTransfers()) {
  useSLAs.mockReturnValue({ data: [{ id: "sla-1", name: OLDER_SLA }, { id: "sla-2", name: NEWER_SLA }] })
  usePaymentTransfers.mockReturnValue({ data: transfers, isLoading: false })
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

      // Monthly tab is the default: one row per SLA and month.
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
