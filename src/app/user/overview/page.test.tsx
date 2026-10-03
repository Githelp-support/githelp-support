import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import UserOverviewPage from "./page"
import type { RecentTicketInteraction } from "@/hooks/useUserRecentTicketInteractions"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  useUserTickets: vi.fn(),
  useUserPayments: vi.fn(),
  useUserRecentTicketInteractions: vi.fn(),
}))

vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))
vi.mock("@/hooks/useTicketsWithDetails", () => ({ useUserTickets: mocks.useUserTickets }))
vi.mock("@/hooks/usePayments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/usePayments")>()),
  useUserPayments: mocks.useUserPayments,
}))
vi.mock("@/hooks/useUserRecentTicketInteractions", () => ({
  useUserRecentTicketInteractions: mocks.useUserRecentTicketInteractions,
}))
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => <nav data-testid="sidebar" /> }))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}))

const iso = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString()

const ticket = (id: string, status: string, created_at: string, completed_at: string | null = null) => ({
  id,
  title: `Ticket ${id}`,
  description: "",
  status,
  priority: "medium",
  created_at,
  completed_at,
  created_by: "user-1",
  project_id: "project-1",
  project_name: "Acme",
})

const payment = (id: string, status: string, amount: number, created_at: string) => ({
  id,
  ticket_id: "t1",
  project_id: "project-1",
  status,
  currency: "usd",
  created_at,
  completed_at: status === "completed" ? created_at : null,
  amount_smallest_unit: amount,
  authorized_amount_smallest_unit: null,
  captured_amount_smallest_unit: status === "completed" ? amount : null,
  ticket: { id: "t1", title: "Ticket t1", project_id: "project-1", project: { name: "Acme" } },
})

const recentTicket = (
  id: string,
  project_id: string,
  status: RecentTicketInteraction["status"],
  last_interaction_at: string,
): RecentTicketInteraction => ({
  id,
  title: `Ticket ${id}`,
  project_id,
  project_name: project_id === "project-1" ? "Acme" : "Beta",
  project_logo_url: null,
  status,
  helper: null,
  message_count: 3,
  last_interaction_at,
})

const statValue = (label: string) =>
  screen.getByText(label).closest('[data-slot="card-content"]')?.lastElementChild

const periodSelect = () => screen.getByRole("combobox")

const choosePeriod = (label: string) => {
  fireEvent.keyDown(periodSelect(), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: label }))
}

const recentTicketLinks = () =>
  screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/support/chat"))

describe("UserOverviewPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 15, 12))

    mocks.useUser.mockReturnValue({ user: { id: "user-1" }, isLoading: false })
    mocks.useUserTickets.mockReturnValue({
      data: [
        ticket("t1", "completed", iso(2026, 8, 10, 12), iso(2026, 8, 12, 12)),
        ticket("t2", "in-progress", iso(2026, 8, 5, 12)),
        // Created in August but completed in September: counts as completed
        // this month, not as a ticket created this month.
        ticket("t3", "completed", iso(2026, 7, 20, 12), iso(2026, 8, 2, 12)),
        ticket("t4", "completed", iso(2026, 6, 15, 12), iso(2026, 7, 1, 12)),
      ],
      isLoading: false,
    })
    mocks.useUserPayments.mockReturnValue({
      data: [
        payment("p1", "completed", 2500, iso(2026, 8, 10, 12)),
        payment("p2", "authorized", 9900, iso(2026, 8, 11, 12)),
        payment("p3", "completed", 1000, iso(2026, 7, 20, 12)),
      ],
      isLoading: false,
    })
    mocks.useUserRecentTicketInteractions.mockReturnValue({
      data: [
        recentTicket("t2", "project-2", "Claimed", iso(2026, 8, 14, 9, 5)),
        recentTicket("t1", "project-1", "Completed", iso(2026, 8, 12, 16, 30)),
      ],
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the header title with 'All' selected and key stats for every period", () => {
    render(<UserOverviewPage />)

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(periodSelect()).toHaveTextContent("All")
    expect(statValue("Number of tickets")).toHaveTextContent("4")
    expect(statValue("Tickets completed")).toHaveTextContent("3")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 35.00")
  })

  it("restricts key stats to the current month when chosen in the period select", () => {
    render(<UserOverviewPage />)

    choosePeriod("Current month")

    expect(periodSelect()).toHaveTextContent("Current month")
    expect(statValue("Number of tickets")).toHaveTextContent("2")
    expect(statValue("Tickets completed")).toHaveTextContent("2")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 25.00")
  })

  it("shows only the Ticket, Status and Last interaction columns", () => {
    render(<UserOverviewPage />)

    const headerRow = screen.getByText("Ticket").parentElement!
    expect(Array.from(headerRow.children).map((cell) => cell.textContent)).toEqual([
      "Ticket",
      "Status",
      "Last interaction",
    ])
    expect(screen.queryByText("Project")).not.toBeInTheDocument()
    expect(screen.queryByText("Created")).not.toBeInTheDocument()
  })

  it("lists recent tickets in the hook's order with formatted last-interaction times", () => {
    render(<UserOverviewPage />)

    const rows = recentTicketLinks()
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/support/chat?ticket=t2&project=project-2",
      "/support/chat?ticket=t1&project=project-1",
    ])

    expect(within(rows[0]).getByText("Ticket t2")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Beta")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Claimed")).toBeInTheDocument()
    expect(within(rows[0]).getByText("14.09.2026")).toBeInTheDocument()
    expect(within(rows[0]).getByText("09:05")).toBeInTheDocument()

    expect(within(rows[1]).getByText("Ticket t1")).toBeInTheDocument()
    expect(within(rows[1]).getByText("Acme")).toBeInTheDocument()
    expect(within(rows[1]).getByText("Completed")).toBeInTheDocument()
    expect(within(rows[1]).getByText("12.09.2026")).toBeInTheDocument()
    expect(within(rows[1]).getByText("16:30")).toBeInTheDocument()
  })

  it("links to the full ticket list", () => {
    render(<UserOverviewPage />)

    expect(screen.getByRole("link", { name: "View all tickets" })).toHaveAttribute(
      "href",
      "/support/tickets",
    )
  })

  it("shows an empty state when the user has no tickets", () => {
    mocks.useUserTickets.mockReturnValue({ data: [], isLoading: false })
    mocks.useUserPayments.mockReturnValue({ data: [], isLoading: false })
    mocks.useUserRecentTicketInteractions.mockReturnValue({ data: [], isLoading: false })

    render(<UserOverviewPage />)

    expect(screen.getByText("No tickets to show")).toBeInTheDocument()
    expect(statValue("Number of tickets")).toHaveTextContent("0")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 0.00")
  })

  it("prompts signed-out visitors to sign in", () => {
    mocks.useUser.mockReturnValue({ user: { id: "" }, isLoading: false })
    mocks.useUserTickets.mockReturnValue({ data: undefined, isLoading: false })
    mocks.useUserPayments.mockReturnValue({ data: undefined, isLoading: false })
    mocks.useUserRecentTicketInteractions.mockReturnValue({ data: undefined, isLoading: false })

    render(<UserOverviewPage />)

    expect(screen.getByText("Sign in to see your tickets")).toBeInTheDocument()
  })
})
