import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render } from "@testing-library/react"

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))
const invalidateQueries = vi.fn()
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: vi.fn(() => Promise.resolve({ error: null })), auth: { getSession: vi.fn() } },
}))

import { supabase } from "@/lib/supabase/client"
import { SupportGuestPresence } from "./support-guest-presence"
import { GUEST_PRESENCE_INTERVAL_MS } from "@/hooks/useGuestPresence"

describe("SupportGuestPresence (support layout)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(supabase.rpc).mockClear()
    invalidateQueries.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it("keeps our own guest's open tickets alive on any support page (no id)", () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<SupportGuestPresence />)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(["touch_guest_ticket"])
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it("refetches the guest's ticket once the first heartbeat is through (re-entry)", async () => {
    useUser.mockReturnValue({ user: { guestId: "g1" } })
    render(<SupportGuestPresence />)
    expect(invalidateQueries).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    const keys = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey[0])
    expect(keys).toEqual(["resumable-ticket", "ticket", "ticket-with-details", "ticket-messages"])
    await vi.advanceTimersByTimeAsync(GUEST_PRESENCE_INTERVAL_MS)
    expect(invalidateQueries).toHaveBeenCalledTimes(4)
  })

  it("does nothing for signed-in users and visitors without our guest", () => {
    useUser.mockReturnValue({ user: { id: "u1" } })
    render(<SupportGuestPresence />)
    useUser.mockReturnValue({ user: {} })
    render(<SupportGuestPresence />)
    vi.advanceTimersByTime(GUEST_PRESENCE_INTERVAL_MS * 2)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
