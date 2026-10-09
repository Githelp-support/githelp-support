import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import HelperOverviewPage from "./page"
import type { HelperDashboardStats } from "@/hooks/useHelperDashboardStats"
import type { HelperRecentTicketInteraction } from "@/hooks/useHelperRecentTicketInteractions"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

const mocks = vi.hoisted(() => ({
  useProjectSelection: vi.fn(),
  useUser: vi.fn(),
  useCurrentHelper: vi.fn(),
  useHelperDashboardStats: vi.fn(),
  useHelperRecentTicketInteractions: vi.fn(),
}))

vi.mock("@/contexts/project-context", () => ({ useProjectSelection: mocks.useProjectSelection }))
vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))
vi.mock("@/hooks/useHelperRecentTicketInteractions", () => ({
  useHelperRecentTicketInteractions: mocks.useHelperRecentTicketInteractions,
}))
vi.mock("@/hooks/useCurrentHelper", () => ({ useCurrentHelper: mocks.useCurrentHelper }))
vi.mock("@/hooks/useHelperDashboardStats", () => ({
  useHelperDashboardStats: mocks.useHelperDashboardStats,
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

const completedTicket = (
  id: string,
  created_at: string,
  completed_at: string | null,
): HelperDashboardStats["completedTickets"][number] => ({ id, created_at, completed_at })

const stats = (): HelperDashboardStats => ({
  keyStats: { totalTicketsSolved: 4, totalTimeSpent: "12h 30m", percentageSolved: 80 },
  issueTypeStats: [
    { name: "Bug", tickets: 3, time: "8h 00m", applied: true },
    { name: "Feature", tickets: 1, time: "4h 30m", applied: false },
  ],
  inProgressTickets: [
    { id: "p1", title: "Ticket p1", status: "in-progress", priority: "high", created_at: iso(2026, 8, 14, 12) },
  ],
  completedTickets: [
    completedTicket("c1", iso(2026, 8, 10, 12), iso(2026, 8, 12, 12)),
    // Created in August but completed in September: counts for September
    // (period filtering is by completed_at, not created_at).
    completedTicket("c2", iso(2026, 7, 20, 12), iso(2026, 8, 2, 12)),
    completedTicket("c3", iso(2026, 7, 1, 12), iso(2026, 7, 5, 12)),
    completedTicket("c4", iso(2026, 5, 15, 12), iso(2026, 6, 1, 12)),
  ],
})

const recentTicket = (
  overrides: Partial<HelperRecentTicketInteraction> & Pick<HelperRecentTicketInteraction, "id">,
): HelperRecentTicketInteraction => ({
  title: `Ticket ${overrides.id}`,
  project_id: "project-1",
  project_name: "Acme",
  project_logo_url: null,
  status: "Claimed",
  creator: null,
  message_count: 3,
  has_unread: false,
  last_interaction_at: iso(2026, 8, 14, 9, 5),
  ...overrides,
})

const statValue = (label: string) =>
  screen.getByText(label).closest('[data-slot="card-content"]')?.lastElementChild

const periodSelect = () => screen.getByRole("combobox")

const choosePeriod = (label: string) => {
  fireEvent.keyDown(periodSelect(), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: label }))
}

describe("HelperOverviewPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 15, 12))

    mocks.useProjectSelection.mockReturnValue({ selectedProjectId: "project-1" })
    mocks.useCurrentHelper.mockReturnValue({ data: "helper-1" })
    mocks.useHelperDashboardStats.mockReturnValue({ data: stats(), isLoading: false })
    mocks.useUser.mockReturnValue({ user: { id: "user-1" }, isLoading: false })
    mocks.useHelperRecentTicketInteractions.mockReturnValue({ data: [], isLoading: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the header with 'All' selected and counts every completed ticket", () => {
    render(<HelperOverviewPage />)

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(periodSelect()).toHaveTextContent("All")
    expect(statValue("Number of tickets solved")).toHaveTextContent("4")
  })

  it("scopes the hook to the selected project and current helper", () => {
    render(<HelperOverviewPage />)

    expect(mocks.useCurrentHelper).toHaveBeenCalledWith("project-1")
    expect(mocks.useHelperDashboardStats).toHaveBeenCalledWith("project-1", "helper-1")
  })

  it("restricts tickets solved to those completed in the current month (by completed_at)", () => {
    render(<HelperOverviewPage />)

    choosePeriod("Current month")

    expect(periodSelect()).toHaveTextContent("Current month")
    // c1 and c2 were completed in September; c2 was created in August.
    expect(statValue("Number of tickets solved")).toHaveTextContent("2")
  })

  it("restricts tickets solved to a specific past month when chosen", () => {
    render(<HelperOverviewPage />)

    choosePeriod("August 2026")
    expect(periodSelect()).toHaveTextContent("August 2026")
    // c3 only: c2 was created in August but completed in September.
    expect(statValue("Number of tickets solved")).toHaveTextContent("1")

    choosePeriod("July 2026")
    expect(periodSelect()).toHaveTextContent("July 2026")
    expect(statValue("Number of tickets solved")).toHaveTextContent("1")

    choosePeriod("June 2026")
    expect(statValue("Number of tickets solved")).toHaveTextContent("0")
  })

  it("no longer renders the old 'All time' / 'Choose month' buttons", () => {
    render(<HelperOverviewPage />)

    expect(screen.queryByRole("button", { name: "All time" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Choose month" })).not.toBeInTheDocument()
    expect(screen.queryByText("All time")).not.toBeInTheDocument()
    expect(screen.queryByText("Choose month")).not.toBeInTheDocument()
  })

  it("labels the Issue types header as Type, No of tickets and Total time", () => {
    render(<HelperOverviewPage />)

    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "No of tickets" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Total time" })).toBeInTheDocument()
    expect(screen.queryByText("Name")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument()
  })

  it("renders the hook's total time spent and percentage solved unchanged", () => {
    render(<HelperOverviewPage />)

    expect(statValue("Total time spent")).toHaveTextContent("12h 30m")
    expect(statValue("Percentage solved")).toHaveTextContent("80%")

    choosePeriod("Current month")

    expect(statValue("Total time spent")).toHaveTextContent("12h 30m")
    expect(statValue("Percentage solved")).toHaveTextContent("80%")
  })

  describe("Recent tickets", () => {
    it("requests at most 5 recent tickets for the signed-in user", () => {
      render(<HelperOverviewPage />)

      expect(mocks.useHelperRecentTicketInteractions).toHaveBeenCalledWith("user-1", 5)
    })

    it("renders the returned tickets with project name, title, status and helper chat link", () => {
      mocks.useHelperRecentTicketInteractions.mockReturnValue({
        data: [
          recentTicket({ id: "r1", title: "Login broken", project_name: "Acme", status: "Completed" }),
          recentTicket({ id: "r2", title: "Billing question", project_name: "Globex", status: "Unclaimed" }),
        ],
        isLoading: false,
      })

      render(<HelperOverviewPage />)

      expect(screen.getByRole("heading", { name: "Recent tickets" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View all tickets" })).toHaveAttribute("href", "/tickets")

      const rows = screen.getAllByRole("link", { name: /messages/ })
      expect(rows).toHaveLength(2)

      expect(rows[0]).toHaveAttribute("href", "/helper/tickets/r1")
      expect(rows[0]).toHaveTextContent("Acme")
      expect(rows[0]).toHaveTextContent("Login broken")
      expect(rows[0]).toHaveTextContent("Completed")
      expect(rows[0]).toHaveTextContent("14.09.2026")
      expect(rows[0]).toHaveTextContent("09:05")

      expect(rows[1]).toHaveAttribute("href", "/helper/tickets/r2")
      expect(rows[1]).toHaveTextContent("Globex")
      expect(rows[1]).toHaveTextContent("Billing question")
      expect(rows[1]).toHaveTextContent("Unclaimed")
    })

    it("highlights unread rows in purple with the comments icon; read rows have neither", () => {
      mocks.useHelperRecentTicketInteractions.mockReturnValue({
        data: [
          recentTicket({ id: "unread", title: "Unread ticket", has_unread: true }),
          recentTicket({ id: "read", title: "Read ticket", has_unread: false }),
        ],
        isLoading: false,
      })

      render(<HelperOverviewPage />)

      const unreadRow = screen.getByText("Unread ticket").closest("a")
      const readRow = screen.getByText("Read ticket").closest("a")

      expect(unreadRow).toHaveClass("bg-purple-50")
      expect(unreadRow).toHaveClass("hover:bg-purple-100")
      expect(unreadRow).not.toHaveClass("hover:bg-muted/50")
      const icon = unreadRow?.querySelector("i.fi-rr-comments")
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute("aria-label", "Unread messages")
      expect(icon).toHaveClass("text-brand-primary")

      expect(readRow).not.toHaveClass("bg-purple-50")
      expect(readRow).toHaveClass("hover:bg-muted/50")
      expect(readRow?.querySelector("i.fi-rr-comments")).toBeNull()
    })

    it("shows the empty state when there are no recent tickets", () => {
      render(<HelperOverviewPage />)

      expect(screen.getByText("No tickets to show")).toBeInTheDocument()
      expect(screen.queryByRole("link", { name: /messages/ })).not.toBeInTheDocument()
    })

    it("shows a loading state while recent tickets are fetched", () => {
      mocks.useHelperRecentTicketInteractions.mockReturnValue({ data: undefined, isLoading: true })

      render(<HelperOverviewPage />)

      expect(screen.getByText("Loading your tickets...")).toBeInTheDocument()
      expect(screen.queryByText("No tickets to show")).not.toBeInTheDocument()
    })
  })
})
