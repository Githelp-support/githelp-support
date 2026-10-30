import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const signOut = vi.fn()
vi.mock("@/lib/supabase/client", () => ({ supabase: { auth: { signOut: () => signOut() } } }))

import {
  GUEST_ADOPTION_KEY,
  GUEST_ADOPTION_MAX_AGE_MS,
  OWN_GUEST_ID_KEY,
  clearSavedGuestSession,
  isFinalAdoptionError,
  prepareGuestAdoption,
  readSavedGuestSession,
  refreshSavedGuestAdoption,
  runGuestAdoptionFlow,
  saveGuestSession,
  startGuestSignIn,
  supportSignInHref,
  landingAfterGuestAdoption,
  adoptionLandingForRedirect,
  GUEST_ADOPTION_LATER_MS,
  type GuestAdoptionChoice,
  type GuestAdoptionResult,
  type GuestTicketPreview,
} from "../guest-adoption"
import {
  GUEST_ADOPTION_LOCK_KEY,
  acquireGuestAdoptionLock,
  isGuestAdoptionLockedByOther,
  wasGuestAdoptionExpired,
  releaseGuestAdoptionLock,
  resetGuestAdoptionConfirmation,
} from "../guest-adoption-storage"
import { EdgeFunctionError } from "../functions-error"
import { logoutUser } from "../supabase/auth"
import { clearAccountUiState } from "../roles"
import { saveSupportDraft, takeSupportDraft } from "../support-draft"

function memoryStorage(ownGuestId: string | null = "guest-1") {
  const map = new Map<string, string>()
  if (ownGuestId) map.set(OWN_GUEST_ID_KEY, ownGuestId)
  return {
    map,
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void map.set(k, v)),
    removeItem: vi.fn((k: string) => void map.delete(k)),
  }
}

const GUEST = { id: "guest-1", is_anonymous: true }
const REAL = { id: "real-1", is_anonymous: false }
const PREVIEW: GuestTicketPreview[] = [
  { id: "t1", title: "Build fails", project_name: "Acme", status: "available", created_at: "2026-10-29T10:00:00Z" },
]

type Resp = { data: unknown; error: unknown }

/** invoke mock answering preview and adopt calls separately. */
function fnMock(opts: { preview?: Resp | (() => Resp | Promise<Resp>); adopt?: Resp | (() => Resp | Promise<Resp>) }) {
  return vi.fn(async (_name: string, { body }: { body: Record<string, unknown> }) => {
    const answer = body.preview ? opts.preview : opts.adopt
    if (typeof answer === "function") return answer()
    return answer ?? { data: {}, error: null }
  })
}

const previewOk = (tickets: GuestTicketPreview[] = PREVIEW): Resp => ({ data: { preview: true, tickets }, error: null })
const adoptOk = (ids = ["t1"], open = ["t1"]): Resp => ({ data: { adopted_ticket_ids: ids, open_ticket_ids: open }, error: null })

function makeClient(opts: {
  user?: { id: string; is_anonymous: boolean } | null
  refreshed?: { access_token: string; refresh_token: string; user: { id: string } } | null
  invoke?: ReturnType<typeof vi.fn>
  ownedIds?: string[]
  projects?: Record<string, string>
}) {
  const session = opts.user
    ? { access_token: "old-access", refresh_token: "old-refresh", user: { email: "ada@example.com", ...opts.user } }
    : null
  const afterIn = (ids: string[]) => ({
    eq: () => Promise.resolve({ data: (opts.ownedIds ?? []).map((id) => ({ id })), error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: ids.map((id) => ({ id, project_id: opts.projects?.[id] ?? null })), error: null }).then(
        resolve,
        reject,
      ),
  })
  const chain = {
    select: () => chain,
    in: (_col: string, ids: string[]) => afterIn(ids),
  }
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      refreshSession: vi
        .fn()
        .mockResolvedValue({ data: { session: opts.refreshed ?? null }, error: opts.refreshed ? null : new Error("no") }),
    },
    functions: { invoke: opts.invoke ?? vi.fn() },
    from: vi.fn(() => chain),
  }
}

