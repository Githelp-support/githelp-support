import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePathname = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => new URLSearchParams(),
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
  })

  it("renders only the page on routes without the shell", () => {
    usePathname.mockReturnValue("/auth/signin")
    render(
      <AppShell>
        <p>Sign in body</p>
      </AppShell>,
    )
    expect(screen.getByText("Sign in body")).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
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
