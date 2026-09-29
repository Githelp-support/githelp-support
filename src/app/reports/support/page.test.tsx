import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import type { PaymentTransfer } from "@/hooks/usePayments"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))
vi.mock("@/hooks/useRealtimePaymentTransfers", () => ({
  useRealtimePaymentTransfers: vi.fn(),
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
vi.mock("@/components/modals/request-pdf-modal", () => ({ RequestPdfModal: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

import ReportsSupportPage from "./page"

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

describe("ReportsSupportPage monthly report rows", () => {
  beforeEach(() => {
    usePaymentTransfers.mockReturnValue({
      data: [
        transfer({
          id: "pt-aug",
          ticket_id: "1111111-aug",
          completed_at: "2026-08-12T12:00:00.000Z",
          helper: { user_id: "user-aug", user: { name: "Aug Helper", username: null, email: null } },
        }),
        transfer({
          id: "pt-sep",
          ticket_id: "2222222-sep",
          completed_at: "2026-09-05T12:00:00.000Z",
          helper: { user_id: "user-sep", user: { name: "Sep Helper", username: null, email: null } },
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

    // Now on the Tickets tab (monthly rows are gone) with only August's transfer left.
    expect(screen.queryByRole("button", { name: "View tickets for August 2026" })).not.toBeInTheDocument()
    expect(screen.getByText("Aug Helper")).toBeInTheDocument()
    expect(screen.getByText("1111111")).toBeInTheDocument()
    expect(screen.queryByText("Sep Helper")).not.toBeInTheDocument()
    expect(screen.queryByText("2222222")).not.toBeInTheDocument()
  })

  it("the row's Open button applies the same month filter", () => {
    render(<ReportsSupportPage />)

    const septemberRow = screen.getByRole("button", { name: "View tickets for September 2026" })
    fireEvent.click(within(septemberRow).getByRole("button", { name: "Open" }))

    expect(screen.getByText("Sep Helper")).toBeInTheDocument()
    expect(screen.queryByText("Aug Helper")).not.toBeInTheDocument()
  })
})