const savedNow = (extra: Record<string, unknown> = {}) => ({
  access_token: "guest-access",
  refresh_token: "guest-refresh",
  user_id: "guest-1",
  saved_at: new Date().toISOString(),
  ...extra,
})

const fnError = (code: string | null, status: number | null) => new EdgeFunctionError("boom", { code, status })
const yes = () => Promise.resolve<GuestAdoptionChoice>("link")
const no = () => Promise.resolve<GuestAdoptionChoice>("discard")
const later = () => Promise.resolve<GuestAdoptionChoice>("later")

describe("guest adoption storage", () => {
  it("round-trips and clears the saved guest session", () => {
    const storage = memoryStorage()
    const saved = savedNow()
    expect(readSavedGuestSession(storage)).toBeNull()
    expect(saveGuestSession(saved, storage)).toBe(true)
    expect(JSON.parse(storage.map.get(GUEST_ADOPTION_KEY)!)).toEqual(saved)
    expect(readSavedGuestSession(storage)).toEqual(saved)
    clearSavedGuestSession(storage)
    expect(readSavedGuestSession(storage)).toBeNull()
  })

  it("ignores and deletes a key older than 60 minutes", () => {
    const storage = memoryStorage()
    const t0 = Date.parse("2026-10-29T10:00:00.000Z")
    saveGuestSession(savedNow({ saved_at: new Date(t0).toISOString() }), storage)
    expect(readSavedGuestSession(storage, () => t0 + GUEST_ADOPTION_MAX_AGE_MS - 1000)).not.toBeNull()
    expect(readSavedGuestSession(storage, () => t0 + GUEST_ADOPTION_MAX_AGE_MS + 1000)).toBeNull()
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("deletes entries without a valid saved_at and malformed entries", () => {
    const storage = memoryStorage()
    storage.map.set(GUEST_ADOPTION_KEY, JSON.stringify(savedNow({ saved_at: "" })))
    expect(readSavedGuestSession(storage)).toBeNull()
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
    storage.map.set(GUEST_ADOPTION_KEY, "{not json")
    expect(readSavedGuestSession(storage)).toBeNull()
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("survives storage that throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readSavedGuestSession(throwing)).toBeNull()
    expect(saveGuestSession(savedNow(), throwing)).toBe(false)
    expect(() => clearSavedGuestSession(throwing)).not.toThrow()
  })

  it("key and own guest id are cleared on sign-out", async () => {
    saveGuestSession(savedNow(), window.localStorage)
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "guest-1")
    signOut.mockResolvedValue({ error: null })
    await logoutUser()
    expect(window.localStorage.getItem(GUEST_ADOPTION_KEY)).toBeNull()
    expect(window.localStorage.getItem(OWN_GUEST_ID_KEY)).toBeNull()

    saveGuestSession(savedNow(), window.localStorage)
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "guest-1")
    clearAccountUiState()
    expect(window.localStorage.getItem(GUEST_ADOPTION_KEY)).toBeNull()
    expect(window.localStorage.getItem(OWN_GUEST_ID_KEY)).toBeNull()
  })
})

describe("saving the guest session (ownGuestId gating)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("saves fresh tokens for the guest this browser created", async () => {
    const storage = memoryStorage()
    const client = makeClient({
      user: GUEST,
      refreshed: { access_token: "new-access", refresh_token: "new-refresh", user: { id: "guest-1" } },
    })
    await expect(prepareGuestAdoption({ client: client as never, storage })).resolves.toBe(true)
    expect(readSavedGuestSession(storage)).toMatchObject({ access_token: "new-access", user_id: "guest-1" })
  })

  it("refuses a planted guest session (not created by this browser)", async () => {
    for (const storage of [memoryStorage(null), memoryStorage("someone-else")]) {
      const client = makeClient({ user: GUEST })
      await expect(prepareGuestAdoption({ client: client as never, storage })).resolves.toBe(false)
      expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
      expect(client.auth.refreshSession).not.toHaveBeenCalled()
    }
  })

  it("does nothing for a real user or no session", async () => {
    const storage = memoryStorage()
    await expect(prepareGuestAdoption({ client: makeClient({ user: REAL }) as never, storage })).resolves.toBe(false)
    await expect(prepareGuestAdoption({ client: makeClient({ user: null }) as never, storage })).resolves.toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("the sign-in page only refreshes an existing key, without extending saved_at", async () => {
    const storage = memoryStorage()
    const client = makeClient({
      user: GUEST,
      refreshed: { access_token: "new-access", refresh_token: "new-refresh", user: { id: "guest-1" } },
    })
    await expect(refreshSavedGuestAdoption({ client: client as never, storage })).resolves.toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()

    const savedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    saveGuestSession(savedNow({ saved_at: savedAt }), storage)
    await expect(refreshSavedGuestAdoption({ client: client as never, storage })).resolves.toBe(true)
    expect(readSavedGuestSession(storage)).toMatchObject({ access_token: "new-access", saved_at: savedAt })
  })

  it("startGuestSignIn saves, then navigates to sign-in with the redirect", async () => {
    const storage = memoryStorage()
    const navigate = vi.fn()
    await startGuestSignIn("/support/chat?ticket=t1&project=p1", navigate, {
      client: makeClient({ user: GUEST }) as never,
      storage,
    })
    expect(readSavedGuestSession(storage)).not.toBeNull()
    expect(navigate).toHaveBeenCalledWith(supportSignInHref("/support/chat?ticket=t1&project=p1"))
  })
})

