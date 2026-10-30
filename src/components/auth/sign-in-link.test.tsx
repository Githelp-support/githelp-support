import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePathname = vi.fn()
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))

import { SignInLink } from "./sign-in-link"
import { isSupportRoute, signInHref } from "@/lib/sign-in-href"
import { setSupportSignInRedirect } from "@/lib/support-sign-in-redirect"

describe("SignInLink", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUser.mockReturnValue({ user: { name: "Incognito", role: "user" } })
    setSupportSignInRedirect(null)
  })

  it("on a support page returns to the published conversation, not the welcome screen", () => {
    usePathname.mockReturnValue("/support/acme")
    setSupportSignInRedirect("/support/chat?ticket=t1&project=p1")
    render(<SignInLink redirectTo="/support/acme">Sign in</SignInLink>)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/signin?redirect=%2Fsupport%2Fchat%3Fticket%3Dt1%26project%3Dp1&skipOnboarding=true",
    )
  })

  it("ignores a published support redirect off support routes", () => {
    usePathname.mockReturnValue("/tickets")
    setSupportSignInRedirect("/support/chat?ticket=t1&project=p1")
    render(<SignInLink redirectTo="/tickets">Sign in</SignInLink>)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/signin?redirect=%2Ftickets")
  })

  it("adds skipOnboarding on support routes", () => {
    usePathname.mockReturnValue("/support/chat")
    render(<SignInLink redirectTo="/support/chat?project=p1">Sign in</SignInLink>)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/signin?redirect=%2Fsupport%2Fchat%3Fproject%3Dp1&skipOnboarding=true",
    )
  })

  it("keeps the plain sign-in link elsewhere", () => {
    usePathname.mockReturnValue("/tickets")
    render(<SignInLink redirectTo="/tickets">Sign in</SignInLink>)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/signin?redirect=%2Ftickets")
  })
})

describe("sign-in href helpers", () => {
  it("recognises support routes", () => {
    expect(isSupportRoute("/support")).toBe(true)
    expect(isSupportRoute("/support/acme")).toBe(true)
    expect(isSupportRoute("/supportive")).toBe(false)
    expect(isSupportRoute(null)).toBe(false)
    expect(signInHref("/x", { support: true })).toBe("/auth/signin?redirect=%2Fx&skipOnboarding=true")
  })
})
