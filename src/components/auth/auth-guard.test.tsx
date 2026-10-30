import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tickets",
}))

const getSession = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

const useOnboardingStatus = vi.fn()
vi.mock("@/hooks/useOnboardingStatus", () => ({
  useOnboardingStatus: () => useOnboardingStatus(),
}))

vi.mock("@/components/layout/sandbox-banner", () => ({ SandboxBanner: () => null }))

import { AuthGuard } from "./auth-guard"
import { hasGuestSession, hasSignedInSession, isAnonymousUser, isSignedInUser } from "@/lib/supabase/auth-state"

describe("auth-state helpers", () => {
  it("treats anonymous users as signed out", () => {
    expect(isAnonymousUser({ id: "g", is_anonymous: true })).toBe(true)
    expect(isSignedInUser({ id: "g", is_anonymous: true })).toBe(false)
    expect(hasSignedInSession({ user: { id: "g", is_anonymous: true } })).toBe(false)
    expect(hasGuestSession({ user: { id: "g", is_anonymous: true } })).toBe(true)
  })

  it("treats real users as signed in", () => {
    expect(isSignedInUser({ id: "u", is_anonymous: false })).toBe(true)
    expect(isSignedInUser({ id: "u" })).toBe(true)
    expect(hasSignedInSession({ user: { id: "u" } })).toBe(true)
    expect(hasGuestSession({ user: { id: "u" } })).toBe(false)
  })

  it("handles missing sessions", () => {
    expect(hasSignedInSession(null)).toBe(false)
    expect(hasSignedInSession({ user: null })).toBe(false)
    expect(hasGuestSession(undefined)).toBe(false)
    expect(isSignedInUser(null)).toBe(false)
  })
})

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Would send a signed-in user to the wizard — must never apply to guests.
    useOnboardingStatus.mockReturnValue({
      data: { needsOnboarding: true, needsWaiting: false, isMember: false, onboardingCompleted: false, hasPendingRequest: false },
      isLoading: false,
    })
  })

  it("redirects an anonymous guest to sign-in, never to onboarding", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "guest-1", is_anonymous: true } } } })
    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>,
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/signin?redirect=%2Ftickets"))
    expect(push).not.toHaveBeenCalledWith("/onboarding")
    expect(screen.queryByText("secret")).not.toBeInTheDocument()
  })

  it("redirects a visitor without a session to sign-in", async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>,
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/signin?redirect=%2Ftickets"))
    expect(screen.queryByText("secret")).not.toBeInTheDocument()
  })

  it("lets a real user through (and applies onboarding to them)", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1", is_anonymous: false } } } })
    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>,
    )
    expect(await screen.findByText("secret")).toBeInTheDocument()
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"))
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining("/auth/signin"))
  })
})
