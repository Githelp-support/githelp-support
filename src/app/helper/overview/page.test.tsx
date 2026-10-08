import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import HelperOverviewPage from "./page"
import type { HelperDashboardStats } from "@/hooks/useHelperDashboardStats"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

const mocks = vi.hoisted(() => ({
  useProjectSelection: vi.fn(),
  useCurrentHelper: vi.fn(),
  useHelperDashboardStats: vi.fn(),
}))

vi.mock("@/contexts/project-context", () => ({ useProjectSelection: mocks.useProjectSelection }))
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
})
