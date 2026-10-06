import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ComponentProps } from "react"
import type { PaymentTransfer } from "@/hooks/usePayments"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))
vi.mock("@/contexts/user-context", () => ({
  useUser: () => ({ user: { name: "Helper", email: "helper@example.com" } }),
}))
vi.mock("@/hooks/useProject", () => ({
  useProject: () => ({ data: { name: "Project" } }),
}))
vi.mock("@/lib/report-pdf", () => ({ downloadCsv: vi.fn(), downloadReportPdf: vi.fn() }))
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
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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

const LONG_TITLE = "Login page crashes on submit"
const SHORT_TITLE = "Short title"

function mockReportData() {
  push.mockClear()
  usePaymentTransfers.mockReturnValue({
    data: [
      transfer({
        id: "pt-aug",
        ticket_id: "augaaaa-1111",
        ticket: { id: "augaaaa-1111", title: LONG_TITLE },
        amount_smallest_unit: 1000,
        completed_at: "2026-08-12T12:00:00.000Z",
      }),
      transfer({
        id: "pt-sep",
        ticket_id: "sepbbbb-2222",
        ticket: { id: "sepbbbb-2222", title: SHORT_TITLE },
        amount_smallest_unit: 2550,
        completed_at: "2026-09-05T12:00:00.000Z",
      }),
    ],
    isLoading: false,
    isFetched: true,
  })
  useHelperTimeEntries.mockReturnValue({ data: [], isLoading: false })
}

function openPayoutsTab() {
  fireEvent.click(screen.getByRole("button", { name: "Payouts" }))
}

describe("HelperReportsPage monthly report rows", () => {
  beforeEach(mockReportData)

  it("clicking a monthly report row opens the Payouts tab filtered to that month", () => {
    render(<HelperReportsPage />)

    // Payouts tab is unfiltered by default: both months' payouts show.
    fireEvent.click(screen.getByRole("button", { name: "Payouts" }))
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

    fireEvent.keyDown(screen.getByRole("button", { name: "View payouts for September 2026" }), {
      key: "Enter",
    })

    expect(screen.getByText("sepbbbb")).toBeInTheDocument()
    expect(screen.queryByText("augaaaa")).not.toBeInTheDocument()
  })

  it("the kebab menu trigger does not open the row's month", () => {
    render(<HelperReportsPage />)

    fireEvent.click(screen.getByRole("button", { name: "More actions for August 2026" }))

    // Still on the Monthly reports tab, with no month filter applied.
    expect(screen.getByRole("button", { name: "View payouts for August 2026" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View payouts for September 2026" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveTextContent(/^All$/)
    expect(push).not.toHaveBeenCalled()
  })
})

describe("HelperReportsPage period filter", () => {
  beforeEach(mockReportData)

  it("defaults the period dropdown to All, without standalone All / Current month buttons", () => {
    render(<HelperReportsPage />)

    expect(screen.getByRole("combobox")).toHaveTextContent(/^All$/)
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Current month" })).not.toBeInTheDocument()

    openPayoutsTab()
    expect(screen.getByRole("combobox")).toHaveTextContent(/^All$/)
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Current month" })).not.toBeInTheDocument()
  })
})

describe("HelperReportsPage payouts tab", () => {
  beforeEach(mockReportData)

  it("shortens a ticket title longer than 15 characters to its first 15 characters plus '..'", () => {
    render(<HelperReportsPage />)
    openPayoutsTab()

    expect(screen.getByText(`${LONG_TITLE.slice(0, 15)}..`)).toBeInTheDocument()
    expect(screen.queryByText(LONG_TITLE)).not.toBeInTheDocument()
  })

  it("shows a ticket title of 15 characters or fewer in full, without '..'", () => {
    const exactTitle = "Exactly15chars!"
    expect(exactTitle).toHaveLength(15)
    usePaymentTransfers.mockReturnValue({
      data: [
        transfer({ id: "pt-aug", ticket_id: "augaaaa-1111", ticket: { id: "augaaaa-1111", title: SHORT_TITLE } }),
        transfer({ id: "pt-sep", ticket_id: "sepbbbb-2222", ticket: { id: "sepbbbb-2222", title: exactTitle } }),
      ],
      isLoading: false,
      isFetched: true,
    })
    render(<HelperReportsPage />)
    openPayoutsTab()

    expect(screen.getByText(SHORT_TITLE)).toBeInTheDocument()
    expect(screen.getByText(exactTitle)).toBeInTheDocument()
    expect(screen.queryByText(/\.\.$/)).not.toBeInTheDocument()
  })

  it("has no Helper column and no Open button", () => {
    render(<HelperReportsPage />)
    openPayoutsTab()

    expect(screen.queryByRole("button", { name: "Helper" })).not.toBeInTheDocument()
    expect(screen.queryByText("Helper")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument()
  })

  it("labels the amount column 'Earnings (USD)' on both tabs", () => {
    render(<HelperReportsPage />)

    expect(screen.getByRole("button", { name: "Earnings (USD)" })).toBeInTheDocument()

    openPayoutsTab()
    expect(screen.getByRole("button", { name: "Earnings (USD)" })).toBeInTheDocument()
  })

  it("renders amounts without the USD prefix on both tabs", () => {
    render(<HelperReportsPage />)

    expect(screen.getByText("10.00")).toBeInTheDocument()
    expect(screen.getByText("25.50")).toBeInTheDocument()
    expect(screen.queryByText(/USD\s*\d/)).not.toBeInTheDocument()

    openPayoutsTab()
    expect(screen.getByText("10.00")).toBeInTheDocument()
    expect(screen.getByText("25.50")).toBeInTheDocument()
    expect(screen.queryByText(/USD\s*\d/)).not.toBeInTheDocument()
  })

  it("clicking a payout row opens that ticket", () => {
    render(<HelperReportsPage />)
    openPayoutsTab()

    fireEvent.click(screen.getByRole("link", { name: "Open ticket augaaaa" }))

    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/helper/tickets/augaaaa-1111")
  })

  it("clicking the kebab menu trigger does not open the ticket", () => {
    render(<HelperReportsPage />)
    openPayoutsTab()

    fireEvent.click(screen.getByRole("button", { name: "More actions for ticket augaaaa" }))

    expect(push).not.toHaveBeenCalled()
  })

  it("clicking the row checkbox selects the row without opening the ticket", () => {
    render(<HelperReportsPage />)
    openPayoutsTab()

    const checkbox = screen.getByRole("checkbox", { name: "Select payout for ticket augaaaa" })
    fireEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(push).not.toHaveBeenCalled()
  })
})
