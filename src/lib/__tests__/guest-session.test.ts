import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { ensureSupportSession, findGuestOpenTicket, findOpenTicket, isOwnGuestSession } from "../guest-session"

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

/** PostgREST-style query builder that records the filters applied. */
function ticketsClient(result: { data: unknown; error: unknown } | Error) {
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
  const from = vi.fn(() => builder)
  return { client: { from }, calls, from }
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
    const { client, from } = ticketsClient({ data: [], error: null })
    await expect(findGuestOpenTicket("", "p1", client as never)).resolves.toBeNull()
    await expect(findGuestOpenTicket("g1", "", client as never)).resolves.toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it("for a signed-in user resumes their own open ticket without the guest filter", async () => {
    const { client, calls } = ticketsClient({ data: [{ id: "t9", project_id: "p1" }], error: null })
    await expect(findOpenTicket("u1", "p1", {}, client as never)).resolves.toEqual({ id: "t9", project_id: "p1" })
    expect(calls).toContainEqual(["eq", "created_by", "u1"])
    expect(calls).not.toContainEqual(["eq", "guest", true])
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
