import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

const getSession = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: () => getSession() } },
}))

import { supabase } from "@/lib/supabase/client"
import { GUEST_PRESENCE_INTERVAL_MS, useGuestPresence, useGuestSignInPresence } from "../useGuestPresence"

const fetchMock = vi.fn()

let visibility: DocumentVisibilityState = "visible"

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("useGuestPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(supabase.rpc).mockReset()
    vi.mocked(supabase.rpc).mockReturnValue(Promise.resolve({ error: null }) as never)
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: { access_token: "guest-token" } } })
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    visibility = "visible"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("touches the ticket on mount and every 30 s while visible", () => {
    renderHook(() => useGuestPresence("t1", true))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("touch_guest_ticket", { p_ticket_id: "t1" })

    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(3)
  })

  it("keeps calling while the tab is hidden, and touches right away when it becomes visible", () => {
    renderHook(() => useGuestPresence("t1", true))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)

    setVisibility("hidden")
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 3)
    expect(supabase.rpc).toHaveBeenCalledTimes(4)

    setVisibility("visible")
    expect(supabase.rpc).toHaveBeenCalledTimes(5)
  })

  it("does nothing when disabled", () => {
    renderHook(() => useGuestPresence("t1", false))
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 2)
    setVisibility("visible")
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("without a ticket id touches all of the guest's open tickets", () => {
    renderHook(() => useGuestPresence(null, true))
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(["touch_guest_ticket"])
  })

  it("on the sign-in pages ignores a foreign (not our own) anonymous session", async () => {
    window.localStorage.setItem("githelp.ownGuestId", "mine")
    getSession.mockResolvedValue({ data: { session: { user: { id: "planted", is_anonymous: true } } } })
    renderHook(() => useGuestSignInPresence())
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS * 2)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("on the sign-in pages touches all open guest tickets (no id) while still a guest", async () => {
    window.localStorage.setItem("githelp.ownGuestId", "g1")
    getSession.mockResolvedValue({ data: { session: { user: { id: "g1", is_anonymous: true } } } })
    renderHook(() => useGuestSignInPresence())
    await vi.advanceTimersByTimeAsync(0)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(["touch_guest_ticket"])
    setVisibility("hidden")
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)

    // Signed in for real: stops touching.
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1", is_anonymous: false } } } })
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it("stops on unmount and when disabled", () => {
    const { rerender, unmount } = renderHook(({ enabled }) => useGuestPresence("t1", enabled), {
      initialProps: { enabled: true },
    })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    rerender({ enabled: false })
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 2)
    setVisibility("visible")
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 2)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it("reports leave with a keepalive request on pagehide", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)

    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://sb.test/rest/v1/rpc/leave_guest_ticket")
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { apikey: "anon-key", Authorization: "Bearer guest-token" },
      body: JSON.stringify({ p_ticket_id: "t1" }),
    })
    // Leave never goes through supabase-js.
    expect(supabase.rpc).not.toHaveBeenCalledWith("leave_guest_ticket", expect.anything())
  })

  it("leaves all open guest tickets (no arguments) without a ticket id", async () => {
    renderHook(() => useGuestPresence(null, true))
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock.mock.calls[0][1].body).toBe("{}")
  })

  it("uses the latest access token", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    getSession.mockResolvedValue({ data: { session: { access_token: "refreshed-token" } } })
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer refreshed-token")
  })

  it("does not report leave when disabled, after unmount or without a session", async () => {
    renderHook(() => useGuestPresence("t1", false))
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()

    const { unmount } = renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    unmount()
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()

    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not report leave when the tab is hidden", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    setVisibility("hidden")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("touches again when the page is restored from the back/forward cache", () => {
    renderHook(() => useGuestPresence("t1", true))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }))
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenLastCalledWith("touch_guest_ticket", { p_ticket_id: "t1" })
  })

  it("never throws on pagehide when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow()
    fetchMock.mockImplementation(() => {
      throw new Error("sync failure")
    })
    expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
  })

  it("on the sign-in pages never reports leave", async () => {
    window.localStorage.setItem("githelp.ownGuestId", "g1")
    getSession.mockResolvedValue({ data: { session: { user: { id: "g1", is_anonymous: true }, access_token: "t" } } })
    renderHook(() => useGuestSignInPresence())
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("never throws when the RPC fails", async () => {
    vi.mocked(supabase.rpc).mockReturnValue(Promise.resolve({ error: { message: "nope" } }) as never)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    renderHook(() => useGuestPresence("t1", true))
    await vi.runOnlyPendingTimersAsync()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
