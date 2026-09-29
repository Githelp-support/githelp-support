import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import UserOverviewPage from "./page"

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  useUserTickets: vi.fn(),
  useUserPayments: vi.fn(),
}))

vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))
vi.mock("@/hooks/useTicketsWithDetails", () => ({ useUserTickets: mocks.useUserTickets }))
vi.mock("@/hooks/usePayments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/usePayments")>()),
  useUserPayments: mocks.useUserPayments,
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

const ticket = (id: string, status: string, created_at: string) => ({
  id,
  title: `Ticket ${id}`,
  description: "",
  status,
  priority: "medium",
  created_at,
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

const statValue = (label: string) =>
  screen.getByText(label).closest('[data-slot="card-content"]')?.lastElementChild

describe("UserOverviewPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 15, 12))

    mocks.useUser.mockReturnValue({ user: { id: "user-1" }, isLoading: false })
    mocks.useUserTickets.mockReturnValue({
      data: [
        ticket("t1", "completed", new Date(2026, 8, 10, 12).toISOString()),
        ticket("t2", "in-progress", new Date(2026, 8, 5, 12).toISOString()),
        ticket("t3", "completed", new Date(2026, 7, 20, 12).toISOString()),
      ],
      isLoading: false,
    })
    mocks.useUserPayments.mockReturnValue({
      data: [
        payment("p1", "completed", 2500, new Date(2026, 8, 10, 12).toISOString()),
        payment("p2", "authorized", 9900, new Date(2026, 8, 11, 12).toISOString()),
        payment("p3", "completed", 1000, new Date(2026, 7, 20, 12).toISOString()),
      ],
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the header title and current-month key stats", () => {
    render(<UserOverviewPage />)

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(statValue("Number of tickets")).toHaveTextContent("2")
    expect(statValue("Tickets completed")).toHaveTextContent("1")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 25.00")
  })

  it("includes every period when 'All time' is selected", () => {
    render(<UserOverviewPage />)

    fireEvent.click(screen.getByRole("button", { name: "All time" }))

    expect(statValue("Number of tickets")).toHaveTextContent("3")
    expect(statValue("Tickets completed")).toHaveTextContent("2")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 35.00")
  })

  it("links recent tickets to the support chat and the full list", () => {
    render(<UserOverviewPage />)

    expect(screen.getByRole("link", { name: /Ticket t1/ })).toHaveAttribute(
      "href",
      "/support/chat?ticket=t1&project=project-1",
    )
    expect(screen.getByRole("link", { name: "View all tickets" })).toHaveAttribute(
      "href",
      "/support/tickets",
    )
  })

  it("shows an empty state when the user has no tickets", () => {
    mocks.useUserTickets.mockReturnValue({ data: [], isLoading: false })
    mocks.useUserPayments.mockReturnValue({ data: [], isLoading: false })

    render(<UserOverviewPage />)

    expect(screen.getByText("No tickets to show")).toBeInTheDocument()
    expect(statValue("Number of tickets")).toHaveTextContent("0")
    expect(statValue("Total amount spent")).toHaveTextContent("USD 0.00")
  })

  it("prompts signed-out visitors to sign in", () => {
    mocks.useUser.mockReturnValue({ user: { id: "" }, isLoading: false })
    mocks.useUserTickets.mockReturnValue({ data: undefined, isLoading: false })
    mocks.useUserPayments.mockReturnValue({ data: undefined, isLoading: false })

    render(<UserOverviewPage />)

    expect(screen.getByText("Sign in to see your tickets")).toBeInTheDocument()
  })
})
