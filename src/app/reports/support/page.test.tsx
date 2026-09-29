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
  useProject: () => ({ data: { project_id: "proj-1", name: "Test Project" } }),
}))

const usePayments = vi.fn()
const usePaymentTransfers = vi.fn()
vi.mock("@/hooks/usePayments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePayments")>()
  return {
    ...actual,
    usePayments: (projectId?: string) => usePayments(projectId),
    usePaymentTransfers: (filters?: unknown) => usePaymentTransfers(filters),
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
    amount_smallest_unit: 4500,
    currency: "usd",
    status: "completed",
    amount_platform_smallest_unit: 300,
    amount_project_smallest_unit: 1200,
    amount_helper_smallest_unit: 3000,
    transaction_id: null,
    created_at: "2026-08-10T12:00:00.000Z",
    completed_at: "2026-08-12T12:00:00.000Z",
    ...overrides,
  }
}

describe("ReportsSupportPage monthly report rows", () => {
  beforeEach(() => {
    // The Monthly and Tickets tabs are built from the project's customer charges.
    usePayments.mockReturnValue({
      data: [
        payment({
          id: "pay-aug",
          ticket_id: "1111111-aug",
          completed_at: "2026-08-12T12:00:00.000Z",
          ticket: { id: "1111111-aug", title: "Aug ticket" },
        }),
        payment({
          id: "pay-sep",
          ticket_id: "2222222-sep",
          completed_at: "2026-09-05T12:00:00.000Z",
          ticket: { id: "2222222-sep", title: "Sep ticket" },
        }),
      ],
      isLoading: false,
    })
    usePaymentTransfers.mockReturnValue({ data: [], isLoading: false })
  })

  it("clicking a monthly report row opens the Tickets tab filtered to that month", () => {
    render(<ReportsSupportPage />)

    // Monthly tab is the default: one report row per month.
    expect(screen.getByRole("button", { name: "View tickets for September 2026" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View tickets for August 2026" }))

    // Now on the Tickets tab (monthly rows are gone) with only August's ticket left.
    expect(screen.queryByRole("button", { name: "View tickets for August 2026" })).not.toBeInTheDocument()
    expect(screen.getByText("Aug ticket")).toBeInTheDocument()
    expect(screen.getByText("1111111")).toBeInTheDocument()
    expect(screen.queryByText("Sep ticket")).not.toBeInTheDocument()
    expect(screen.queryByText("2222222")).not.toBeInTheDocument()
  })

  it("activating a monthly report row with the keyboard applies the same month filter", () => {
    render(<ReportsSupportPage />)

    fireEvent.keyDown(screen.getByRole("button", { name: "View tickets for September 2026" }), { key: "Enter" })

    expect(screen.getByText("Sep ticket")).toBeInTheDocument()
    expect(screen.queryByText("Aug ticket")).not.toBeInTheDocument()
  })
})
