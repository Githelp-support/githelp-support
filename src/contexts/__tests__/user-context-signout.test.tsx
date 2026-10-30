import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

let authCallback: ((event: string, session: unknown) => void) | null = null
let currentSession: unknown = null
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
}))

import { UserProvider, useUser } from "../user-context"
import { GUEST_ADOPTION_KEY, OWN_GUEST_ID_KEY, saveOwnGuestId } from "@/lib/guest-adoption-storage"
import { requestGuestAdoptionConfirm } from "@/lib/guest-adoption-confirm"

const seen: { id?: string; guestId?: string } = {}
function Probe() {
  const { user } = useUser()
  return <span data-testid="probe" data-id={user.id ?? ""} data-guest={user.guestId ?? ""} />
}
function readProbe() {
  const el = document.querySelector("[data-testid=probe]")
  seen.id = el?.getAttribute("data-id") || undefined
  seen.guestId = el?.getAttribute("data-guest") || undefined
}

describe("UserProvider guest handling", () => {
  beforeEach(() => {
    window.localStorage.clear()
    authCallback = null
    currentSession = null
    seen.id = undefined
    seen.guestId = undefined
  })

  it("SIGNED_OUT clears the saved guest session and own guest id (expiry / global sign-out)", async () => {
    window.localStorage.setItem(GUEST_ADOPTION_KEY, "{}")
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "guest-1")
    window.localStorage.setItem("githelp.supportDraft:p1", JSON.stringify({ text: "q", saved_at: Date.now() }))
    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    )
    await waitFor(() => expect(authCallback).not.toBeNull())
    act(() => authCallback!("SIGNED_OUT", null))
    expect(window.localStorage.getItem(GUEST_ADOPTION_KEY)).toBeNull()
    expect(window.localStorage.getItem(OWN_GUEST_ID_KEY)).toBeNull()
    expect(window.localStorage.getItem("githelp.supportDraft:p1")).toBeNull()
  })

  it("SIGNED_OUT closes an open link dialog as superseded (not 'later')", async () => {
    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    )
    await waitFor(() => expect(authCallback).not.toBeNull())
    const pending = requestGuestAdoptionConfirm([], "ada@example.com")
    act(() => authCallback!("SIGNED_OUT", null))
    await expect(pending).resolves.toBe("superseded")
  })

  it("a foreign anonymous session is not used as guestId (treated as no session)", async () => {
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "my-guest")
    currentSession = { user: { id: "planted", is_anonymous: true } }
    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    )
    await waitFor(() => expect(authCallback).not.toBeNull())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    readProbe()
    expect(seen.guestId).toBeUndefined()
    expect(seen.id).toBeUndefined()
  })

  it("our own guest becomes guestId, also right after ensureSupportSession marks it", async () => {
    currentSession = { user: { id: "g1", is_anonymous: true } }
    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    readProbe()
    expect(seen.guestId).toBeUndefined()
    await act(async () => {
      saveOwnGuestId("g1")
      await new Promise((r) => setTimeout(r, 10))
    })
    readProbe()
    expect(seen.guestId).toBe("g1")
    expect(seen.id).toBeUndefined()
  })

  it("resets cached queries when the account changes, not on a token refresh", async () => {
    const client = new QueryClient()
    const reset = vi.spyOn(client, "resetQueries").mockResolvedValue()
    render(
      <QueryClientProvider client={client}>
        <UserProvider>
          <Probe />
        </UserProvider>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(authCallback).not.toBeNull())
    const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 5)) })
    act(() => authCallback!("INITIAL_SESSION", { user: { id: "u1" } }))
    act(() => authCallback!("TOKEN_REFRESHED", { user: { id: "u1" } }))
    await settle()
    expect(reset).not.toHaveBeenCalled()
    act(() => authCallback!("SIGNED_OUT", null))
    await settle()
    expect(reset).toHaveBeenCalledTimes(1)
    act(() => authCallback!("SIGNED_IN", { user: { id: "u2" } }))
    await settle()
    expect(reset).toHaveBeenCalledTimes(2)
    // signed out -> first guest (first send on /support): nothing private cached, no reset
    act(() => authCallback!("SIGNED_OUT", null))
    await settle()
    act(() => authCallback!("SIGNED_IN", { user: { id: "g9", is_anonymous: true } }))
    await settle()
    expect(reset).toHaveBeenCalledTimes(3)
  })
})
