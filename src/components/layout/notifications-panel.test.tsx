import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Notification } from "@/hooks/useNotifications"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { NotificationsPanel } from "./notifications-panel"

const TICKET_ID = "0a1b2c3d-1111-2222-3333-444455556666"
// Same wording as the backend (guest_ticket_abandonment migration).
const BODY =
  "A guest user has abandoned ticket a1b2c3d. You can choose to formally end the ticket to keep track of the support given." +
  " If the ticket is not ended within 24 hours by you, the ticket will be deleted permanently."

function abandoned(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    title: "Ticket abandoned",
    content: BODY,
    route: `/helper/tickets/${TICKET_ID}`,
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    metadata: { type: "SUPPORT_TICKET", kind: "guest_ticket_abandoned", ticket_id: TICKET_ID },
    ...overrides,
  }
}

function renderPanel(notification: Notification) {
  const onNotificationClick = vi.fn()
  const onClose = vi.fn()
  render(
    <NotificationsPanel
      isOpen
      onClose={onClose}
      notifications={[notification]}
      onMarkAllAsRead={vi.fn()}
      onNotificationClick={onNotificationClick}
    />,
  )
  return { onNotificationClick, onClose }
}

describe("NotificationsPanel: 'Ticket abandoned' notification", () => {
  beforeEach(() => push.mockClear())

  it("shows the title and the whole body, without truncation", () => {
    renderPanel(abandoned())

    expect(screen.getByText("Ticket abandoned")).toBeInTheDocument()
    expect(screen.getByText("SUPPORT TICKET")).toBeInTheDocument()
    const body = screen.getByText(BODY)
    expect(body.className).not.toMatch(/truncate|line-clamp/)
    expect(body.className).toMatch(/break-words/)
  })

  it("opens the helper ticket page on click and marks the notification", () => {
    const notification = abandoned()
    const { onNotificationClick, onClose } = renderPanel(notification)

    fireEvent.click(screen.getByText("Ticket abandoned"))

    expect(onNotificationClick).toHaveBeenCalledWith(notification)
    expect(push).toHaveBeenCalledWith(`/helper/tickets/${TICKET_ID}`)
    expect(onClose).toHaveBeenCalled()
  })

  it("opens it with Enter from the keyboard", () => {
    renderPanel(abandoned())

    fireEvent.keyDown(screen.getByText("Ticket abandoned").closest('[role="button"]') as HTMLElement, { key: "Enter" })

    expect(push).toHaveBeenCalledWith(`/helper/tickets/${TICKET_ID}`)
  })

  it("falls back to /notifications when the route is not an internal path", () => {
    renderPanel(abandoned({ route: "//evil.example/helper/tickets/x" }))

    fireEvent.click(screen.getByText("Ticket abandoned"))

    expect(push).toHaveBeenCalledWith("/notifications")
  })
})
