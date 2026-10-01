import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Payment, PaymentTransfer } from "@/hooks/usePayments"
import type { ReportDocument } from "@/lib/report-export"

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

const downloadReportPdf = vi.fn((_report: ReportDocument) => Promise.resolve())
vi.mock("@/lib/report-pdf", () => ({
  downloadReportPdf: (report: ReportDocument) => downloadReportPdf(report),
  downloadCsv: vi.fn(),
}))

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
const OTHER_SEP_TICKET = "3333333-sep"
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

const AUG_HELPER = { user_id: "user-aug", user: { name: "Aug Helper", username: null, email: null } }
const SEP_HELPER = { user_id: "user-sep", user: { name: "Sep Helper", username: null, email: null } }

const defaultTransfers = () => [
  transfer({
    id: "pt-aug",
    ticket_id: AUG_TICKET,
    payment_id: "pay-aug",
    helper: AUG_HELPER,
  }),
  transfer({
    id: "pt-aug-project",
    ticket_id: AUG_TICKET,
    payment_id: "pay-aug",
    helper_id: null,
    transfer_user_type: "project",
  }),
]

/** September: "Sep Helper" is paid for two tickets in three transfers, "Aug Helper" for one ticket. */
const sepTransfers = () => [
  transfer({
    id: "pt-sep-1",
    helper_id: "helper-2",
    helper: SEP_HELPER,
    ticket_id: SEP_TICKET,
    payment_id: "pay-sep",
    transfer_id: "tr_sep_1",
    amount_smallest_unit: 2000,
    created_at: "2026-09-03T12:00:00.000Z",
    completed_at: "2026-09-05T12:00:00.000Z",
  }),
  transfer({
    id: "pt-sep-2",
    helper_id: "helper-2",
    helper: SEP_HELPER,
    ticket_id: SEP_TICKET,
    payment_id: "pay-sep-2",
    transfer_id: "tr_sep_2",
    amount_smallest_unit: 500,
    created_at: "2026-09-06T12:00:00.000Z",
    completed_at: "2026-09-07T12:00:00.000Z",
  }),
  transfer({
    id: "pt-sep-3",
    helper_id: "helper-2",
    helper: SEP_HELPER,
    ticket_id: OTHER_SEP_TICKET,
    payment_id: "pay-sep-3",
    transfer_id: "tr_sep_3",
    amount_smallest_unit: 1500,
    created_at: "2026-09-18T12:00:00.000Z",
    completed_at: "2026-09-20T12:00:00.000Z",
  }),
  transfer({
    id: "pt-sep-aug-helper",
    helper: AUG_HELPER,
    ticket_id: SEP_TICKET,
    payment_id: "pay-sep",
    amount_smallest_unit: 700,
    created_at: "2026-09-03T12:00:00.000Z",
    completed_at: "2026-09-05T12:00:00.000Z",
  }),
]

function mockData(payments: Payment[], transfers: PaymentTransfer[] = defaultTransfers()) {
  usePayments.mockReturnValue({ data: payments, isLoading: false })
  usePaymentTransfers.mockReturnValue({ data: transfers, isLoading: false })
}

