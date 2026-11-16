import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"

const usePathname = vi.fn()
const useSearchParams = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({
  useUser: () => useUser(),
}))

// Render Next links as plain anchors — the sidebar tests only assert on
// hrefs/labels, not navigation behavior.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// The role / project controls have their own data dependencies (queries,
// project selection); the sidebar tests only assert where they are rendered.
const signOut = vi.fn()
vi.mock("@/hooks/useWorkspaceSwitcher", () => ({
  useWorkspaceSwitcher: () => ({ signOut }),
}))
vi.mock("@/components/layout/workspace-switchers", () => ({
  RoleSwitcher: () => <div data-testid="role-switcher" />,
  ProjectSwitcher: ({ collapsed }: { collapsed?: boolean }) => (
    <div data-testid="project-switcher" data-collapsed={String(!!collapsed)} />
  ),
}))

const useNotifications = vi.fn()
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => useNotifications(),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: vi.fn() }),
  notificationType: () => "SUPPORT_TICKET",
}))

import { Sidebar } from "../sidebar"
import { PublicSupportSidebar } from "../public-support-sidebar"

const signedInUser = {
  id: "user-1",
  name: "Test User",
  role: "user",
  avatar: "T",
  avatarUrl: null,
}

const anonymousUser = {
  id: undefined,
  name: "Incognito",
  role: "user",
  avatar: "I",
  avatarUrl: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  usePathname.mockReturnValue("/support/tickets")
  useSearchParams.mockReturnValue(new URLSearchParams())
  useUser.mockReturnValue({ user: signedInUser, setProjectRole: vi.fn() })
  useNotifications.mockReturnValue({ data: [] })
})

describe("Sidebar — project page link", () => {
  it("renders the renamed 'Open project page' link when projectPageHref is provided", () => {
    render(<Sidebar projectPageHref="/support/acme" />)

    const link = screen.getByText("Open project page").closest("a")
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/support/acme")
    expect(link).toHaveAttribute("target", "_blank")
    // Old label must not appear in the user-portal sidebar anymore.
    expect(screen.queryByText("Open my user portal")).not.toBeInTheDocument()
  })

  it("does not render the project page link without projectPageHref", () => {
    render(<Sidebar />)

    expect(screen.queryByText("Open project page")).not.toBeInTheDocument()
  })
})

describe("Sidebar — Support sub-categories", () => {
  it("expands Support with Chat highlighted when a ticket chat is open", () => {
    usePathname.mockReturnValue("/support/chat")
    useSearchParams.mockReturnValue(
      new URLSearchParams("ticket=ticket-1&project=project-1"),
    )

    render(<Sidebar projectPageHref="/support/acme" />)

    // The Support parent is expanded: all sub-categories are visible.
    expect(screen.getByText("Chat")).toBeInTheDocument()
    expect(screen.getByText("Rates and details")).toBeInTheDocument()
    expect(screen.getByText("Resources")).toBeInTheDocument()
    expect(screen.getByText("About support")).toBeInTheDocument()

    // "Chat" is the active sub-item and keeps the ticket/project context in
    // its href so re-clicking it reopens the same conversation.
    const chatRow = screen.getByText("Chat")
    expect(chatRow.className).toContain("text-brand-primary")
    expect(chatRow.closest("a")).toHaveAttribute(
      "href",
      "/support/chat?project=project-1&ticket=ticket-1",
    )
  })

  it("does not expand Support on /support/tickets (top-level Tickets item)", () => {
    usePathname.mockReturnValue("/support/tickets")

    render(<Sidebar />)

    expect(screen.getByText("Tickets")).toBeInTheDocument()
    // Sub-items stay mounted for the height animation; the collapsed branch is inert.
    expect(screen.getByText("Chat").closest("[data-state]")).toHaveAttribute("data-state", "closed")
    expect(screen.getByText("Rates and details").closest("[data-state]")).toHaveAttribute("data-state", "closed")
  })
})

