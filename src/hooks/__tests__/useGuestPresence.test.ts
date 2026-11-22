import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

const getSession = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: () => getSession() } },
}))

import { supabase } from "@/lib/supabase/client"
import {
  GUEST_PRESENCE_INTERVAL_MS,
  touchGuestTicketsNow,
  useGuestPresence,
  useGuestSignInPresence,
} from "../useGuestPresence"

let visibility: DocumentVisibilityState = "visible"

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event("visibilitychange"))
}

function pageShow(persisted: boolean) {
  const event = new Event("pageshow")
  Object.defineProperty(event, "persisted", { value: persisted })
  window.dispatchEvent(event)
}

const fetchMock = vi.fn()
const LEAVE_URL = "https://sb.test/rest/v1/rpc/leave_guest_ticket"
const guestSession = (id = "g1", token = "tok-1") => ({
  data: { session: { access_token: token, user: { id, is_anonymous: true } } },
})

describe("useGuestPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    fetchMock.mockReset()
    fetchMock.mockReturnValue(Promise.resolve({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    getSession.mockReset()
    getSession.mockResolvedValue(guestSession())
    window.localStorage.clear()
    vi.mocked(supabase.rpc).mockReset()
    vi.mocked(supabase.rpc).mockReturnValue(Promise.resolve({ error: null }) as never)
    visibility = "visible"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
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

  it("reports leave on pagehide with the ticket id, as a keepalive request with the session token", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)

    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(LEAVE_URL)
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { apikey: "anon-key", Authorization: "Bearer tok-1", "Content-Type": "application/json" },
    })
    expect(JSON.parse(init.body)).toEqual({ p_ticket_id: "t1" })
    // Not through supabase.rpc: only the mount touch went there.
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it("reports leave on pagehide for all open guest tickets without a ticket id", async () => {
    renderHook(() => useGuestPresence(null, true))
    await vi.advanceTimersByTimeAsync(0)

    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(LEAVE_URL)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({})
  })

  it("uses the latest token after a refresh", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    getSession.mockResolvedValue(guestSession("g1", "tok-2"))
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS)

    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok-2")
  })

  it("does not report leave when the tab is merely hidden", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    setVisibility("hidden")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not report leave when disabled or without a session token", async () => {
    renderHook(() => useGuestPresence("t1", false))
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()

    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("touches again when the page is restored from the back/forward cache", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)

    pageShow(false)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    pageShow(true)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenLastCalledWith("touch_guest_ticket", { p_ticket_id: "t1" })
  })

  it("removes the pagehide and pageshow listeners on unmount and when disabled", async () => {
    const { rerender, unmount } = renderHook(({ enabled }) => useGuestPresence("t1", enabled), {
      initialProps: { enabled: true },
    })
    await vi.advanceTimersByTimeAsync(0)
    rerender({ enabled: false })
    window.dispatchEvent(new Event("pagehide"))
    pageShow(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)

    rerender({ enabled: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    unmount()
    window.dispatchEvent(new Event("pagehide"))
    pageShow(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it("never throws on pagehide when fetch rejects or throws", async () => {
    renderHook(() => useGuestPresence("t1", true))
    await vi.advanceTimersByTimeAsync(0)

    fetchMock.mockReturnValue(Promise.reject(new Error("offline")))
    expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow()
    fetchMock.mockImplementation(() => {
      throw new Error("no fetch")
    })
    expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("on the sign-in pages reports leave on pagehide only while our own guest, and stops on unmount", async () => {
    // A real account: nothing to report.
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-u", user: { id: "u1", is_anonymous: false } } } })
    const real = renderHook(() => useGuestSignInPresence())
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
    real.unmount()

    window.localStorage.setItem("githelp.ownGuestId", "g1")
    getSession.mockResolvedValue(guestSession())
    const guest = renderHook(() => useGuestSignInPresence())
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(LEAVE_URL)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok-1")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({})

    // bfcache restore: touches again.
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    pageShow(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)

    guest.unmount()
    window.dispatchEvent(new Event("pagehide"))
    pageShow(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })
})

describe("touchGuestTicketsNow (awaitable, for a guest coming back)", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset()
  })

  it("resolves once touch_guest_ticket has answered, with or without an id", async () => {
    let answer: (v: { error: null }) => void = () => {}
    vi.mocked(supabase.rpc).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)) as never)
    let done = false
    const pending = touchGuestTicketsNow("t1").then((ok) => {
      done = true
      return ok
    })
    await Promise.resolve()
    expect(supabase.rpc).toHaveBeenCalledWith("touch_guest_ticket", { p_ticket_id: "t1" })
    expect(done).toBe(false)
    answer({ error: null })
    await expect(pending).resolves.toBe(true)

    vi.mocked(supabase.rpc).mockReturnValueOnce(Promise.resolve({ error: null }) as never)
    await expect(touchGuestTicketsNow()).resolves.toBe(true)
    expect(vi.mocked(supabase.rpc).mock.calls[1]).toEqual(["touch_guest_ticket"])
  })

  it("never throws: false on an error answer or a rejected call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.mocked(supabase.rpc).mockReturnValueOnce(Promise.resolve({ error: { message: "denied" } }) as never)
    await expect(touchGuestTicketsNow("t1")).resolves.toBe(false)
    vi.mocked(supabase.rpc).mockReturnValueOnce(Promise.reject(new Error("network")) as never)
    await expect(touchGuestTicketsNow("t1")).resolves.toBe(false)
    warn.mockRestore()
  })
})
