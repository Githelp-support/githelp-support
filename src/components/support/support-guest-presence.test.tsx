import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render } from "@testing-library/react"

const useUser = vi.fn()
const getSession = vi.fn()
const fetchMock = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: vi.fn(() => Promise.resolve({ error: null })), auth: { getSession: () => getSession() } },
}))

import { supabase } from "@/lib/supabase/client"
import { SupportGuestPresence } from "./support-guest-presence"
import { GUEST_PRESENCE_INTERVAL_MS } from "@/hooks/useGuestPresence"

describe("SupportGuestPresence (support layout)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(supabase.rpc).mockClear()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    fetchMock.mockReset()
    fetchMock.mockReturnValue(Promise.resolve({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("keeps our own guest's open tickets alive on any support page (no id)", () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<SupportGuestPresence />)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(["touch_guest_ticket"])
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it("does nothing for signed-in users and visitors without our guest", () => {
    useUser.mockReturnValue({ user: { id: "u1" } })
    render(<SupportGuestPresence />)
    useUser.mockReturnValue({ user: {} })
    render(<SupportGuestPresence />)
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 2)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("reports that our own guest closed the window (pagehide, no id), until unmounted", async () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    const { unmount } = render(<SupportGuestPresence />)
    await vi.advanceTimersByTimeAsync(0)

    // Switching tabs is not leaving.
    document.dispatchEvent(new Event("visibilitychange"))
    expect(fetchMock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://sb.test/rest/v1/rpc/leave_guest_ticket")
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { apikey: "anon-key", Authorization: "Bearer tok-1" },
    })
    expect(JSON.parse(init.body)).toEqual({})

    unmount()
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not report leave for signed-in users and visitors without our guest", async () => {
    useUser.mockReturnValue({ user: { id: "u1" } })
    render(<SupportGuestPresence />)
    useUser.mockReturnValue({ user: {} })
    render(<SupportGuestPresence />)
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event("pagehide"))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