describe("Sidebar — user-role menu order", () => {
  it("renders Overview, Support, Tickets, Reports, Settings in order with Overview active on /user/overview", () => {
    usePathname.mockReturnValue("/user/overview")

    const { container } = render(<Sidebar />)

    const nav = container.querySelector("nav")
    expect(nav).not.toBeNull()
    // Each item's own row is a link (leaf) or a role=button (parent); sub-menus
    // stay mounted below the row, so read the row rather than the whole item.
    const topLevelLabels = Array.from(nav!.firstElementChild!.children).map(
      (el) => el.querySelector("a, button, [role='button']")?.textContent?.trim(),
    )
    expect(topLevelLabels).toEqual([
      "Inbox",
      "Overview",
      "Support",
      "Tickets",
      "Reports",
      "Settings",
    ])

    const overviewRow = screen.getByText("Overview")
    expect(overviewRow.closest("a")).toHaveAttribute("href", "/user/overview")
    expect(overviewRow.className).toContain("text-brand-primary")

    // Other top-level items are not highlighted.
    expect(screen.getByText("Tickets").className).not.toContain(
      "text-brand-primary",
    )
  })
})

describe("Sidebar — guest (anonymous support visitor)", () => {
  it("shows only the public support items: no Overview, Tickets, Reports or Settings", () => {
    usePathname.mockReturnValue("/support/chat")
    useUser.mockReturnValue({ user: { ...anonymousUser, guestId: "g1" }, setProjectRole: vi.fn() })

    const { container } = render(<Sidebar />)

    const nav = container.querySelector("nav")
    const topLevelLabels = Array.from(nav!.firstElementChild!.children).map((el) => el.textContent?.trim())
    expect(topLevelLabels.map((l) => l?.split(/(?=[A-Z])/)[0])).toEqual(["Support"])
    expect(screen.queryByText("Tickets")).not.toBeInTheDocument()
    expect(screen.queryByText("Overview")).not.toBeInTheDocument()
    expect(screen.queryByText("Reports")).not.toBeInTheDocument()
  })
})

describe("PublicSupportSidebar — 'Open my user portal' link", () => {
  const renderPublicSidebar = () =>
    render(
      <PublicSupportSidebar activeTab="Get support" onTabChange={() => {}} />,
    )

  it("renders the portal link for signed-in users", () => {
    usePathname.mockReturnValue("/support")
    useSearchParams.mockReturnValue(new URLSearchParams("slug=acme"))

    renderPublicSidebar()

    const link = screen.getByText("Open my user portal").closest("a")
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/support/chat")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("does not render the portal link for anonymous visitors", () => {
    usePathname.mockReturnValue("/support")
    useSearchParams.mockReturnValue(new URLSearchParams("slug=acme"))
    useUser.mockReturnValue({ user: anonymousUser, setProjectRole: vi.fn() })

    renderPublicSidebar()

    expect(screen.queryByText("Open my user portal")).not.toBeInTheDocument()
  })
})

describe("Sidebar — expansion follows client-side navigation", () => {
  it("expands the parent of the active sub-item when the pathname changes without a remount", () => {
    useUser.mockReturnValue({ user: { ...signedInUser, role: "admin" }, setProjectRole: vi.fn() })
    usePathname.mockReturnValue("/tickets")
    const { rerender } = render(<Sidebar />)
    expect(screen.getByText("Branding").closest("[data-state]")).toHaveAttribute("data-state", "closed")

    // A link elsewhere (or back/forward) lands on a settings sub-page: the Sidebar stays mounted.
    usePathname.mockReturnValue("/settings/branding")
    rerender(<Sidebar />)
    expect(screen.getByText("Branding").closest("[data-state]")).toHaveAttribute("data-state", "open")
    expect(screen.getByText("Branding").closest("a")).toHaveAttribute("href", "/settings/branding")
  })
})

