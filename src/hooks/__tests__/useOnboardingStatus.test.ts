import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"

const getUser = vi.fn()
const from = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: (table: string) => from(table),
  },
}))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({ useUser: () => useUser() }))

import { latestOnboardingStatus, useOnboardingStatus } from "../useOnboardingStatus"

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client }, children)
}

describe("useOnboardingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it("never asks an anonymous guest to onboard (and doesn't query their membership)", async () => {
    useUser.mockReturnValue({ user: { guestId: "guest-1" } })
    getUser.mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: true } } })
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ needsOnboarding: false, needsWaiting: false, isMember: false })
    expect(from).not.toHaveBeenCalled()
  })

  it("is keyed by account, so a guest who signs in doesn't reuse the cached status", async () => {
    useUser.mockReturnValue({ user: { guestId: "guest-1" } })
    getUser.mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: true } } })
    const { result, rerender } = renderHook(() => useOnboardingStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Now a real account that needs onboarding.
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      limit: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: { onboarding_completed: false }, error: null }),
    }
    from.mockReturnValue(chain)
    getUser.mockResolvedValue({ data: { user: { id: "user-1", is_anonymous: false } } })
    useUser.mockReturnValue({ user: { id: "user-1" } })
    rerender()
    await waitFor(() => expect(result.current.data?.needsOnboarding).toBe(true))
    expect(client.getQueryData(["onboarding-status", "guest:guest-1"])).toMatchObject({ needsOnboarding: false })
  })

  it("the waiting page reads the per-account status (latestOnboardingStatus)", () => {
    client.setQueryData(["onboarding-status", "signed-out"], { needsWaiting: true, needsOnboarding: false })
    client.setQueryData(["onboarding-status", "user-1"], { needsWaiting: false, needsOnboarding: false }, { updatedAt: Date.now() + 1000 })
    // A bare key never matches the per-account entries.
    expect(client.getQueryData(["onboarding-status"])).toBeUndefined()
    expect(latestOnboardingStatus(client)).toMatchObject({ needsWaiting: false })
  })
})