const monthRow = (period: string) => screen.getByRole("button", { name: `View tickets for ${period}` })
const ticketRow = (shortId: string) => screen.getByRole("link", { name: `Open ticket ${shortId}` })
// The Monthly table also has a "Tickets" sort header; the tab comes first in the document.
const openTicketsTab = () => fireEvent.click(screen.getAllByRole("button", { name: "Tickets" })[0])
const openHelpersTab = () => fireEvent.click(screen.getByRole("button", { name: "Helpers" }))
const helperRow = (helper: string, period: string) => screen.getByRole("button", { name: `Tickets for ${helper}, ${period}` })

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
    downloadReportPdf.mockClear()
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

  describe("Helpers tab", () => {
    beforeEach(() => {
      mockData([sepSecondPayment(), sepPayment(), augPayment()], [...defaultTransfers(), ...sepTransfers()])
    })

    it("has the columns Helper, Date and 'Helper income (USD)', without Ticket ID, Amount or Status", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const headers = screen
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
        .filter((label) => ["Helper", "Date", "Helper income (USD)", "Ticket ID", "Amount", "Status"].includes(label ?? ""))
      expect(headers).toEqual(["Helper", "Date", "Helper income (USD)"])
    })

    it("shows one row per helper and month, dated on the month's last day, with the amount without 'USD'", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const rows = screen.getAllByRole("button", { name: /^Tickets for / })
      expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
        "Tickets for Aug Helper, September 2026",
        "Tickets for Sep Helper, September 2026",
        "Tickets for Aug Helper, August 2026",
      ])

      const sep = helperRow("Sep Helper", "September 2026")
      expect(within(sep).getByText("Sep Helper")).toBeInTheDocument()
      expect(within(sep).getByText("30/09/2026")).toBeInTheDocument()
      expect(within(sep).getByText("40.00")).toBeInTheDocument()
      expect(sep).not.toHaveTextContent("USD")
      expect(sep).not.toHaveTextContent(/Completed|Pending|Failed/)

      const aug = helperRow("Aug Helper", "August 2026")
      expect(within(aug).getByText("31/08/2026")).toBeInTheDocument()
      expect(within(aug).getByText("10.00")).toBeInTheDocument()
    })

    it("only lists helpers with transactions in the chosen month", () => {
      render(<ReportsSupportPage />)
      // Monthly row → Tickets tab filtered to August; the filter carries over to Helpers.
      fireEvent.click(monthRow("August 2026"))
      openHelpersTab()

      expect(helperRow("Aug Helper", "August 2026")).toBeInTheDocument()
      expect(screen.queryByText("Sep Helper")).not.toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: /^Tickets for / })).toHaveLength(1)
    })

    it("says 'x tickets' instead of 'x payouts', also for a single ticket", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      expect(within(helperRow("Sep Helper", "September 2026")).getByRole("button", { name: "2 tickets" })).toBeInTheDocument()
      expect(within(helperRow("Aug Helper", "August 2026")).getByRole("button", { name: "1 ticket" })).toBeInTheDocument()
      expect(screen.queryByText(/payouts?$/)).not.toBeInTheDocument()
    })

    it("clicking the row opens the tickets list with every transaction: ticket ID, date, income and a Receipt button", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const row = helperRow("Sep Helper", "September 2026")
      expect(row).toHaveAttribute("aria-expanded", "false")
      expect(within(row).queryByRole("list")).not.toBeInTheDocument()

      fireEvent.click(row)

      expect(row).toHaveAttribute("aria-expanded", "true")
      expect(push).not.toHaveBeenCalled()
      const lines = within(within(row).getByRole("list")).getAllByRole("listitem")
      // Latest ticket first; a ticket's transactions stay together, oldest first.
      expect(lines.map((line) => within(line).getByRole("link").textContent)).toEqual(["3333333", "2222222", "2222222"])
      expect(within(lines[0]).getByRole("link")).toHaveAttribute("href", `/helper/tickets/${OTHER_SEP_TICKET}`)
      expect(lines[0]).toHaveTextContent("20/09/2026")
      expect(lines[0]).toHaveTextContent("15.00")
      expect(lines[1]).toHaveTextContent("05/09/2026")
      expect(lines[1]).toHaveTextContent("20.00")
      expect(lines[2]).toHaveTextContent("07/09/2026")
      expect(lines[2]).toHaveTextContent("5.00")
      for (const line of lines) {
        expect(within(line).getByRole("button", { name: "Receipt" })).toBeInTheDocument()
        expect(line).not.toHaveTextContent("USD")
        expect(line).not.toHaveTextContent(/Completed|Pending|Failed/)
      }

      // Clicking inside the list keeps it open; clicking the row again closes it.
      fireEvent.click(lines[0])
      expect(row).toHaveAttribute("aria-expanded", "true")
      fireEvent.click(row)
      expect(row).toHaveAttribute("aria-expanded", "false")
    })

    it("the 'x tickets' toggle opens the list too", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const row = helperRow("Aug Helper", "August 2026")
      fireEvent.click(within(row).getByRole("button", { name: "1 ticket" }))

      expect(row).toHaveAttribute("aria-expanded", "true")
      expect(within(within(row).getByRole("list")).getAllByRole("listitem")).toHaveLength(1)
    })

    it("'Receipt' downloads the PDF for that one transaction", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const row = helperRow("Sep Helper", "September 2026")
      fireEvent.click(row)
      const lines = within(within(row).getByRole("list")).getAllByRole("listitem")
      fireEvent.click(within(lines[2]).getByRole("button", { name: "Receipt" }))

      expect(downloadReportPdf).toHaveBeenCalledTimes(1)
      const report = downloadReportPdf.mock.calls[0][0]
      expect(report.period).toBe("Payout tr_sep_2")
      const payouts = report.sections.find((section) => section.heading === "Helper payouts")
      expect(payouts?.rows).toHaveLength(1)
      expect(payouts?.rows[0]).toContain("tr_sep_2")
      // The list stays open.
      expect(row).toHaveAttribute("aria-expanded", "true")
    })

    it("the kebab menu exposes PDF, and opening it does not open the tickets list", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      const kebab = screen.getByRole("button", { name: "More actions for Sep Helper, September 2026" })
      fireEvent.click(kebab)
      expect(helperRow("Sep Helper", "September 2026")).toHaveAttribute("aria-expanded", "false")

      // The open menu hides the rest of the page from the accessibility tree.
      expect(openMenu(kebab)).toEqual(["PDF"])
      expect(screen.queryByRole("list")).not.toBeInTheDocument()
    })

    it("the kebab PDF covers all of the helper's transactions in that month in one document", () => {
      render(<ReportsSupportPage />)
      openHelpersTab()

      openMenu(screen.getByRole("button", { name: "More actions for Sep Helper, September 2026" }))
      fireEvent.click(screen.getByRole("menuitem", { name: "PDF" }))

      expect(downloadReportPdf).toHaveBeenCalledTimes(1)
      const report = downloadReportPdf.mock.calls[0][0]
      expect(report.period).toBe("Sep Helper · September 2026")
      const payouts = report.sections.find((section) => section.heading === "Helper payouts")
      const cells = payouts?.rows.flat() ?? []
      expect(cells).toContain("tr_sep_1")
      expect(cells).toContain("tr_sep_2")
      expect(cells).toContain("tr_sep_3")
      // Only this helper: the other helper's payout on the same ticket is left out.
      expect(cells).not.toContain("Aug Helper")
      expect(payouts?.totals).toContainEqual(["Paid out", "USD 40.00"])
    })
  })
})