describe("Sidebar — header, project row and profile block", () => {
  // Collapsed rows are wrapped in tooltips, which need the root layout's provider.
  const renderSidebar = (props: React.ComponentProps<typeof Sidebar> = {}) =>
    render(
      <TooltipProvider>
        <Sidebar {...props} />
      </TooltipProvider>,
    )

  it("expanded: shows the role and project controls and a collapse button, no role line", () => {
    renderSidebar()

    expect(screen.getByTestId("role-switcher")).toBeInTheDocument()
    expect(screen.getByTestId("project-switcher")).toHaveAttribute("data-collapsed", "false")
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Role:/)).not.toBeInTheDocument()
    // The logo sits in the header row, next to the role control; expanded it is not a button.
    const header = screen.getByTestId("role-switcher").parentElement!
    expect(header.querySelector(":scope > svg")).not.toBeNull()
    expect(header).toContainElement(screen.getByRole("button", { name: "Collapse sidebar" }))
  })

  it("starts collapsed from localStorage: the logo is the only expand control", () => {
    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar()

    // No chevron button in either direction: the logo expands the sidebar.
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument()
    expect(document.querySelector(".fi-rr-angle-double-small-left")).toBeNull()
    expect(document.querySelector(".fi-rr-angle-double-small-right")).toBeNull()
    const expand = screen.getByRole("button", { name: "Expand sidebar" })
    expect(expand.querySelector("svg")).not.toBeNull()

    expect(screen.queryByTestId("role-switcher")).not.toBeInTheDocument()
    expect(screen.getByTestId("project-switcher")).toHaveAttribute("data-collapsed", "true")

    fireEvent.click(expand)
    expect(window.localStorage.getItem("sidebar:collapsed")).toBe("false")
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
    expect(screen.getByTestId("role-switcher")).toBeInTheDocument()
    expect(screen.getByTestId("project-switcher")).toHaveAttribute("data-collapsed", "false")
  })

  it("collapses to the logo button and expands again, persisting the state", () => {
    renderSidebar()

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(window.localStorage.getItem("sidebar:collapsed")).toBe("true")
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("role-switcher")).not.toBeInTheDocument()
    expect(screen.getByTestId("project-switcher")).toHaveAttribute("data-collapsed", "true")
    expect(screen.queryByText("Test User")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(window.localStorage.getItem("sidebar:collapsed")).toBe("false")
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
  })

  it("centres the 'Open project page' link when collapsed", () => {
    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar({ projectPageHref: "/support/acme" })

    const link = document.querySelector('a[href="/support/acme"]')
    expect(link?.className).toContain("justify-center")
    expect(link?.className).not.toContain("gap-3")
  })

  it("forceExpanded (mobile sheet): no collapse button, even when the stored state is collapsed", () => {
    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar({ forceExpanded: true })

    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument()
    expect(screen.getByTestId("role-switcher")).toBeInTheDocument()
  })

  it("signs out through the account menu", () => {
    renderSidebar()

    const trigger = screen.getByRole("button", { name: "Account menu" })
    fireEvent.keyDown(trigger, { key: "Enter" })
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("keeps Sign out reachable from the avatar when collapsed", () => {
    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar()

    fireEvent.keyDown(screen.getByRole("button", { name: "Account menu" }), { key: "Enter" })
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("shows the Inbox at the top of the menu with the unread count, and opens the notifications panel", () => {
    useNotifications.mockReturnValue({
      data: [
        { id: "n1", is_read: false, content: "New ticket", created_at: new Date().toISOString(), route: null },
        { id: "n2", is_read: true, content: "Old ticket", created_at: new Date().toISOString(), route: null },
      ],
    })
    const { container } = renderSidebar()

    const inbox = screen.getByRole("button", { name: "Inbox, 1 unread" })
    expect(inbox.querySelector(".fi-rr-inbox")).not.toBeNull()
    expect(inbox).toHaveTextContent("Inbox")
    expect(container.querySelector("nav")!.firstElementChild!.firstElementChild).toContainElement(inbox)
    expect(document.querySelector(".fi-rr-bell")).toBeNull()

    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument()
    fireEvent.click(inbox)
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument()
  })

  it("collapsed: the Inbox is icon-only and still opens the panel", () => {
    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar()

    const inbox = screen.getByRole("button", { name: "Inbox" })
    expect(inbox).not.toHaveTextContent("Inbox")
    fireEvent.click(inbox)
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument()
  })

  it("forceExpanded (mobile sheet): the Inbox links to the notifications page", () => {
    renderSidebar({ forceExpanded: true })

    expect(screen.getByText("Inbox").closest("a")).toHaveAttribute("href", "/notifications")
  })

  it("labels the project dropdown 'Projects' when expanded only", () => {
    const { unmount } = renderSidebar()
    const label = screen.getByText("Projects")
    expect(label.className).toContain("uppercase")
    expect(label.nextElementSibling).toContainElement(screen.getByTestId("project-switcher"))
    unmount()

    window.localStorage.setItem("sidebar:collapsed", "true")
    renderSidebar()
    expect(screen.queryByText("Projects")).not.toBeInTheDocument()
  })

  it("guests: name only, no role, project or account controls", () => {
    useUser.mockReturnValue({ user: { ...anonymousUser, guestId: "g1" }, setProjectRole: vi.fn() })
    renderSidebar()

    expect(screen.getByText("Incognito")).toBeInTheDocument()
    expect(screen.queryByTestId("role-switcher")).not.toBeInTheDocument()
    expect(screen.queryByTestId("project-switcher")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument()
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Projects")).not.toBeInTheDocument()
  })
})
