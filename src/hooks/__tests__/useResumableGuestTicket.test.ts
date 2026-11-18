import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"

// The real findOpenTicket runs against a fake Supabase client that records
// the order of the touch RPC and the tickets lookup.
const db = vi.hoisted(() => {
  const state = {
    calls: [] as Array<[string, ...unknown[]]>,
    rows: [] as Array<{ id: string; project_id: string }>,
    touchError: null as { message: string } | null,
  }
  const builder: Record<string, unknown> = {}
  for (const method of ["select", "eq", "is", "not", "order"]) {
    builder[method] = (...args: unknown[]) => {
      state.calls.push([method, ...args])
      return builder
    }
  }
  builder.limit = () => Promise.resolve({ data: state.rows, error: null })
  const supabase = {
    from: (...args: unknown[]) => {
      state.calls.push(["from", ...args])
      return builder
    },
    rpc: async (...args: unknown[]) => {
      // Recorded once finished: a lookup that did not wait for it would come first.
      await new Promise((resolve) => setTimeout(resolve, 5))
      state.calls.push(["rpc", ...args])
      return { error: state.touchError }
    },
  }
  return { state, supabase }
})
vi.mock("@/lib/supabase/client", () => ({ supabase: db.supabase }))

import { useGuestTicketReentry, useResumableGuestTicket } from "../useResumableGuestTicket"

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

const entryPoints = () => db.state.calls.filter(([method]) => method === "rpc" || method === "from")

beforeEach(() => {
  db.state.calls = []
  db.state.rows = []
  db.state.touchError = null
})

describe("useResumableGuestTicket", () => {
  it("resumes a guest's open guest ticket on the project", async () => {
    db.state.rows = [{ id: "t1", project_id: "p1" }]
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), setup())
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
    expect(db.state.calls).toEqual(
      expect.arrayContaining([
        ["eq", "created_by", "g1"],
        ["eq", "project_id", "p1"],
        ["eq", "guest", true],
        ["not", "status", "in", "(completed,cancelled)"],
      ]),
    )
  })

  it("touches the guest's tickets before the lookup, so a ticket cancelled on leave is reopened and found", async () => {
    db.state.rows = [{ id: "t1", project_id: "p1" }]
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), setup())
    await waitFor(() => expect(result.current.data).toEqual({ id: "t1", project_id: "p1" }))
    expect(entryPoints()).toEqual([["rpc", "touch_guest_ticket"], ["from", "tickets"]])
  })

  it("resolves to null when nothing can be resumed (e.g. hidden after 30 minutes)", async () => {
    const { result } = renderHook(() => useResumableGuestTicket("g1", true, "p1"), setup())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("never touches or resumes for a signed-in user (they may open more tickets)", async () => {
    db.state.rows = [{ id: "t1", project_id: "p1" }]
    const { result } = renderHook(() => useResumableGuestTicket("u1", false, "p1"), setup())
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.data).toBeUndefined()
    expect(db.state.calls).toEqual([])
  })

  it("is disabled without a guest id or project", async () => {
    const { wrapper } = setup()
    renderHook(() => useResumableGuestTicket(undefined, true, "p1"), { wrapper })
    renderHook(() => useResumableGuestTicket("g1", true, undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(db.state.calls).toEqual([])
  })
})

describe("useGuestTicketReentry (/support/chat?ticket=X for an own guest)", () => {
  it("is pending until the ticket was touched, then refetches the ticket and its messages", async () => {
    const { client, wrapper } = setup()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const { result } = renderHook(() => useGuestTicketReentry("t1", "g1"), { wrapper })
    expect(result.current.isPending).toBe(true)
    expect(invalidate).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(db.state.calls).toEqual([["rpc", "touch_guest_ticket", { p_ticket_id: "t1" }]])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-with-details", "t1"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket", "t1"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-messages", "t1"] })
  })

  it("does not refetch when the touch failed", async () => {
    db.state.touchError = { message: "boom" }
    const { client, wrapper } = setup()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const { result } = renderHook(() => useGuestTicketReentry("t1", "g1"), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("does nothing for a signed-in user or without a ticket", async () => {
    const { wrapper } = setup()
    const signedIn = renderHook(() => useGuestTicketReentry("t1", undefined), { wrapper })
    const noTicket = renderHook(() => useGuestTicketReentry(undefined, "g1"), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(signedIn.result.current.isPending).toBe(false)
    expect(noTicket.result.current.isPending).toBe(false)
    expect(db.state.calls).toEqual([])
  })
})
