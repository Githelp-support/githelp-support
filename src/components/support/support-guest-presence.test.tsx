import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render } from "@testing-library/react"

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ error: null })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "guest-token" } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import { supabase } from "@/lib/supabase/client"
import { SupportGuestPresence } from "./support-guest-presence"
import { GUEST_PRESENCE_INTERVAL_MS } from "@/hooks/useGuestPresence"

const fetchMock = vi.fn()

describe("SupportGuestPresence (support layout)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(supabase.rpc).mockClear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("keeps our own guest's open tickets alive on any support page (no id)", () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<SupportGuestPresence />)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(["touch_guest_ticket"])
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it("reports our own guest closing the window with one keepalive leave call for all tickets", async () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<SupportGuestPresence />)
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/leave_guest_ticket")
    expect(init).toMatchObject({
      keepalive: true,
      headers: { apikey: "anon-key", Authorization: "Bearer guest-token" },
    })
    expect(JSON.parse(init.body)).toEqual({})
  })

  it("touches again when the page is shown or becomes visible, and never leaves on unmount", async () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    const { unmount } = render(<SupportGuestPresence />)
    await vi.advanceTimersByTimeAsync(0)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event("pageshow"))
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    document.dispatchEvent(new Event("visibilitychange"))
    expect(supabase.rpc).toHaveBeenCalledTimes(3)

    // In-app navigation away from /support unmounts the layout: not a leave.
    unmount()
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does nothing for signed-in users and visitors without our guest", async () => {
    useUser.mockReturnValue({ user: { id: "u1" } })
    render(<SupportGuestPresence />)
    useUser.mockReturnValue({ user: {} })
    render(<SupportGuestPresence />)
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS * 2)
    window.dispatchEvent(new Event("pageshow"))
    window.dispatchEvent(new Event("pagehide"))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