describe("isFinalAdoptionError", () => {
  it("clears for definitive 4xx answers, keeps for network / 5xx / throttling", () => {
    expect(isFinalAdoptionError(fnError("invalid_guest_token", 400))).toBe(true)
    expect(isFinalAdoptionError(fnError("sign_in_required", 403))).toBe(true)
    expect(isFinalAdoptionError(fnError(null, 404))).toBe(true)
    expect(isFinalAdoptionError(fnError(null, 500))).toBe(false)
    expect(isFinalAdoptionError(fnError(null, 429))).toBe(false)
    expect(isFinalAdoptionError(new Error("Failed to fetch"))).toBe(false)
  })
})

describe("runGuestAdoptionFlow", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
    vi.useRealTimers()
  })

  it("returns none without a saved key", async () => {
    const invoke = fnMock({})
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage: memoryStorage(), confirm: yes })
    expect(result).toEqual({ status: "none" })
    expect(invoke).not.toHaveBeenCalled()
  })

  it("refuses a key for a guest this browser didn't create (planted session)", async () => {
    const storage = memoryStorage("guest-mine")
    saveGuestSession(savedNow({ user_id: "guest-attacker" }), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(result).toEqual({ status: "none" })
    expect(invoke).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("keeps the key while the session is still the guest", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({})
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: GUEST, invoke }) as never, storage, confirm: yes })
    expect(result).toEqual({ status: "none" })
    expect(invoke).not.toHaveBeenCalled()
    expect(readSavedGuestSession(storage)).not.toBeNull()
  })

  it("previews, asks, and adopts on confirm; then clears key and own guest id", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk(["t1"], ["t1"]) })
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(invoke.mock.calls[0][1]).toEqual({
      body: { guest_access_token: "guest-access", preview: true, expected_user_id: "real-1" },
    })
    expect(confirm).toHaveBeenCalledWith(PREVIEW, "ada@example.com")
    expect(invoke.mock.calls[1][1]).toEqual({ body: { guest_access_token: "guest-access", expected_user_id: "real-1" } })
    expect(result).toEqual({
      status: "adopted",
      adoptedTicketIds: ["t1"],
      openTicketIds: ["t1"],
      openTickets: [{ id: "t1", project_id: null }],
    })
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
    expect(storage.map.has(OWN_GUEST_ID_KEY)).toBe(false)
  })

  it("'Not mine — discard' clears the key and adopts nothing", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm: no })
    expect(result).toEqual({ status: "discarded", ticketIds: ["t1"] })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("clears the key silently when there is nothing to link", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk([]) })
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(result).toEqual({ status: "none" })
    expect(confirm).not.toHaveBeenCalled()
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("remembers the confirmation: a retry after a 5xx skips the preview and the dialog", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: { data: null, error: fnError(null, 500) } })
    const confirm = vi.fn(yes)
    const deps = { client: makeClient({ user: REAL, invoke }) as never, storage, confirm }
    const first = await runGuestAdoptionFlow(deps)
    expect(first).toMatchObject({ status: "failed", retryable: true })
    expect(readSavedGuestSession(storage)).toMatchObject({ confirmed: true, confirmed_by: "real-1", ticket_ids: ["t1"] })

    invoke.mockClear()
    const retryInvoke = fnMock({ adopt: adoptOk() })
    const second = await runGuestAdoptionFlow({ ...deps, client: makeClient({ user: REAL, invoke: retryInvoke }) as never })
    expect(second.status).toBe("adopted")
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(retryInvoke).toHaveBeenCalledTimes(1)
    expect(retryInvoke.mock.calls[0][1]).toEqual({ body: { guest_access_token: "guest-access", expected_user_id: "real-1" } })
  })

  it("keeps the key on a network error", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    const invoke = fnMock({ adopt: () => Promise.reject(new Error("network down")) })
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm: yes })
    expect(result).toMatchObject({ status: "failed", message: "network down", retryable: true })
    expect(readSavedGuestSession(storage)).not.toBeNull()
  })

  it("a definitive 4xx clears the key (refreshing the guest token once first)", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    const invoke = fnMock({ adopt: { data: null, error: fnError("invalid_guest_token", 400) } })
    const refreshGuestSession = vi.fn().mockResolvedValue("fresh-access")
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      refreshGuestSession,
      confirm: yes,
    })
    expect(refreshGuestSession).toHaveBeenCalledWith("guest-refresh")
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ status: "failed", code: "invalid_guest_token", retryable: false })
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("treats invalid_guest_token as success when the confirmed tickets are already ours", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1", ticket_ids: ["t1"] }), storage)
    const invoke = fnMock({ adopt: { data: null, error: fnError("invalid_guest_token", 400) } })
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke, ownedIds: ["t1"] }) as never,
      storage,
      refreshGuestSession: vi.fn().mockResolvedValue(null),
      confirm: yes,
    })
    expect(result).toEqual({ status: "adopted", adoptedTicketIds: ["t1"], openTicketIds: [] })
    expect(storage.map.has(GUEST_ADOPTION_KEY)).toBe(false)
  })

  it("does not report a failure when another run already finished (key gone)", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    const invoke = fnMock({
      adopt: () => {
        storage.map.delete(GUEST_ADOPTION_KEY)
        return { data: null, error: fnError("invalid_guest_token", 400) }
      },
    })
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      refreshGuestSession: vi.fn().mockResolvedValue(null),
      confirm: yes,
    })
    expect(result).toEqual({ status: "none" })
  })

  it("concurrent calls share one run (one dialog, one adoption)", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const confirm = vi.fn(yes)
    const deps = { client: makeClient({ user: REAL, invoke }) as never, storage, confirm }
    const [a, b] = await Promise.all([runGuestAdoptionFlow(deps), runGuestAdoptionFlow(deps)])
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(a).toEqual(b)
  })

  it("resolves with timeout when a network step exceeds timeoutMs and keeps the key", async () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    const invoke = fnMock({ adopt: () => new Promise<Resp>(() => {}) })
    const pending = runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      timeoutMs: 10_000,
      confirm: yes,
    })
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(pending).resolves.toEqual({ status: "timeout" })
    expect(readSavedGuestSession(storage)).not.toBeNull()
  })
})

