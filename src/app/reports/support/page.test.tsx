import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))
vi.mock("@/hooks/useRealtimePaymentTransfers", () => ({
  useRealtimePaymentTransfers: vi.fn(),
}))
vi.mock("@/hooks/useProject", () => ({
  useProject: () => ({ data: { id: "proj-1", name: "Test project" } }),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import ReportsSupportPage from "./page"

const AUG_TICKET = "1111111-aug"
const SEP_TICKET = "2222222-sep"
const LONG_TITLE = "Cannot deploy my application"
const SHORT_TITLE = "Login bug"

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "p-1",
    project_id: "proj-1",
    ticket_id: "ticket-1",
    amount_smallest_unit: 5000,
    currency: "usd",
    status: "completed",
    amount_platform_smallest_unit: 500,
    amount_project_smallest_unit: 1000,
    amount_helper_smallest_unit: 3500,
    captured_amount_smallest_unit: 5000,
    transaction_id: null,
    created_at: "2026-08-10T12:00:00.000Z",
    completed_at: "2026-08-12T12:00:00.000Z",
    stripe_receipt_url: null,
    ticket: { id: "ticket-1", title: "Ticket" },
    ...overrides,
  }
}

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

const augPayment = () =>
  payment({
    id: "pay-aug",
    ticket_id: AUG_TICKET,
    amount_project_smallest_unit: 1000,
    created_at: "2026-08-10T12:00:00.000Z",
    completed_at: "2026-08-12T12:00:00.000Z",
    stripe_receipt_url: "https://stripe.test/receipt-aug",
    ticket: { id: AUG_TICKET, title: LONG_TITLE },
  })

const sepPayment = () =>
  payment({
    id: "pay-sep",
    ticket_id: SEP_TICKET,
    amount_project_smallest_unit: 2550,
    created_at: "2026-09-03T12:00:00.000Z",
    completed_at: "2026-09-05T12:00:00.000Z",
    ticket: { id: SEP_TICKET, title: SHORT_TITLE },
  })

/** A second charge on the September ticket, so it has 2 charges. */
const sepSecondPayment = () =>
  payment({
    id: "pay-sep-2",
    ticket_id: SEP_TICKET,
    amount_project_smallest_unit: 450,
    created_at: "2026-09-06T12:00:00.000Z",
    completed_at: "2026-09-07T12:00:00.000Z",
    ticket: { id: SEP_TICKET, title: SHORT_TITLE },
  })

function mockData(payments: Payment[]) {
  usePayments.mockReturnValue({ data: payments, isLoading: false })
  usePaymentTransfers.mockReturnValue({
    data: [
      transfer({
        id: "pt-aug",
        ticket_id: AUG_TICKET,
        payment_id: "pay-aug",
        helper: { user_id: "user-aug", user: { name: "Aug Helper", username: null, email: null } },
      }),
      transfer({
        id: "pt-aug-project",
        ticket_id: AUG_TICKET,
        payment_id: "pay-aug",
        helper_id: null,
        transfer_user_type: "project",
      }),
    ],
    isLoading: false,
  })
}

const monthRow = (period: string) => screen.getByRole("button", { name: `View tickets for ${period}` })
const ticketRow = (shortId: string) => screen.getByRole("link", { name: `Open ticket ${shortId}` })
// The Monthly table also has a "Tickets" sort header; the tab comes first in the document.
const openTicketsTab = () => fireEvent.click(screen.getAllByRole("button", { name: "Tickets" })[0])

/** Radix opens the menu on Enter; returns the menu's item labels. */
function openMenu(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: "Enter" })
  const menu = screen.getByRole("menu")
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent?.trim())
}

