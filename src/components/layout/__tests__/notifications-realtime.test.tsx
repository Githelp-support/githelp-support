import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Notification } from "@/hooks/useNotifications"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/user/tickets",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push }),
}))

vi.mock("@/contexts/user-context", () => ({
  useUser: () => ({
    user: { id: "user-1", name: "Test User", role: "user", avatar: "T", avatarUrl: null },
    setProjectRole: vi.fn(),
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/hooks/useWorkspaceSwitcher", () => ({
  useWorkspaceSwitcher: () => ({ signOut: vi.fn() }),
}))
vi.mock("@/components/layout/workspace-switchers", () => ({
  RoleSwitcher: () => <div />,
  ProjectSwitcher: () => <div />,
}))

const { toast, handlers, server } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
  handlers: {} as Record<string, (payload: { new: unknown }) => void>,
  server: { rows: [] as unknown[] },
}))
vi.mock("sonner", () => ({ toast }))

// Supabase: capture the realtime handlers per event and serve `serverRows`
// to the notifications query.
type Handler = (payload: { new: unknown }) => void
vi.mock("@/lib/supabase/client", () => {
  const channel = {
    on: (_type: string, opts: { event: string }, cb: Handler) => {
      handlers[opts.event] = cb
      return channel
    },
    subscribe: () => channel,
  }
  const query = {
    select: () => query,
    eq: () => query,
    order: async () => ({ data: server.rows, error: null }),
  }
  return {
    supabase: {
      channel: () => channel,
      removeChannel: vi.fn(),
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: () => query,
    },
  }
})

import { Sidebar } from "../sidebar"
import { NotificationsPanel } from "../notifications-panel"
import { useRealtimeNotifications, upsertNotification } from "@/hooks/useRealtimeNotifications"

const row = (overrides: Partial<Notification>): Notification => ({
  id: "n-1",
  title: "Title",
  content: "Content",
  route: null,
  is_read: false,
  read_at: null,
  created_at: "2026-11-25T10:00:00Z",
  metadata: { type: "SUPPORT_TICKET" },
  ...overrides,
})

const chatRow = (overrides: Partial<Notification> = {}) =>
  row({
    id: "chat-1",
    title: "New message",
    content: "Login broken · Acme · Alice",
    route: "/user/tickets/t-1",
    created_at: "2026-11-25T09:00:00Z",
    metadata: { type: "TICKET_MESSAGE", ticket_id: "t-1" },
    ...overrides,
  })

function RealtimeHarness() {
  useRealtimeNotifications()
  return <Sidebar />
}

function renderWithCache(initial: Notification[]) {
  server.rows = initial
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(["notifications"], initial)
  const utils = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RealtimeHarness />
      </TooltipProvider>
    </QueryClientProvider>
  )
  return { client, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  for (const k of Object.keys(handlers)) delete handlers[k]
})

describe("upsertNotification", () => {
  it("replaces the row by id and moves it to the top by its new time", () => {
    const list = [row({ id: "a", created_at: "2026-11-25T10:00:00Z" }), chatRow()]
    const updated = chatRow({ created_at: "2026-11-25T11:00:00Z" })
    const next = upsertNotification(list, updated)!
    expect(next.map((n) => n.id)).toEqual(["chat-1", "a"])
    expect(next).toHaveLength(2)
    expect(next[0].created_at).toBe("2026-11-25T11:00:00Z")
  })

  it("leaves an unloaded cache alone", () => {
    expect(upsertNotification(undefined, chatRow())).toBeUndefined()
  })
})

