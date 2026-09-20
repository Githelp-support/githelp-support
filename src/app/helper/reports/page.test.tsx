import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"
import type { PaymentTransfer } from "@/hooks/usePayments"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))
vi.mock("@/hooks/useCurrentHelper", () => ({
  useCurrentHelper: () => ({ data: "helper-1", isFetched: true }),
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

const useHelperTimeEntries = vi.fn()
vi.mock("@/hooks/useHelperTimeEntries", () => ({
  useHelperTimeEntries: (helperId?: string | null, projectId?: string) =>
    useHelperTimeEntries(helperId, projectId),
}))

vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/layout/header", () => ({ Header: () => null }))
vi.mock("@/components/modals/request-pdf-modal", () => ({ RequestPdfModal: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

import HelperReportsPage from "./page"

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

describe("HelperReportsPage monthly report rows", () => {
  beforeEach(() => {
    usePaymentTransfers.mockReturnValue({
      data: [
        transfer({
          id: "pt-aug",
          ticket_id: "augaaaa-1111",
          completed_at: "2026-08-12T12:00:00.000Z",
        }),
        transfer({
          id: "pt-sep",
          ticket_id: "sepbbbb-2222",
          completed_at: "2026-09-05T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      isFetched: true,
    })
    useHelperTimeEntries.mockReturnValue({ data: [], isLoading: false })
  })

  it("clicking a monthly report row opens the Payouts tab filtered to that month", () => {
    render(<HelperReportsPage />)

    // Payouts tab is the default and unfiltered: both months' payouts show.
    expect(screen.getByText("augaaaa")).toBeInTheDocument()
    expect(screen.getByText("sepbbbb")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Monthly reports" }))
    expect(screen.getByRole("button", { name: "View payouts for September 2026" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View payouts for August 2026" }))

    // Back on the Payouts tab (monthly rows are gone) with only August's payout left.
    expect(screen.queryByRole("button", { name: "View payouts for August 2026" })).not.toBeInTheDocument()
    expect(screen.getByText("augaaaa")).toBeInTheDocument()
    expect(screen.queryByText("sepbbbb")).not.toBeInTheDocument()
  })

  it("pressing Enter on a monthly report row applies the same month filter", () => {
    render(<HelperReportsPage />)

    fireEvent.click(screen.getByRole("button", { name: "Monthly reports" }))
    fireEvent.keyDown(screen.getByRole("button", { name: "View payouts for September 2026" }), {
      key: "Enter",
    })

    expect(screen.getByText("sepbbbb")).toBeInTheDocument()
    expect(screen.queryByText("augaaaa")).not.toBeInTheDocument()
  })
})