describe("confirmation details", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
    vi.useRealTimers()
  })

  it("dismissing the dialog keeps the key and adopts nothing", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm: later })
    expect(result).toEqual({ status: "deferred" })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(readSavedGuestSession(storage)).not.toBeNull()
    expect(readSavedGuestSession(storage)?.confirmed).toBeUndefined()
  })

  it("a confirmation by another account doesn't count: it asks again", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "someone-else" }), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(invoke.mock.calls[0][1]).toMatchObject({ body: { preview: true } })
    expect(result.status).toBe("adopted")
  })

  it("SIGNED_IN for a different account resets the confirmation", () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    resetGuestAdoptionConfirmation("real-1", storage)
    expect(readSavedGuestSession(storage)).toMatchObject({ confirmed: true, confirmed_by: "real-1" })
    resetGuestAdoptionConfirmation("real-2", storage)
    const saved = readSavedGuestSession(storage)
    expect(saved?.confirmed).toBeUndefined()
    expect(saved?.confirmed_by).toBeUndefined()
    expect(saved?.access_token).toBe("guest-access")
  })

  it("another tab holding the lock: this tab waits, never prompts, and reports elsewhere", async () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    expect(acquireGuestAdoptionLock("other-tab", storage)).toBe(true)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const confirm = vi.fn(yes)
    const pending = runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      confirm,
      tabId: "this-tab",
    })
    await vi.advanceTimersByTimeAsync(3000)
    releaseGuestAdoptionLock("other-tab", storage)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ status: "elsewhere" })
    expect(confirm).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it("an expired lock from a crashed tab is taken over", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    storage.map.set(GUEST_ADOPTION_LOCK_KEY, JSON.stringify({ owner: "crashed", expires_at: Date.now() - 1 }))
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      confirm: yes,
      tabId: "this-tab",
    })
    expect(result.status).toBe("adopted")
    // Released when done.
    expect(storage.map.has(GUEST_ADOPTION_LOCK_KEY)).toBe(false)
  })
})

