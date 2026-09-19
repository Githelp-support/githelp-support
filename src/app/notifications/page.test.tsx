import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { Notification } from "@/hooks/useNotifications"

const useNotifications = vi.fn()
const useMarkNotificationRead = vi.fn()
const useMarkAllNotificationsRead = vi.fn()
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => useNotifications(),
  useMarkNotificationRead: () => useMarkNotificationRead(),
  useMarkAllNotificationsRead: () => useMarkAllNotificationsRead(),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

// Sidebar and Header pull in user context / auth — stub them out
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}))

import NotificationsPage from "./page"

const makeNotification = (overrides: Partial<Notification>): Notification => ({
  id: "n-1",
  title: "Notification",
  content: "Notification content",
  route: null,
  is_read: false,
  read_at: null,
  created_at: "2026-09-19T10:00:00Z",
  metadata: { type: "SUPPORT_TICKET" },
  ...overrides,
})

describe("NotificationsPage", () => {
  const markReadMutateAsync = vi.fn().mockResolvedValue(undefined)
  const markAllMutateAsync = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    markReadMutateAsync.mockResolvedValue(undefined)
    markAllMutateAsync.mockResolvedValue(undefined)
    useMarkNotificationRead.mockReturnValue({ mutateAsync: markReadMutateAsync, isPending: false })
    useMarkAllNotificationsRead.mockReturnValue({ mutateAsync: markAllMutateAsync, isPending: false })
  })

  it("renders notifications in the order returned by the hook (newest first)", () => {
    useNotifications.mockReturnValue({
      data: [
        makeNotification({ id: "n-newest", content: "Newest notification", created_at: "2026-09-19T12:00:00Z" }),
        makeNotification({ id: "n-middle", content: "Middle notification", created_at: "2026-09-18T12:00:00Z" }),
        makeNotification({ id: "n-oldest", content: "Oldest notification", created_at: "2026-09-17T12:00:00Z" }),
      ],
      isLoading: false,
    })

    render(<NotificationsPage />)

    const items = screen.getAllByText(/notification$/i)
    expect(items.map((el) => el.textContent)).toEqual([
      "Newest notification",
      "Middle notification",
      "Oldest notification",
    ])
  })

  it("shows the empty state when there are no notifications", () => {
    useNotifications.mockReturnValue({ data: [], isLoading: false })

    render(<NotificationsPage />)

    expect(screen.getByText("No notifications")).toBeInTheDocument()
  })

  it("marks an unread notification as read when clicked", async () => {
    useNotifications.mockReturnValue({
      data: [makeNotification({ id: "n-unread", content: "Unread notification", is_read: false })],
      isLoading: false,
    })

    render(<NotificationsPage />)

    fireEvent.click(screen.getByText("Unread notification"))

    await waitFor(() => {
      expect(markReadMutateAsync).toHaveBeenCalledWith("n-unread")
    })
  })

  it("does not trigger the mark-as-read mutation for an already-read notification", async () => {
    useNotifications.mockReturnValue({
      data: [makeNotification({ id: "n-read", content: "Read notification", is_read: true, read_at: "2026-09-19T11:00:00Z" })],
      isLoading: false,
    })

    render(<NotificationsPage />)

    fireEvent.click(screen.getByText("Read notification"))

    await waitFor(() => {
      expect(markReadMutateAsync).not.toHaveBeenCalled()
    })
  })
})
