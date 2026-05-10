import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { useTickets } from "../useTickets"

// Mock Supabase client before any imports resolve it
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from "@/lib/supabase/client"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function mockChain(resolveWith: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  // Make the chain thenable so await works
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve)
  return chain
}

describe("useTickets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("is disabled and returns no data when projectId is not provided", () => {
    vi.mocked(supabase.from).mockReturnValue(mockChain({ data: [], error: null }) as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useTickets(), {
      wrapper: makeWrapper(),
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("uses a query key that includes the project ID", async () => {
    const tickets = [{ id: "t1", project_id: "proj-1" }]
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: tickets, error: null }) as ReturnType<typeof supabase.from>
    )

    const { result } = renderHook(() => useTickets("proj-1"), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Data should be the mocked tickets array
    expect(result.current.data).toEqual(tickets)
    // Supabase was called with the tickets table
    expect(supabase.from).toHaveBeenCalledWith("tickets")
  })

  it("exposes an error when the query fails", async () => {
    const dbError = new Error("DB connection failed")
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: dbError }) as ReturnType<typeof supabase.from>
    )

    const { result } = renderHook(() => useTickets("proj-error"), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBe(dbError)
  })

  it("returns an array of tickets on success", async () => {
    const tickets = [
      { id: "t1", project_id: "proj-2", title: "First" },
      { id: "t2", project_id: "proj-2", title: "Second" },
    ]
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: tickets, error: null }) as ReturnType<typeof supabase.from>
    )

    const { result } = renderHook(() => useTickets("proj-2"), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data).toHaveLength(2)
  })
})
