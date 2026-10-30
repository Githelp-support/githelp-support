import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import type { Database } from "@/types/database"

type Ticket = Database["public"]["Tables"]["tickets"]["Row"]

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const useHelper = vi.fn()
vi.mock("@/hooks/useHelpers", () => ({
  useHelper: (helperId: string) => useHelper(helperId),
}))

const useHelperTickets = vi.fn()
vi.mock("@/hooks/useHelperTickets", () => ({
  useHelperTickets: (helperId: string, projectId?: string) => useHelperTickets(helperId, projectId),
}))

const useTimeEntries = vi.fn()
vi.mock("@/hooks/useTimeEntries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useTimeEntries")>()
  return {
    ...actual,
    useTimeEntries: (filters?: unknown) => useTimeEntries(filters),
  }
})

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
vi.mock("@/components/layout/header", () => ({
  Header: ({ title, aboveTitle }: { title: string; aboveTitle?: ReactNode }) => (
    <header>
      {aboveTitle}
      <h1>{title}</h1>
    </header>
  ),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import HelperProfilePage from "./page"

const HELPER_ID = "helper-1"

const COMPLETED_TICKET = "1111111-completed"
const IN_PROGRESS_TICKET = "2222222-in-progress"
const CLAIMED_TICKET = "3333333-claimed"
const AVAILABLE_TICKET = "4444444-available"
const CANCELLED_TICKET = "5555555-cancelled"
const AUG_TICKET = "6666666-aug"

/** Already settled so React's `use(params)` reads it synchronously instead of suspending. */
function params(id: string): Promise<{ id: string }> {
  return Object.assign(Promise.resolve({ id }), { status: "fulfilled", value: { id } })
}

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: COMPLETED_TICKET,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-02T12:00:00.000Z",
    deleted_at: null,
    completed_at: null,
    cancelled_at: null,
    first_response_at: null,
    end_requested_at: null,
    end_requested_by: null,
    time_review_requested_at: null,
    time_review_requested_by: null,
    project_id: "proj-1",
    created_by: "user-1",
    title: "Ticket",
    description: "",
    status: "completed",
    priority: "medium",
    sla_id: null,
    success: true,
    guest: false,
    ...overrides,
  }
}

function transfer(overrides: Partial<PaymentTransfer> = {}): PaymentTransfer {
  return {
    id: "t-1",
    project_id: "proj-1",
    helper_id: HELPER_ID,
    ticket_id: COMPLETED_TICKET,
    transfer_user_type: "helper",
    status: "completed",
    amount_smallest_unit: 1000,
    currency: "usd",
    transfer_id: null,
    created_at: "2026-09-10T12:00:00.000Z",
    completed_at: "2026-09-12T12:00:00.000Z",
    ...overrides,
  }
}

/** One ticket per status, all in September 2026. */
const allStatusTickets = () => [
  ticket({ id: COMPLETED_TICKET, title: "Completed ticket", status: "completed", completed_at: "2026-09-05T12:00:00.000Z" }),
  ticket({ id: IN_PROGRESS_TICKET, title: "In progress ticket", status: "in-progress" }),
  ticket({ id: CLAIMED_TICKET, title: "Claimed ticket", status: "claimed" }),
  ticket({ id: AVAILABLE_TICKET, title: "Available ticket", status: "available" }),
  ticket({ id: CANCELLED_TICKET, title: "Cancelled ticket", status: "cancelled", cancelled_at: "2026-09-06T12:00:00.000Z" }),
]

/** A completed ticket that closed in August 2026. */
const augTicket = () =>
  ticket({
    id: AUG_TICKET,
    title: "August ticket",
    status: "completed",
    created_at: "2026-08-01T12:00:00.000Z",
    completed_at: "2026-08-20T12:00:00.000Z",
  })

/** The completed ticket paid out in two transfers: one received, one still pending. */
const twoTransfers = () => [
  transfer({
    id: "pt-1",
    ticket_id: COMPLETED_TICKET,
    payment_id: "pay-1",
    status: "completed",
    amount_smallest_unit: 1000,
    created_at: "2026-09-10T12:00:00.000Z",
    completed_at: "2026-09-12T12:00:00.000Z",
  }),
  transfer({
    id: "pt-2",
    ticket_id: COMPLETED_TICKET,
    payment_id: "pay-2",
    status: "pending",
    amount_smallest_unit: 500,
    created_at: "2026-09-14T12:00:00.000Z",
    completed_at: null,
  }),
]

function mockData({
  tickets = allStatusTickets(),
  transfers = [],
  payments = [],
}: { tickets?: Ticket[]; transfers?: PaymentTransfer[]; payments?: Payment[] } = {}) {
  useHelper.mockReturnValue({
    data: {
      helper_id: HELPER_ID,
      user_id: "user-helper",
      project_id: "proj-1",
      category: "Community",
      deleted_at: null,
      user: { name: "Test Helper", username: "testhelper", email: "helper@test.dev" },
    },
    isLoading: false,
  })
  useHelperTickets.mockReturnValue({ data: tickets, isLoading: false })
  useTimeEntries.mockReturnValue({ data: [], isLoading: false })
  usePaymentTransfers.mockReturnValue({ data: transfers, isLoading: false })
  usePayments.mockReturnValue({ data: payments, isLoading: false })
}

const renderPage = () => render(<HelperProfilePage params={params(HELPER_ID)} />)

const ticketRow = (shortId: string) => screen.getByRole("button", { name: `Transactions for ticket ${shortId}` })
const queryTicketRow = (shortId: string) => screen.queryByRole("button", { name: `Transactions for ticket ${shortId}` })

const periodSelect = () => screen.getByRole("combobox")
const openPeriodSelect = () => fireEvent.keyDown(periodSelect(), { key: "ArrowDown" })
const choosePeriod = (label: string) => {
  openPeriodSelect()
  fireEvent.click(screen.getByRole("option", { name: label }))
}

describe("HelperProfilePage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 15, 12))
    push.mockClear()
    mockData()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a 'Helpers' back link to /helpers above the 'Helper Details' heading", () => {
    renderPage()

    const back = screen.getByRole("link", { name: "Helpers" })
    expect(back).toHaveAttribute("href", "/helpers")

    const heading = screen.getByRole("heading", { level: 1, name: "Helper Details" })
    expect(heading.closest("header")).toContainElement(back)
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("labels the amount column 'Helper income (USD)' and shows USD amounts without the prefix", () => {
    mockData({ tickets: [allStatusTickets()[0]], transfers: [transfer({ amount_smallest_unit: 1234 })] })
    renderPage()

    expect(screen.getByRole("button", { name: "Helper income (USD)" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Amount" })).not.toBeInTheDocument()
    expect(within(ticketRow("1111111")).getByText("12.34")).toBeInTheDocument()
  })

  describe("ticket statuses", () => {
    it("lists completed, in-progress and claimed tickets", () => {
      renderPage()

      expect(ticketRow("1111111")).toBeInTheDocument()
      expect(ticketRow("2222222")).toBeInTheDocument()
      expect(ticketRow("3333333")).toBeInTheDocument()
      expect(within(ticketRow("1111111")).getByText("Completed")).toBeInTheDocument()
      expect(within(ticketRow("2222222")).getByText("In progress")).toBeInTheDocument()
      expect(within(ticketRow("3333333")).getByText("Claimed")).toBeInTheDocument()
    })

    it("does not list available or cancelled tickets", () => {
      renderPage()

      expect(queryTicketRow("4444444")).not.toBeInTheDocument()
      expect(queryTicketRow("5555555")).not.toBeInTheDocument()
      expect(screen.queryByText("Available ticket")).not.toBeInTheDocument()
      expect(screen.queryByText("Cancelled ticket")).not.toBeInTheDocument()
    })
  })

  describe("period filter", () => {
    beforeEach(() => {
      mockData({ tickets: [...allStatusTickets(), augTicket()] })
    })

    it("has a period select defaulting to 'All' with a 'Current month' option", () => {
      renderPage()

      expect(periodSelect()).toHaveTextContent("All")

      openPeriodSelect()
      expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Current month" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "September 2026" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "August 2026" })).toBeInTheDocument()
    })

    it("selecting a month hides tickets outside it", () => {
      renderPage()

      // All: both months listed.
      expect(ticketRow("1111111")).toBeInTheDocument()
      expect(ticketRow("6666666")).toBeInTheDocument()

      choosePeriod("August 2026")

      expect(periodSelect()).toHaveTextContent("August 2026")
      expect(ticketRow("6666666")).toBeInTheDocument()
      expect(queryTicketRow("1111111")).not.toBeInTheDocument()
      expect(queryTicketRow("2222222")).not.toBeInTheDocument()
      expect(queryTicketRow("3333333")).not.toBeInTheDocument()
    })

    it("'Current month' shows only this month's tickets", () => {
      renderPage()

      choosePeriod("Current month")

      expect(ticketRow("1111111")).toBeInTheDocument()
      expect(queryTicketRow("6666666")).not.toBeInTheDocument()
    })
  })

  describe("ticket with two transfers", () => {
    beforeEach(() => {
      mockData({ tickets: [allStatusTickets()[0]], transfers: twoTransfers() })
    })

    it("shows 'Completed' on the row and 'Received' / 'Pending' per payout when expanded", () => {
      renderPage()

      const row = ticketRow("1111111")
      expect(within(row).getByText("Completed")).toBeInTheDocument()
      // Sum of both payouts.
      expect(within(row).getByText("15.00")).toBeInTheDocument()
      expect(within(row).queryByText("Received")).not.toBeInTheDocument()
      expect(within(row).queryByText("Pending")).not.toBeInTheDocument()

      const toggle = within(row).getByRole("button", { name: "2 payouts" })
      expect(toggle).toHaveAttribute("aria-expanded", "false")
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute("aria-expanded", "true")

      const payouts = within(within(row).getByRole("list")).getAllByRole("listitem")
      expect(payouts).toHaveLength(2)
      expect(payouts[0]).toHaveTextContent("1 of 2")
      expect(payouts[0]).toHaveTextContent("10.00")
      expect(within(payouts[0]).getByText("Received")).toBeInTheDocument()
      expect(payouts[1]).toHaveTextContent("2 of 2")
      expect(payouts[1]).toHaveTextContent("5.00")
      expect(within(payouts[1]).getByText("Pending")).toBeInTheDocument()

      // The row keeps its own status.
      expect(within(row).getByText("Completed")).toBeInTheDocument()
      // Expanding is not a navigation.
      expect(push).not.toHaveBeenCalled()
    })

    it("tapping the row shows the ticket's transactions, as on Reports → Helpers", () => {
      renderPage()

      const row = ticketRow("1111111")
      expect(row).toHaveAttribute("aria-expanded", "false")
      expect(within(row).queryByRole("list")).not.toBeInTheDocument()

      fireEvent.click(row)

      expect(row).toHaveAttribute("aria-expanded", "true")
      expect(within(within(row).getByRole("list")).getAllByRole("listitem")).toHaveLength(2)
      expect(push).not.toHaveBeenCalled()

      fireEvent.click(row)
      expect(row).toHaveAttribute("aria-expanded", "false")
      expect(within(row).queryByRole("list")).not.toBeInTheDocument()
    })

    it("Enter and Space on a focused row toggle its transactions", () => {
      renderPage()

      const row = ticketRow("1111111")
      fireEvent.keyDown(row, { key: "Enter" })
      expect(row).toHaveAttribute("aria-expanded", "true")
      fireEvent.keyDown(row, { key: " " })
      expect(row).toHaveAttribute("aria-expanded", "false")
    })

    it("the kebab menu's 'See transactions' opens the list and the Ticket ID still links to the ticket", () => {
      renderPage()

      const row = ticketRow("1111111")
      expect(within(row).getByRole("link", { name: "1111111" })).toHaveAttribute("href", `/helper/tickets/${COMPLETED_TICKET}`)

      // Radix opens the menu on Enter; the kebab must not toggle the row.
      const kebab = within(row).getByRole("button", { name: "More actions for ticket 1111111" })
      fireEvent.click(kebab)
      expect(row).toHaveAttribute("aria-expanded", "false")
      fireEvent.keyDown(kebab, { key: "Enter" })
      fireEvent.click(screen.getByRole("menuitem", { name: "See transactions" }))
      expect(row).toHaveAttribute("aria-expanded", "true")
      expect(push).not.toHaveBeenCalled()
    })
  })

  describe("ticket with a single transfer", () => {
    it("tapping the row shows that one transaction", () => {
      mockData({ tickets: [allStatusTickets()[0]], transfers: [transfer()] })
      renderPage()

      const row = ticketRow("1111111")
      expect(within(row).queryByRole("button", { name: /payout/ })).not.toBeInTheDocument()

      fireEvent.click(row)

      const payouts = within(within(row).getByRole("list")).getAllByRole("listitem")
      expect(payouts).toHaveLength(1)
      expect(payouts[0]).toHaveTextContent("1 of 1")
      expect(within(payouts[0]).getByText("Received")).toBeInTheDocument()
    })
  })

  describe("ticket without transfers", () => {
    it("tapping the row explains that there are no transactions yet", () => {
      mockData({ tickets: [allStatusTickets()[1]], transfers: [] })
      renderPage()

      const row = ticketRow("2222222")
      fireEvent.click(row)

      expect(within(row).getByText("No transactions for this ticket yet.")).toBeInTheDocument()
    })
  })
})
