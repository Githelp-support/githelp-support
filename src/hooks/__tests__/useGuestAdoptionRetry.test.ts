import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"

const runGuestAdoptionFlow = vi.fn()
vi.mock("@/lib/guest-adoption", () => ({
  runGuestAdoptionFlow: (...args: unknown[]) => runGuestAdoptionFlow(...args),
  landingAfterGuestAdoption: () => null,
}))
vi.mock("@/lib/guest-adoption-toast", () => ({ notifyGuestAdoptionResult: vi.fn() }))

import { useGuestAdoptionRetry } from "../useGuestAdoptionRetry"
import { GUEST_ADOPTION_KEY } from "@/lib/guest-adoption-storage"

let visibility: DocumentVisibilityState = "visible"
function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event("visibilitychange"))
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

function saveKey() {
  window.localStorage.setItem(
    GUEST_ADOPTION_KEY,
    JSON.stringify({ access_token: "a", refresh_token: "r", user_id: "g1", saved_at: new Date().toISOString() }),
  )
}

describe("useGuestAdoptionRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    visibility = "visible"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  })

  it("never prompts from a hidden tab; starts when the tab becomes visible", async () => {
    saveKey()
    visibility = "hidden"
    runGuestAdoptionFlow.mockResolvedValue({ status: "deferred" })
    const { result } = renderHook(() => useGuestAdoptionRetry(true), { wrapper })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(runGuestAdoptionFlow).not.toHaveBeenCalled()
    expect(result.current.linking).toBe(true)

    await act(async () => {
      setVisibility("visible")
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(runGuestAdoptionFlow).toHaveBeenCalledTimes(1)
  })

  it("after 'later' it stops, shows the linking state, and 'Link conversation' asks again (force)", async () => {
    saveKey()
    runGuestAdoptionFlow.mockResolvedValue({ status: "deferred" })
    const { result } = renderHook(() => useGuestAdoptionRetry(true), { wrapper })
    await waitFor(() => expect(result.current.deferred).toBe(true))
    expect(result.current.linking).toBe(true)
    expect(runGuestAdoptionFlow).toHaveBeenCalledTimes(1)
    expect(runGuestAdoptionFlow.mock.calls[0][0]).toMatchObject({ force: false })

    // Switching tabs back doesn't re-prompt by itself.
    await act(async () => {
      setVisibility("hidden")
      setVisibility("visible")
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(runGuestAdoptionFlow).toHaveBeenCalledTimes(1)

    runGuestAdoptionFlow.mockResolvedValue({ status: "deferred" })
    await act(async () => {
      result.current.linkNow()
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(runGuestAdoptionFlow).toHaveBeenCalledTimes(2)
    expect(runGuestAdoptionFlow.mock.calls[1][0]).toMatchObject({ force: true })
  })

  it("does nothing without a key or when disabled", async () => {
    renderHook(() => useGuestAdoptionRetry(true), { wrapper })
    saveKey()
    renderHook(() => useGuestAdoptionRetry(false), { wrapper })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(runGuestAdoptionFlow).not.toHaveBeenCalled()
  })
})