describe("ReportsSupportPage", () => {
  beforeEach(() => {
    push.mockClear()
    mockData([sepPayment(), augPayment()])
  })

  describe("period filter", () => {
    it("defaults the period dropdown to 'All'", () => {
      render(<ReportsSupportPage />)

      expect(screen.getByRole("combobox")).toHaveTextContent("All")
    })

    it("has no standalone 'All' or 'Current month' buttons", () => {
      render(<ReportsSupportPage />)

      expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Current month" })).not.toBeInTheDocument()
    })
  })

  describe("Monthly reports tab", () => {
    it("clicking a monthly report row opens the Tickets tab filtered to that month", () => {
      render(<ReportsSupportPage />)

      // Monthly tab is the default: one report row per month.
      expect(monthRow("September 2026")).toBeInTheDocument()

      fireEvent.click(monthRow("August 2026"))

      // Now on the Tickets tab (monthly rows are gone) with only August's ticket left.
      expect(screen.queryByRole("button", { name: "View tickets for August 2026" })).not.toBeInTheDocument()
      expect(ticketRow("1111111")).toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "Open ticket 2222222" })).not.toBeInTheDocument()
      expect(screen.getByRole("combobox")).toHaveTextContent("August 2026")
      expect(push).not.toHaveBeenCalled()
    })

    it("shows 'Project income (USD)' and no 'Charged' or 'Payouts & fees' header", () => {
      render(<ReportsSupportPage />)

      expect(screen.getByRole("button", { name: "Project income (USD)" })).toBeInTheDocument()
      expect(screen.queryByText(/Charged/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Payouts & fees/)).not.toBeInTheDocument()
    })

    it("renders amounts without 'USD'", () => {
      render(<ReportsSupportPage />)

      expect(within(monthRow("August 2026")).getByText("10.00")).toBeInTheDocument()
      expect(within(monthRow("September 2026")).getByText("25.50")).toBeInTheDocument()
      expect(monthRow("August 2026")).not.toHaveTextContent("USD")
      expect(monthRow("September 2026")).not.toHaveTextContent("USD")
    })

    it("the kebab menu exposes PDF and CSV, and opening it does not switch tab", () => {
      render(<ReportsSupportPage />)

      const kebab = screen.getByRole("button", { name: "More actions for August 2026" })
      fireEvent.click(kebab)
      expect(monthRow("August 2026")).toBeInTheDocument()

      expect(openMenu(kebab)).toEqual(["PDF", "CSV"])
    })
  })

  describe("Tickets tab", () => {
    it("shows 'Project income (USD)' and no 'Charged' or 'Payouts & fees' header", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      expect(screen.getByRole("button", { name: "Project income (USD)" })).toBeInTheDocument()
      expect(screen.queryByText(/Charged/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Payouts & fees/)).not.toBeInTheDocument()
    })

    it("renders amounts without 'USD'", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      expect(within(ticketRow("1111111")).getByText("10.00")).toBeInTheDocument()
      expect(within(ticketRow("2222222")).getByText("25.50")).toBeInTheDocument()
      expect(ticketRow("1111111")).not.toHaveTextContent("USD")
      expect(ticketRow("2222222")).not.toHaveTextContent("USD")
    })

    it("truncates a title longer than 15 characters to its first 15 characters + '..'", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      expect(LONG_TITLE.length).toBeGreaterThan(15)
      expect(within(ticketRow("1111111")).getByText(`${LONG_TITLE.slice(0, 15)}..`)).toBeInTheDocument()
      expect(screen.queryByText(LONG_TITLE)).not.toBeInTheDocument()
    })

    it("renders a title of 15 characters or fewer unchanged", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      expect(within(ticketRow("2222222")).getByText(SHORT_TITLE)).toBeInTheDocument()
    })

    it("clicking a ticket row navigates to the ticket", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      fireEvent.click(ticketRow("1111111"))

      expect(push).toHaveBeenCalledTimes(1)
      expect(push).toHaveBeenCalledWith(`/helper/tickets/${AUG_TICKET}`)
    })

    it("clicking the kebab does not navigate", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      const kebab = screen.getByRole("button", { name: "More actions for ticket 1111111" })
      fireEvent.click(kebab)
      openMenu(kebab)

      expect(push).not.toHaveBeenCalled()
    })

    it("the kebab menu exposes Receipt and PDF for a ticket with a single charge", () => {
      render(<ReportsSupportPage />)
      openTicketsTab()

      expect(openMenu(screen.getByRole("button", { name: "More actions for ticket 1111111" }))).toEqual(["Receipt", "PDF"])
      expect(screen.getByRole("menuitem", { name: "Receipt" })).toHaveAttribute("href", "https://stripe.test/receipt-aug")
    })

    describe("ticket with 2 charges", () => {
      beforeEach(() => {
        mockData([sepSecondPayment(), sepPayment(), augPayment()])
      })

      it("the kebab menu exposes Receipts and PDF", () => {
        render(<ReportsSupportPage />)
        openTicketsTab()

        expect(openMenu(screen.getByRole("button", { name: "More actions for ticket 2222222" }))).toEqual(["Receipts", "PDF"])
      })

      it("expanded, lists each charge without 'project ·', 'helper ·' or 'fee' split text", () => {
        render(<ReportsSupportPage />)
        openTicketsTab()

        const row = ticketRow("2222222")
        // Total across both charges.
        expect(within(row).getByText("30.00")).toBeInTheDocument()

        const toggle = within(row).getByRole("button", { name: /2 charges/ })
        expect(toggle).toHaveAttribute("aria-expanded", "false")
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute("aria-expanded", "true")

        const charges = within(within(row).getByRole("list")).getAllByRole("listitem")
        expect(charges).toHaveLength(2)
        expect(charges[0]).toHaveTextContent("1 of 2")
        expect(charges[0]).toHaveTextContent("25.50")
        expect(charges[1]).toHaveTextContent("2 of 2")
        expect(charges[1]).toHaveTextContent("4.50")

        expect(row).not.toHaveTextContent(/project ·/i)
        expect(row).not.toHaveTextContent(/helper ·/i)
        expect(row).not.toHaveTextContent(/fee/i)
        expect(row).not.toHaveTextContent("USD")
        // Expanding is not a navigation.
        expect(push).not.toHaveBeenCalled()
      })
    })
  })
})
