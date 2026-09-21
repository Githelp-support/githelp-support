import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePathname = vi.fn()
const useSearchParams = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
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
    expect(screen.queryByText("Chat")).not.toBeInTheDocument()
    expect(screen.queryByText("Rates and details")).not.toBeInTheDocument()
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
    expect(link).toHaveAttribute("href", "/support/tickets")
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
