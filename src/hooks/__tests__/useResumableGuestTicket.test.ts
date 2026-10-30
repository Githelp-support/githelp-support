import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"

const findOpenTicket = vi.fn()
vi.mock("@/lib/guest-session", () => ({
  findOpenTicket: (...args: unknown[]) => findOpenTicket(...args),
}))

import { useResumableGuestTicket } from "../useResumableGuestTicket"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

describe("useResumableGuestTicket", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resumes a guest's open guest ticket on the project", async () => {
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
    expect(findOpenTicket).toHaveBeenCalledWith("g1", "p1", { guestOnly: true })
  })

  it("never resumes for a signed-in user (they may open more tickets)", async () => {
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const { result } = renderHook(() => useResumableGuestTicket("u1", false, "p1"), { wrapper })
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data).toBeUndefined()
    expect(findOpenTicket).not.toHaveBeenCalled()
  })

  it("is disabled without a guest id or project", async () => {
    renderHook(() => useResumableGuestTicket(undefined, true, "p1"), { wrapper })
    renderHook(() => useResumableGuestTicket("g1", true, undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 10))
    expect(findOpenTicket).not.toHaveBeenCalled()
  })
})
