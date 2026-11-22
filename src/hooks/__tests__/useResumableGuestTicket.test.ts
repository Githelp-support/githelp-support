import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"

const findOpenTicket = vi.fn()
const touchGuestTicketsNow = vi.fn()
const order: string[] = []
// The real findResumableGuestTicket (touch, then look up) over a mocked lookup.
vi.mock("@/lib/guest-session", () => ({
  findResumableGuestTicket: async (guestId: string, projectId: string, touch: () => Promise<unknown>) => {
    await touch().catch(() => undefined)
    return findOpenTicket(guestId, projectId, { guestOnly: true })
  },
}))
vi.mock("@/hooks/useGuestPresence", () => ({
  touchGuestTicketsNow: (...args: unknown[]) => touchGuestTicketsNow(...args),
}))

import { invalidateGuestTicketQueries, useResumableGuestTicket } from "../useResumableGuestTicket"

let queryClient: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useResumableGuestTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    order.length = 0
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    touchGuestTicketsNow.mockImplementation(async () => {
      order.push("touch")
      return true
    })
    findOpenTicket.mockImplementation(async () => {
      order.push("lookup")
      return null
    })
  })

  it("resumes a guest's open guest ticket on the project", async () => {
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
    expect(findOpenTicket).toHaveBeenCalledWith("g1", "p1", { guestOnly: true })
  })

  it("waits for touch_guest_ticket (no id) before the lookup, so a ticket closed while away is reopened first", async () => {
    let finishTouch: (ok: boolean) => void = () => {}
    touchGuestTicketsNow.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          order.push("touch")
          finishTouch = resolve
        }),
    )
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(touchGuestTicketsNow).toHaveBeenCalledTimes(1))
    expect(touchGuestTicketsNow).toHaveBeenCalledWith()
    expect(findOpenTicket).not.toHaveBeenCalled()
    finishTouch(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(order).toEqual(["touch", "lookup"])
  })

  it("still looks the ticket up when the touch fails", async () => {
    touchGuestTicketsNow.mockRejectedValue(new Error("network"))
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
  })

  it("refetches the resumed ticket and its messages (no stale 'visitor left' state)", async () => {
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket", "t1"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-with-details", "t1"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-messages", "t1"] })
  })

  it("resolves to null without invalidating anything when the ticket is out of reach (expired)", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("never resumes for a signed-in user (they may open more tickets)", async () => {
    findOpenTicket.mockResolvedValue({ id: "t1", project_id: "p1" })
    const { result } = renderHook(() => useResumableGuestTicket("u1", false, "p1"), { wrapper })
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data).toBeUndefined()
    expect(findOpenTicket).not.toHaveBeenCalled()
    expect(touchGuestTicketsNow).not.toHaveBeenCalled()
  })

  it("is disabled without a guest id or project", async () => {
    renderHook(() => useResumableGuestTicket(undefined, true, "p1"), { wrapper })
    renderHook(() => useResumableGuestTicket("g1", true, undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 10))
    expect(findOpenTicket).not.toHaveBeenCalled()
    expect(touchGuestTicketsNow).not.toHaveBeenCalled()
  })
})

describe("invalidateGuestTicketQueries", () => {
  it("never rejects", async () => {
    const client = new QueryClient()
    vi.spyOn(client, "invalidateQueries").mockRejectedValue(new Error("boom"))
    await expect(invalidateGuestTicketQueries(client, "t1")).resolves.toBeUndefined()
  })
})
