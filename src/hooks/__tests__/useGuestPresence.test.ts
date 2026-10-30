import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

const getSession = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: () => getSession() } },
}))

import { supabase } from "@/lib/supabase/client"
import { GUEST_PRESENCE_INTERVAL_MS, useGuestPresence, useGuestSignInPresence } from "../useGuestPresence"

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
    visibility = "visible"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it("never throws when the RPC fails", async () => {
    vi.mocked(supabase.rpc).mockReturnValue(Promise.resolve({ error: { message: "nope" } }) as never)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    renderHook(() => useGuestPresence("t1", true))
    await vi.runOnlyPendingTimersAsync()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