describe("landingAfterGuestAdoption", () => {
  const adopted = (openTickets: Array<{ id: string; project_id: string | null }>) =>
    ({ status: "adopted", adoptedTicketIds: openTickets.map((t) => t.id), openTicketIds: openTickets.map((t) => t.id), openTickets }) as const

  it("goes to the open ticket on the current project when the URL has no ticket", () => {
    expect(
      landingAfterGuestAdoption(
        adopted([
          { id: "a", project_id: "p0" },
          { id: "b", project_id: "p1" },
        ]),
        "/support/chat?project=p1",
      ),
    ).toBe("/support/chat?ticket=b&project=p1")
  })

  it("falls back to the first open ticket (e.g. from the welcome page)", () => {
    expect(landingAfterGuestAdoption(adopted([{ id: "a", project_id: "p0" }]), "/support?slug=acme")).toBe(
      "/support/chat?ticket=a&project=p0",
    )
  })

  it("stays when the URL already shows one of the open tickets", () => {
    expect(landingAfterGuestAdoption(adopted([{ id: "a", project_id: "p0" }]), "/support/chat?ticket=a&project=p0")).toBeNull()
  })

  it("moves off a ticket that isn't among the open ones (reopened elsewhere)", () => {
    expect(landingAfterGuestAdoption(adopted([{ id: "b", project_id: "p0" }]), "/support/chat?ticket=a&project=p0")).toBe(
      "/support/chat?ticket=b&project=p0",
    )
  })

  it("does nothing without open tickets", () => {
    expect(landingAfterGuestAdoption(adopted([]), "/support/chat?project=p0")).toBeNull()
  })

  it("after a discard, a chat on a discarded ticket becomes a fresh composer", () => {
    expect(
      landingAfterGuestAdoption({ status: "discarded", ticketIds: ["t1"] }, "/support/chat?ticket=t1&project=p1"),
    ).toBe("/support/chat?project=p1")
    expect(landingAfterGuestAdoption({ status: "discarded", ticketIds: ["t1"] }, "/support/chat?ticket=t1")).toBe(
      "/support/chat",
    )
    expect(landingAfterGuestAdoption({ status: "discarded", ticketIds: ["t1"] }, "/support/chat?ticket=t9&project=p1")).toBeNull()
    expect(landingAfterGuestAdoption({ status: "discarded", ticketIds: ["t1"] }, "/tickets")).toBeNull()
  })
})

