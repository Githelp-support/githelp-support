import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import Dashboard from "./page"
import type { DashboardStats } from "@/hooks/useDashboardStats"

// Radix Select relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useUser: vi.fn(),
  useProjectSelection: vi.fn(),
  useProjectRole: vi.fn(),
  useDashboardStats: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))
vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))
vi.mock("@/contexts/project-context", () => ({ useProjectSelection: mocks.useProjectSelection }))
vi.mock("@/hooks/useProjectRole", () => ({ useProjectRole: mocks.useProjectRole }))
vi.mock("@/hooks/useDashboardStats", () => ({ useDashboardStats: mocks.useDashboardStats }))
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

const stats = (
  keyStats: DashboardStats["keyStats"],
  issueTypeStats: DashboardStats["issueTypeStats"] = [],
): DashboardStats => ({
  helperStats: [
    { id: "h1", helper_id: "h1", name: "Alice", initial: "A", tickets: 2, time: "1h 30m", color: "#eee", category: "core" },
  ],
  issueTypeStats,
  keyStats,
})

// Stats per period, keyed by the `targetMonth` the page derives from the
// select (null = "All").
const STATS_BY_PERIOD: Record<string, DashboardStats> = {
  all: stats({ totalTicketsSolved: 12, totalTimeSpent: "10h 15m", percentageSolved: 75 }, [
    { name: "Bug", tickets: 8, time: "6h", applied: true },
    { name: "Question", tickets: 4, time: "4h 15m", applied: false },
  ]),
  "September 2026": stats({ totalTicketsSolved: 3, totalTimeSpent: "2h 45m", percentageSolved: 60 }),
  "July 2026": stats({ totalTicketsSolved: 1, totalTimeSpent: "0h 20m", percentageSolved: 50 }),
}

const statValue = (label: string) =>
  screen.getByText(label).closest('[data-slot="card-content"]')?.lastElementChild

const periodSelect = () => screen.getByRole("combobox")

const openPeriodSelect = () => fireEvent.keyDown(periodSelect(), { key: "ArrowDown" })

const choosePeriod = (label: string) => {
  openPeriodSelect()
  fireEvent.click(screen.getByRole("option", { name: label }))
}

describe("Dashboard (admin Overview)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 15, 12))

    mocks.replace.mockReset()
    mocks.useUser.mockReturnValue({ user: { id: "user-1" }, isLoading: false })
    mocks.useProjectSelection.mockReturnValue({ selectedProjectId: "project-1" })
    mocks.useProjectRole.mockReturnValue({ data: "admin", isLoading: false, isFetching: false })
    mocks.useDashboardStats.mockImplementation((_projectId?: string, targetMonth: string | null = null) => ({
      data: STATS_BY_PERIOD[targetMonth ?? "all"] ?? stats({ totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 }),
      isLoading: false,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the 'Choose period' select with All, Current month and the last 12 months", () => {
    render(<Dashboard />)

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(periodSelect()).toHaveTextContent("All")

    // The old three-control filter is gone.
    expect(screen.queryByRole("button", { name: "Current month" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "All time" })).not.toBeInTheDocument()
    expect(screen.queryByText("Choose month")).not.toBeInTheDocument()

    openPeriodSelect()

    const optionLabels = screen.getAllByRole("option").map((option) => option.textContent)
    expect(optionLabels).toEqual([
      "All",
      "Current month",
      "September 2026",
      "August 2026",
      "July 2026",
      "June 2026",
      "May 2026",
      "April 2026",
      "March 2026",
      "February 2026",
      "January 2026",
      "December 2025",
      "November 2025",
      "October 2025",
    ])
  })

  it("labels the Issue types name column 'Type' but keeps 'Name' in the Helpers table", () => {
    render(<Dashboard />)

    expect(screen.getByText("Type")).toBeInTheDocument()
    expect(screen.getAllByText("Name")).toHaveLength(1)

    const issueHeaderRow = screen.getByText("Type").parentElement!
    expect(Array.from(issueHeaderRow.children).map((cell) => cell.textContent)).toEqual([
      "Type",
      "No of tickets",
      "Total time",
    ])
    expect(screen.getByText("Issue types (2)")).toBeInTheDocument()
    expect(screen.getByText("Bug")).toBeInTheDocument()
  })

  it("shows all-time key stats by default and passes no period to the stats hook", () => {
    render(<Dashboard />)

    expect(mocks.useDashboardStats).toHaveBeenLastCalledWith("project-1", null)
    expect(statValue("Number of tickets solved")).toHaveTextContent("12")
    expect(statValue("Total time spent")).toHaveTextContent("10h 15m")
    expect(statValue("Percentage solved")).toHaveTextContent("75%")
  })

  it("updates the key stats when 'Current month' is selected", () => {
    render(<Dashboard />)

    choosePeriod("Current month")

    expect(periodSelect()).toHaveTextContent("Current month")
    expect(mocks.useDashboardStats).toHaveBeenLastCalledWith("project-1", "September 2026")
    expect(statValue("Number of tickets solved")).toHaveTextContent("3")
    expect(statValue("Total time spent")).toHaveTextContent("2h 45m")
    expect(statValue("Percentage solved")).toHaveTextContent("60%")
  })

  it("updates the key stats when a specific month is selected", () => {
    render(<Dashboard />)

    choosePeriod("July 2026")

    expect(periodSelect()).toHaveTextContent("July 2026")
    expect(mocks.useDashboardStats).toHaveBeenLastCalledWith("project-1", "July 2026")
    expect(statValue("Number of tickets solved")).toHaveTextContent("1")
    expect(statValue("Total time spent")).toHaveTextContent("0h 20m")
    expect(statValue("Percentage solved")).toHaveTextContent("50%")
  })

  it("redirects non-admins instead of rendering the admin dashboard", () => {
    mocks.useProjectRole.mockReturnValue({ data: "helper", isLoading: false, isFetching: false })

    render(<Dashboard />)

    expect(mocks.replace).toHaveBeenCalledWith("/helper/overview")
    expect(screen.getByText("Loading…")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
