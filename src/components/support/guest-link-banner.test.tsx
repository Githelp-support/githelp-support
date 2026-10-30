import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
const runGuestAdoptionFlow = vi.fn()
vi.mock("@/lib/guest-adoption", () => ({
  runGuestAdoptionFlow: (...args: unknown[]) => runGuestAdoptionFlow(...args),
  landingAfterGuestAdoption: () => null,
}))
vi.mock("@/lib/guest-adoption-toast", () => ({ notifyGuestAdoptionResult: vi.fn() }))

import { GuestLinkBanner, hasLinkableGuestConversation } from "./guest-link-banner"
import { GUEST_ADOPTION_KEY, OWN_GUEST_ID_KEY, saveGuestSession } from "@/lib/guest-adoption-storage"

const key = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ access_token: "a", refresh_token: "r", user_id: "g1", saved_at: new Date().toISOString(), ...extra })

describe("hasLinkableGuestConversation", () => {
  const now = Date.now()
  it("is true for our own guest's pending, unconfirmed key (incl. after 'later')", () => {
    expect(hasLinkableGuestConversation(key(), "u1", "g1", now)).toBe(true)
    expect(hasLinkableGuestConversation(key({ later_at: now }), "u1", "g1", now)).toBe(true)
    expect(hasLinkableGuestConversation(key({ confirmed: true, confirmed_by: "someone-else" }), "u1", "g1", now)).toBe(true)
  })
  it("is false when signed out, foreign, confirmed by this user, expired or absent", () => {
    expect(hasLinkableGuestConversation(key(), undefined, "g1", now)).toBe(false)
    expect(hasLinkableGuestConversation(key(), "u1", "other", now)).toBe(false)
    expect(hasLinkableGuestConversation(key({ confirmed: true, confirmed_by: "u1" }), "u1", "g1", now)).toBe(false)
    expect(hasLinkableGuestConversation(key(), "u1", "g1", now + 61 * 60 * 1000)).toBe(false)
    expect(hasLinkableGuestConversation(null, "u1", "g1", now)).toBe(false)
  })
})

describe("GuestLinkBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "g1")
    useUser.mockReturnValue({ user: { id: "u1" } })
  })

  it("offers to link a pending guest conversation and forces the prompt", async () => {
    window.localStorage.setItem(GUEST_ADOPTION_KEY, key({ later_at: Date.now() }))
    runGuestAdoptionFlow.mockResolvedValue({ status: "deferred" })
    render(<GuestLinkBanner />)
    expect(screen.getByText("You have a guest conversation from this browser.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Link it to your account" }))
    await waitFor(() => expect(runGuestAdoptionFlow).toHaveBeenCalledWith(expect.objectContaining({ force: true })))
  })

  it("can be dismissed, and appears when a key is saved later", () => {
    render(<GuestLinkBanner />)
    expect(screen.queryByText("You have a guest conversation from this browser.")).not.toBeInTheDocument()
    act(() => {
      saveGuestSession(JSON.parse(key()))
    })
    expect(screen.getByText("You have a guest conversation from this browser.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("You have a guest conversation from this browser.")).not.toBeInTheDocument()
  })

  it("is hidden for a guest / signed-out visitor", () => {
    window.localStorage.setItem(GUEST_ADOPTION_KEY, key())
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<GuestLinkBanner />)
    expect(screen.queryByText("You have a guest conversation from this browser.")).not.toBeInTheDocument()
  })
})