describe("round 4: later, lock takeover, capped wait, invites, drafts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
    vi.useRealTimers()
  })

  it("'later' is remembered: no automatic re-prompt for 10 minutes unless forced", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    let t = Date.now()
    const now = () => t
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const deps = { client: makeClient({ user: REAL, invoke }) as never, storage, now }
    const confirm = vi.fn(later)
    await expect(runGuestAdoptionFlow({ ...deps, confirm })).resolves.toEqual({ status: "deferred" })
    expect(readSavedGuestSession(storage, now)?.later_at).toBe(t)

    confirm.mockClear()
    invoke.mockClear()
    await expect(runGuestAdoptionFlow({ ...deps, confirm })).resolves.toEqual({ status: "deferred" })
    expect(confirm).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()

    // "Link conversation" forces the prompt.
    const linkConfirm = vi.fn(yes)
    const forced = await runGuestAdoptionFlow({ ...deps, confirm: linkConfirm, force: true })
    expect(linkConfirm).toHaveBeenCalledTimes(1)
    expect(forced.status).toBe("adopted")

    // And after 10 minutes it may ask by itself again (adoption above cleared
    // the own guest id; mark a new guest of ours).
    storage.map.set(OWN_GUEST_ID_KEY, "guest-1")
    saveGuestSession(savedNow({ later_at: t }), storage)
    t += GUEST_ADOPTION_LATER_MS + 1
    const again = vi.fn(later)
    await runGuestAdoptionFlow({ ...deps, client: makeClient({ user: REAL, invoke: fnMock({ preview: previewOk() }) }) as never, confirm: again })
    expect(again).toHaveBeenCalledTimes(1)
  })

  it("waiting for another tab is capped by timeoutMs (sign-in pages never hang)", async () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    acquireGuestAdoptionLock("other-tab", storage, Date.now, true)
    const confirm = vi.fn(yes)
    const pending = runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke: fnMock({}) }) as never,
      storage,
      confirm,
      tabId: "this-tab",
      timeoutMs: 10_000,
      isVisible: () => true,
    })
    await vi.advanceTimersByTimeAsync(11_000)
    await expect(pending).resolves.toEqual({ status: "timeout" })
    expect(confirm).not.toHaveBeenCalled()
  })

  it("a visible tab takes over a lock held by a hidden tab", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    acquireGuestAdoptionLock("hidden-tab", storage, Date.now, false)
    expect(isGuestAdoptionLockedByOther("visible-tab", storage, Date.now, true)).toBe(false)
    expect(isGuestAdoptionLockedByOther("other-hidden", storage, Date.now, false)).toBe(true)
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke: fnMock({ preview: previewOk(), adopt: adoptOk() }) }) as never,
      storage,
      confirm,
      tabId: "visible-tab",
      isVisible: () => true,
    })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("adopted")
  })

  it("a hidden tab can't take over a visible tab's lock", () => {
    const storage = memoryStorage()
    acquireGuestAdoptionLock("visible-tab", storage, Date.now, true)
    expect(acquireGuestAdoptionLock("hidden-tab", storage, Date.now, false)).toBe(false)
    expect(acquireGuestAdoptionLock("another-visible", storage, Date.now, true)).toBe(false)
  })

  it("invite / project-join redirects win over the adoption landing", () => {
    const adopted: GuestAdoptionResult = {
      status: "adopted",
      adoptedTicketIds: ["t1"],
      openTicketIds: ["t1"],
      openTickets: [{ id: "t1", project_id: "p1" }],
    }
    expect(adoptionLandingForRedirect(adopted, "/invite/abc")).toBeNull()
    expect(adoptionLandingForRedirect(adopted, "/projects/p9")).toBeNull()
    expect(adoptionLandingForRedirect(adopted, "/support?slug=acme")).toBe("/support/chat?ticket=t1&project=p1")
  })

  it("sign-out clears unsent support drafts", async () => {
    window.localStorage.clear()
    saveSupportDraft("p1", "q1")
    saveSupportDraft("p2", "q2")
    signOut.mockResolvedValue({ error: null })
    await logoutUser()
    expect(takeSupportDraft("p1")).toBeNull()
    expect(takeSupportDraft("p2")).toBeNull()

    saveSupportDraft("p1", "q1")
    clearAccountUiState()
    expect(takeSupportDraft("p1")).toBeNull()
  })
})

