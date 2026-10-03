import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Payment } from "@/hooks/usePayments"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))
vi.mock("@/hooks/useRealtimePaymentTransfers", () => ({
  useRealtimePaymentTransfers: vi.fn(),
}))
vi.mock("@/hooks/useProject", () => ({
  useProject: () => ({ data: { name: "Project One" } }),
}))

const usePayments = vi.fn()
vi.mock("@/hooks/usePayments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePayments")>()
  return {
    ...actual,
    usePayments: (projectId?: string) => usePayments(projectId),
    usePaymentTransfers: () => ({ data: [], isLoading: false }),
  }
})

vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/layout/header", () => ({ Header: () => null }))
vi.mock("@/components/modals/request-pdf-modal", () => ({ RequestPdfModal: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

import ReportsSupportPage from "./page"

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "p-1",
    project_id: "proj-1",
    ticket_id: "ticket-1",
    amount_smallest_unit: 5000,
    captured_amount_smallest_unit: 5000,
    currency: "usd",
    status: "completed",
    amount_platform_smallest_unit: 500,
    amount_project_smallest_unit: 1500,
    amount_helper_smallest_unit: 3000,
    transaction_id: null,
    created_at: "2026-08-10T12:00:00.000Z",
    completed_at: "2026-08-12T12:00:00.000Z",
    ...overrides,
  }
}

describe("ReportsSupportPage monthly report rows", () => {
  beforeEach(() => {
    usePayments.mockReturnValue({
      data: [
        payment({
          id: "p-aug",
          ticket_id: "1111111-aug",
          completed_at: "2026-08-12T12:00:00.000Z",
          ticket: { id: "1111111-aug", title: "August ticket" },
        }),
        payment({
          id: "p-sep",
          ticket_id: "2222222-sep",
          created_at: "2026-09-03T12:00:00.000Z",
          completed_at: "2026-09-05T12:00:00.000Z",
          ticket: { id: "2222222-sep", title: "September ticket" },
        }),
      ],
      isLoading: false,
    })
  })

  it("clicking a monthly report row opens the Tickets tab filtered to that month", () => {
    render(<ReportsSupportPage />)

    // Monthly tab is the default: one report row per month.
    expect(screen.getByRole("button", { name: "View tickets for September 2026" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View tickets for August 2026" }))

    // Now on the Tickets tab (monthly rows are gone) with only August's charge left.
    expect(screen.queryByRole("button", { name: "View tickets for August 2026" })).not.toBeInTheDocument()
    expect(screen.getByText("August ticket")).toBeInTheDocument()
    expect(screen.queryByText("September ticket")).not.toBeInTheDocument()
  })

  it("activating a monthly row with the keyboard applies the same month filter", () => {
    render(<ReportsSupportPage />)

    const septemberRow = screen.getByRole("button", { name: "View tickets for September 2026" })
    fireEvent.keyDown(septemberRow, { key: "Enter" })

    expect(screen.getByText("September ticket")).toBeInTheDocument()
    expect(screen.queryByText("August ticket")).not.toBeInTheDocument()
  })
})