describe("useRealtimeNotifications", () => {
  it("subscribes to INSERT and UPDATE on notifications", () => {
    renderWithCache([])
    expect(handlers.INSERT).toBeTypeOf("function")
    expect(handlers.UPDATE).toBeTypeOf("function")
  })

  it("an UPDATE of the unread chat row moves it to the top without changing the unread count", () => {
    const other = row({ id: "a", created_at: "2026-11-25T10:00:00Z" })
    const { client } = renderWithCache([other, chatRow()])
    expect(screen.getByRole("button", { name: "Inbox, 2 unread" })).toBeInTheDocument()

    const updated = chatRow({ created_at: "2026-11-25T11:00:00Z", content: "Login broken · Acme · Bob" })
    server.rows = [updated, other]
    act(() => handlers.UPDATE({ new: updated }))

    const cached = client.getQueryData<Notification[]>(["notifications"])!
    expect(cached.map((n) => n.id)).toEqual(["chat-1", "a"])
    expect(cached[0].content).toBe("Login broken · Acme · Bob")
    expect(screen.getByRole("button", { name: "Inbox, 2 unread" })).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
    expect(toast.dismiss).toHaveBeenCalledWith("chat-1")
  })

  it("an UPDATE marking a row read lowers the unread count", async () => {
    renderWithCache([chatRow()])
    expect(screen.getByRole("button", { name: "Inbox, 1 unread" })).toBeInTheDocument()
    server.rows = [chatRow({ is_read: true })]
    act(() => handlers.UPDATE({ new: chatRow({ is_read: true }) }))
    expect(await screen.findByRole("button", { name: "Inbox" })).toBeInTheDocument()
  })

  it("does not toast a TICKET_MESSAGE insert", async () => {
    renderWithCache([])
    server.rows = [chatRow()]
    act(() => handlers.INSERT({ new: chatRow() }))
    expect(toast).not.toHaveBeenCalled()
    expect(await screen.findByRole("button", { name: "Inbox, 1 unread" })).toBeInTheDocument()
  })

  it("an unread chat INSERT/UPDATE refreshes the ticket unread dots; other changes don't", () => {
    const { client } = renderWithCache([])
    const spy = vi.spyOn(client, "invalidateQueries")
    const unreadCalls = () => spy.mock.calls.filter(([f]) => JSON.stringify(f?.queryKey) === '["ticket-unread"]').length

    act(() => handlers.INSERT({ new: chatRow() }))
    expect(unreadCalls()).toBe(1)
    act(() => handlers.UPDATE({ new: chatRow({ created_at: "2026-11-25T11:00:00Z" }) }))
    expect(unreadCalls()).toBe(2)
    act(() => handlers.UPDATE({ new: chatRow({ is_read: true }) }))
    act(() => handlers.INSERT({ new: row({ id: "x" }) }))
    expect(unreadCalls()).toBe(2)
  })

  it("still toasts other notification types", () => {
    renderWithCache([])
    act(() => handlers.INSERT({ new: row({ id: "p-1", title: "You've been paid" }) }))
    expect(toast).toHaveBeenCalledWith("You've been paid", expect.objectContaining({ id: "p-1" }))
  })
})

describe("NotificationsPanel TICKET_MESSAGE rows", () => {
  const renderPanel = (notifications: Notification[]) =>
    render(
      <NotificationsPanel
        isOpen
        onClose={vi.fn()}
        notifications={notifications}
        onMarkAllAsRead={vi.fn()}
        onNotificationClick={vi.fn()}
      />
    )

  it("shows 'New message' with the content as delivered, in the chat colour", () => {
    renderPanel([chatRow()])
    const dialog = screen.getByRole("dialog", { name: "Notifications" })
    const label = within(dialog).getByText("New message")
    expect(label).toHaveClass("text-chart-2")
    expect(within(dialog).getByText("Login broken · Acme · Alice")).toBeInTheDocument()
  })

  it("navigates to the ticket through notification.route", () => {
    renderPanel([chatRow()])
    fireEvent.click(screen.getByText("Login broken · Acme · Alice"))
    expect(push).toHaveBeenCalledWith("/user/tickets/t-1")
  })

  it("falls back to /notifications for an unsafe route", () => {
    renderPanel([chatRow({ route: "//evil.example" })])
    fireEvent.click(screen.getByText("Login broken · Acme · Alice"))
    expect(push).toHaveBeenCalledWith("/notifications")
  })
})