describe("round 5: binding, superseded, expiry marker, visibility", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => errorSpy.mockRestore())

  it("a key replaced while the dialog was open is previewed again, not confirmed blindly", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ saved_at: new Date(Date.now() - 1000).toISOString() }), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    let calls = 0
    const confirm = vi.fn(async () => {
      calls++
      // First dialog: meanwhile a new key was saved (another guest sign-in click).
      if (calls === 1) saveGuestSession(savedNow({ access_token: "newer" }), storage)
      return "link" as GuestAdoptionChoice
    })
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(confirm).toHaveBeenCalledTimes(2)
    const previews = invoke.mock.calls.filter((c) => (c[1] as { body: { preview?: boolean } }).body.preview)
    expect(previews).toHaveLength(2)
    expect(result.status).toBe("adopted")
  })

  it("409 account_changed on adopt starts over and asks the current account", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow({ confirmed: true, confirmed_by: "real-1" }), storage)
    let adoptCalls = 0
    const invoke = fnMock({
      preview: previewOk(),
      adopt: () => {
        adoptCalls++
        return adoptCalls === 1 ? { data: null, error: fnError("account_changed", 409) } : adoptOk()
      },
    })
    const confirm = vi.fn(yes)
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("adopted")
  })

  it("409 account_changed on preview starts over (not a final failure)", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    let previewCalls = 0
    const invoke = fnMock({
      preview: () => {
        previewCalls++
        return previewCalls === 1 ? { data: null, error: fnError("account_changed", 409) } : previewOk()
      },
      adopt: adoptOk(),
    })
    const result = await runGuestAdoptionFlow({ client: makeClient({ user: REAL, invoke }) as never, storage, confirm: yes })
    expect(previewCalls).toBe(2)
    expect(result.status).toBe("adopted")
  })

  it("a dialog closed by a tab takeover / sign-out ('superseded') is not remembered as later", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const invoke = fnMock({ preview: previewOk(), adopt: adoptOk() })
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke }) as never,
      storage,
      confirm: () => Promise.resolve<GuestAdoptionChoice>("superseded"),
    })
    expect(result).toEqual({ status: "elsewhere" })
    expect(readSavedGuestSession(storage)?.later_at).toBeUndefined()
  })

  it("'Not mine — discard' also clears unsent drafts", async () => {
    window.localStorage.clear()
    saveSupportDraft("p1", "draft")
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    const result = await runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke: fnMock({ preview: previewOk() }) }) as never,
      storage,
      confirm: no,
    })
    expect(result.status).toBe("discarded")
    expect(takeSupportDraft("p1")).toBeNull()
  })

  it("the dialog only opens once the tab is visible", async () => {
    const storage = memoryStorage()
    saveGuestSession(savedNow(), storage)
    let visible = false
    const confirm = vi.fn(yes)
    const pending = runGuestAdoptionFlow({
      client: makeClient({ user: REAL, invoke: fnMock({ preview: previewOk(), adopt: adoptOk() }) }) as never,
      storage,
      confirm,
      isVisible: () => visible,
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(confirm).not.toHaveBeenCalled()
    visible = true
    document.dispatchEvent(new Event("visibilitychange"))
    await expect(pending).resolves.toMatchObject({ status: "adopted" })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it("an expired key leaves a marker; saving a new key clears it", () => {
    const storage = memoryStorage()
    const t0 = Date.parse("2026-10-29T10:00:00.000Z")
    saveGuestSession(savedNow({ saved_at: new Date(t0).toISOString() }), storage)
    expect(wasGuestAdoptionExpired(storage, () => t0)).toBe(false)
    expect(readSavedGuestSession(storage, () => t0 + GUEST_ADOPTION_MAX_AGE_MS + 1)).toBeNull()
    expect(wasGuestAdoptionExpired(storage, () => t0 + GUEST_ADOPTION_MAX_AGE_MS + 2)).toBe(true)
    saveGuestSession(savedNow(), storage)
    expect(wasGuestAdoptionExpired(storage)).toBe(false)
  })
})
