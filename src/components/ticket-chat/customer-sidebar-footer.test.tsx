import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// TimeEntriesReviewStatus → … → useTicketAttachments pulls in the client, which throws without env vars.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import type { UserActiveTicketSidebarItem } from "@/hooks/useTicketsWithDetails"
import { CustomerTicketSidebarFooter } from "./customer-sidebar-footer"

const ticket = (overrides: Partial<UserActiveTicketSidebarItem> = {}): UserActiveTicketSidebarItem => ({
  id: "0a1b2c3d-1111-2222-3333-444455556666",
  title: "Acme - 0a1b2c3d",
  subtitle: "Webhook retries fail after…",
  date: "15.11.2026",
  subject: "Webhook retries fail after the third attempt",
  projectName: "Acme",
  shortId: "0a1b2c3d",
  dateShort: "15 Nov",
  avatarUrl: null,
  avatarInitial: "A",
  current: false,
  hasNotification: false,
  ...overrides,
})

const renderFooter = (activeTickets: UserActiveTicketSidebarItem[]) =>
  render(
    <CustomerTicketSidebarFooter
      hasClaimer={false}
      timeEntries={[]}
      totalLoggedFormatted="00:00 h"
      activeTickets={activeTickets}
      activeTicketsCount={activeTickets.length}
    />,
  )

describe("CustomerTicketSidebarFooter active tickets", () => {
  it("renders the subject on line 1 and project · short ID · date on line 2", () => {
    renderFooter([ticket()])

    expect(screen.getByText("Active tickets (1)")).toBeInTheDocument()

    const subject = screen.getByRole("heading", { name: "Webhook retries fail after the third attempt" })
    expect(subject).toHaveClass("text-sm", "font-semibold", "text-foreground", "truncate")

    const shortId = screen.getByText("0a1b2c3d")
    expect(shortId).toHaveClass("font-mono")

    const meta = shortId.parentElement!
    expect(meta).toHaveTextContent("Acme · 0a1b2c3d · 15 Nov")
    expect(meta).toHaveClass("text-xs", "text-muted-foreground", "truncate")

    // The old title / subtitle / long date stack is gone.
    expect(screen.queryByText("Acme - 0a1b2c3d")).not.toBeInTheDocument()
    expect(screen.queryByText("Webhook retries fail after…")).not.toBeInTheDocument()
    expect(screen.queryByText("15.11.2026")).not.toBeInTheDocument()
  })

  it("keeps the link target for each ticket", () => {
    const item = ticket()
    renderFooter([item])

    expect(screen.getByRole("link")).toHaveAttribute("href", `/support/chat?ticket=${item.id}`)
  })
})
