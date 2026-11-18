import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { ensureSupportSession, findGuestOpenTicket, findOpenTicket, isOwnGuestSession, touchGuestTicket } from "../guest-session"

function client(session: unknown, anon: { data: unknown; error: unknown } = { data: { user: null }, error: null }) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      signInAnonymously: vi.fn().mockResolvedValue(anon),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

function store(own: string | null = null) {
  const map = new Map<string, string>()
  if (own) map.set("githelp.ownGuestId", own)
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe("ensureSupportSession", () => {
  it("reuses an existing session", async () => {
    const c = client({ user: { id: "u1", is_anonymous: false } })
    await expect(ensureSupportSession(c as never, store())).resolves.toEqual({ ok: true, userId: "u1", isGuest: false })
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it("signs in anonymously when there is no session and marks the guest as this browser's own", async () => {
    const c = client(null, { data: { user: { id: "g1" } }, error: null })
    const s = store()
    await expect(ensureSupportSession(c as never, s)).resolves.toEqual({ ok: true, userId: "g1", isGuest: true })
    expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(s.map.get("githelp.ownGuestId")).toBe("g1")
  })

  it("reuses this browser's own guest session", async () => {
    const c = client({ user: { id: "g1", is_anonymous: true } })
    await expect(ensureSupportSession(c as never, store("g1"))).resolves.toEqual({ ok: true, userId: "g1", isGuest: true })
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it("replaces a planted guest session with a fresh one of our own", async () => {
    const c = client({ user: { id: "attacker", is_anonymous: true } }, { data: { user: { id: "g2" } }, error: null })
    const s = store()
    await expect(ensureSupportSession(c as never, s)).resolves.toEqual({ ok: true, userId: "g2", isGuest: true })
    expect(c.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(s.map.get("githelp.ownGuestId")).toBe("g2")
  })

  it("reports a failed anonymous sign-in", async () => {
    const c = client(null, { data: { user: null }, error: { message: "Anonymous sign-ins are disabled" } })
    await expect(ensureSupportSession(c as never, store())).resolves.toEqual({
      ok: false,
      message: "Anonymous sign-ins are disabled",
    })
  })
})

/** PostgREST-style query builder that records the RPCs and filters applied, in order. */
function ticketsClient(
  result: { data: unknown; error: unknown } | Error,
  touch: { error: unknown } | Error = { error: null },
) {
  const calls: Array<[string, ...unknown[]]> = []
  const builder: Record<string, unknown> = {}
  for (const method of ["select", "eq", "is", "not", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return builder
    }
  }
  builder.limit = (...args: unknown[]) => {
    calls.push(["limit", ...args])
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  }
  const from = vi.fn((...args: unknown[]) => {
    calls.push(["from", ...args])
    return builder
  })
  const rpc = vi.fn(async (...args: unknown[]) => {
    // Recorded once the call has finished: a lookup that did not wait for it would come first.
    await new Promise((resolve) => setTimeout(resolve, 5))
    calls.push(["rpc", ...args])
    if (touch instanceof Error) throw touch
    return touch
  })
  return { client: { from, rpc }, calls, from, rpc }
}

describe("findGuestOpenTicket", () => {
  it("looks up the guest's own open guest ticket on the project, newest first", async () => {
    const { client, calls, from } = ticketsClient({ data: [{ id: "t1", project_id: "p1" }], error: null })
    await expect(findGuestOpenTicket("g1", "p1", client as never)).resolves.toEqual({ id: "t1", project_id: "p1" })
    expect(from).toHaveBeenCalledWith("tickets")
    expect(calls).toEqual(
      expect.arrayContaining([
        ["eq", "created_by", "g1"],
        ["eq", "project_id", "p1"],
        ["eq", "guest", true],
        ["is", "deleted_at", null],
        ["not", "status", "in", "(completed,cancelled)"],
        ["order", "created_at", { ascending: false }],
        ["limit", 1],
      ]),
    )
  })

  it("touches the guest's tickets and waits for it before the lookup (re-entry within 30 minutes)", async () => {
    const { client, calls, rpc } = ticketsClient({ data: [{ id: "t1", project_id: "p1" }], error: null })
    await expect(findOpenTicket("g1", "p1", { guestOnly: true }, client as never)).resolves.toEqual({ id: "t1", project_id: "p1" })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("touch_guest_ticket")
    expect(calls.slice(0, 2)).toEqual([["rpc", "touch_guest_ticket"], ["from", "tickets"]])
  })

  it("still looks the ticket up when the touch fails", async () => {
    const rows = { data: [{ id: "t1", project_id: "p1" }], error: null }
    const failed = ticketsClient(rows, { error: { message: "boom" } })
    await expect(findGuestOpenTicket("g1", "p1", failed.client as never)).resolves.toEqual({ id: "t1", project_id: "p1" })
    const thrown = ticketsClient(rows, new Error("network"))
    await expect(findGuestOpenTicket("g1", "p1", thrown.client as never)).resolves.toEqual({ id: "t1", project_id: "p1" })
    expect(thrown.from).toHaveBeenCalledWith("tickets")
  })

  it("returns null when there is no open ticket", async () => {
    const { client } = ticketsClient({ data: [], error: null })
    await expect(findGuestOpenTicket("g1", "p1", client as never)).resolves.toBeNull()
  })

  it("returns null on errors and never throws", async () => {
    await expect(
      findGuestOpenTicket("g1", "p1", ticketsClient({ data: null, error: { message: "denied" } }).client as never),
    ).resolves.toBeNull()
    await expect(findGuestOpenTicket("g1", "p1", ticketsClient(new Error("network")).client as never)).resolves.toBeNull()
  })

  it("skips the lookup without ids", async () => {
    const { client, from, rpc } = ticketsClient({ data: [], error: null })
    await expect(findGuestOpenTicket("", "p1", client as never)).resolves.toBeNull()
    await expect(findGuestOpenTicket("g1", "", client as never)).resolves.toBeNull()
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("for a signed-in user resumes their own open ticket without the guest filter", async () => {
    const { client, calls, rpc } = ticketsClient({ data: [{ id: "t9", project_id: "p1" }], error: null })
    await expect(findOpenTicket("u1", "p1", {}, client as never)).resolves.toEqual({ id: "t9", project_id: "p1" })
    expect(calls).toContainEqual(["eq", "created_by", "u1"])
    expect(calls).not.toContainEqual(["eq", "guest", true])
    // Signed-in users have no guest presence: nothing is touched.
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("touchGuestTicket", () => {
  it("touches one ticket by id, or all of the guest's tickets without one", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    await expect(touchGuestTicket("t1", { rpc } as never)).resolves.toBe(true)
    expect(rpc).toHaveBeenLastCalledWith("touch_guest_ticket", { p_ticket_id: "t1" })
    await expect(touchGuestTicket(null, { rpc } as never)).resolves.toBe(true)
    expect(rpc).toHaveBeenLastCalledWith("touch_guest_ticket")
  })

  it("reports failure and never throws", async () => {
    await expect(touchGuestTicket("t1", { rpc: vi.fn().mockResolvedValue({ error: { message: "x" } }) } as never)).resolves.toBe(false)
    await expect(touchGuestTicket("t1", { rpc: vi.fn().mockRejectedValue(new Error("network")) } as never)).resolves.toBe(false)
  })
})

describe("isOwnGuestSession (sign-in buttons decide from the session itself)", () => {
  it("is true only for this browser's own anonymous session", async () => {
    await expect(isOwnGuestSession(client({ user: { id: "g1", is_anonymous: true } }) as never, store("g1"))).resolves.toBe(true)
    await expect(isOwnGuestSession(client({ user: { id: "g1", is_anonymous: true } }) as never, store("other"))).resolves.toBe(false)
    await expect(isOwnGuestSession(client({ user: { id: "u1", is_anonymous: false } }) as never, store("u1"))).resolves.toBe(false)
    await expect(isOwnGuestSession(client(null) as never, store("g1"))).resolves.toBe(false)
  })
})
