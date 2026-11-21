import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActiveTicketsList, type ActiveTicketsListItem } from "./active-tickets-list"

function makeItems(n: number): ActiveTicketsListItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${i}435097a-1c2d-4e5f-8a9b-0c1d2e3f4a5b`,
    subject: `Subject ${i}`,
    projectName: "githelp-crm",
    date: new Date(2026, 10, 15, 10, 16),
    current: i === 0,
    hasNotification: i === 1,
  }))
}

function renderList(items: ActiveTicketsListItem[], count = items.length) {
  return render(
    <ActiveTicketsList
      items={items}
      count={count}
      renderAvatar={(item) => <span data-testid={`avatar-${item.id}`} />}
      hrefFor={(item) => `/support/chat?ticket=${item.id}`}
    />
  )
}

describe("ActiveTicketsList", () => {
  it("renders each row as subject, project · short id, and date", () => {
    renderList(makeItems(2))
    const row = screen.getByRole("link", { name: /Subject 0/ })
    expect(row).toHaveAttribute("href", "/support/chat?ticket=0435097a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")

    const lines = [row.querySelector("h4"), ...row.querySelectorAll("p")]
    expect(lines).toHaveLength(3)
    expect(lines[0]).toHaveTextContent("Subject 0")
    expect(lines[0]).toHaveClass("text-sm", "font-semibold", "truncate")
    expect(lines[1]).toHaveTextContent("githelp-crm · 0435097a")
    expect(lines[1]).toHaveClass("text-xs", "truncate")
    expect(lines[2]).toHaveTextContent("15 Nov 2026")
    expect(lines[2]).toHaveClass("tabular-nums")
  })

  it("keeps the heading outside the scroll container", () => {
    const { container } = renderList(makeItems(6), 15)
    const heading = screen.getByRole("heading", { level: 3, name: "Active tickets (15)" })
    const scroller = container.querySelector('[data-slot="active-tickets-scroll"]') as HTMLElement
    expect(scroller).not.toContainElement(heading)
    expect(scroller.querySelectorAll("a")).toHaveLength(6)
  })

  it("caps the list at four fixed-height rows and scrolls beyond that", () => {
    const { container } = renderList(makeItems(6))
    const scroller = container.querySelector('[data-slot="active-tickets-scroll"]') as HTMLElement
    expect(scroller).toHaveClass("-mx-4", "max-h-76", "overflow-y-auto", "scrollbar-subtle")
    for (const row of scroller.querySelectorAll("a")) expect(row).toHaveClass("h-19")
  })

  it("marks the current row and shows the unread dot only where there are unread messages", () => {
    renderList(makeItems(2))
    const current = screen.getByRole("link", { name: /Subject 0/ })
    expect(current).toHaveClass("border-l-4", "border-l-brand-primary")
    expect(current.querySelector('[data-slot="unread-dot"]')).toBeNull()
    expect(screen.getByRole("link", { name: /Subject 1/ }).querySelector('[data-slot="unread-dot"]')).not.toBeNull()
  })

  it("shows the empty text when there are no tickets", () => {
    renderList([], 0)
    expect(screen.getByText("No active tickets")).toBeInTheDocument()
  })
})
