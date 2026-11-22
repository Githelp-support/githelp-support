import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePathname = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
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

// The TopBar has its own tests; here only its placement and variant matter.
vi.mock("@/components/layout/top-bar", () => ({
  TopBar: ({ variant = "default" }: { variant?: string }) => <div data-testid="top-bar" data-variant={variant} />,
}))

// The Sidebar's role / project controls and sign-out need the query and
// project providers; they are covered by the sidebar tests.
vi.mock("@/hooks/useWorkspaceSwitcher", () => ({
  useWorkspaceSwitcher: () => ({ signOut: vi.fn() }),
}))
vi.mock("@/components/layout/workspace-switchers", () => ({
  RoleSwitcher: () => <div data-testid="role-switcher" />,
  ProjectSwitcher: () => <div data-testid="project-switcher" />,
}))

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: [] }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: vi.fn() }),
  notificationType: () => "SUPPORT_TICKET",
}))

import { AppShell, isShellRoute, useSetProjectPageHref } from "../app-shell"

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe("isShellRoute", () => {
  it("gives the shell to the admin, helper and user app pages", () => {
    for (const path of [
      "/",
      "/helpers",
      "/helpers/abc",
      "/tickets",
      "/slas",
      "/slas/abc",
      "/reports/support",
      "/landing-page",
      "/notifications",
      "/help",
      "/settings/branding",
      "/settings/payment",
      "/helper/overview",
      "/helper/tickets/abc",
      "/user/overview",
      "/support/about",
      "/support/chat",
      "/support/rates",
      "/support/resources",
      "/support/tickets",
    ]) {
      expect(isShellRoute(path), path).toBe(true)
    }
  })

  it("leaves auth, onboarding, invites, public project and public support pages without the shell", () => {
    for (const path of [
      "/auth/signin",
      "/onboarding",
      "/onboarding/waiting",
      "/invite/token",
      "/projects/abc",
      "/projects/abc/invite-contributors",
      "/settings/payment/connect/return",
      "/support",
      "/support/acme",
      "/support/get-support",
      "/support/sla",
      null,
    ]) {
      expect(isShellRoute(path), String(path)).toBe(false)
    }
  })
})

describe("AppShell", () => {
  it("renders the sidebar once around the page on shell routes", () => {
    usePathname.mockReturnValue("/tickets")
    render(
      <AppShell>
        <p>Page body</p>
      </AppShell>,
    )
    expect(screen.getByText("Page body")).toBeInTheDocument()
    expect(screen.getByRole("navigation")).toBeInTheDocument()
    // The shell TopBar sits in the content column, directly above the page.
    const topBar = screen.getByTestId("top-bar")
    expect(topBar).toHaveAttribute("data-variant", "shell")
    const column = topBar.parentElement!
    expect(column).toBe(screen.getByText("Page body").parentElement)
    expect(topBar.nextElementSibling).toBe(screen.getByText("Page body"))
    // The Sidebar is a sibling of that column in the shell row, not above or inside it.
    const nav = screen.getByRole("navigation")
    expect(column).not.toContainElement(nav)
    expect(column.parentElement).toContainElement(nav)
    expect(nav.compareDocumentPosition(column) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders the default TopBar and the page, without a sidebar, on routes without the shell", () => {
    usePathname.mockReturnValue("/auth/signin")
    render(
      <AppShell>
        <p>Sign in body</p>
      </AppShell>,
    )
    expect(screen.getByText("Sign in body")).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    const topBar = screen.getByTestId("top-bar")
    expect(topBar).toHaveAttribute("data-variant", "default")
    // Full-width bar directly above the page.
    expect(topBar.nextElementSibling).toBe(screen.getByText("Sign in body"))
  })

  it("lets a support page provide the sidebar's project page link through context", () => {
    usePathname.mockReturnValue("/support/about")
    function SupportPage() {
      useSetProjectPageHref("/support/acme")
      return <p>About</p>
    }
    render(
      <AppShell>
        <SupportPage />
      </AppShell>,
    )
    const link = screen.getByText("Open project page").closest("a")
    expect(link).toHaveAttribute("href", "/support/acme")
  })
})
