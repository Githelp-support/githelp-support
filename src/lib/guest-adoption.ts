import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { isAnonymousUser, isSignedInUser } from "@/lib/supabase/auth-state"
import { toEdgeFunctionError } from "@/lib/functions-error"
import { handlesOwnOnboarding, signInHref } from "@/lib/sign-in-href"
import { clearAllSupportDrafts } from "@/lib/support-draft"
import {
  GUEST_ADOPTION_KEY,
  GUEST_ADOPTION_MAX_AGE_MS,
  OWN_GUEST_ID_KEY,
  GUEST_ADOPTION_LOCK_TTL_MS,
  acquireGuestAdoptionLock,
  documentIsVisible,
  resetGuestAdoptionConfirmation,
  isGuestAdoptionLockHeld,
  isGuestAdoptionLockedByOther,
  releaseGuestAdoptionLock,
  clearOwnGuestId,
  clearSavedGuestSession,
  defaultStorage,
  readOwnGuestId,
  readSavedGuestSession,
  saveGuestSession,
  type SavedGuestSession,
  type StorageLike,
} from "@/lib/guest-adoption-storage"
import { cancelGuestAdoptionConfirm, requestGuestAdoptionConfirm } from "@/lib/guest-adoption-confirm"

/**
 * Guest ticket adoption.
 *
 * A visitor can open a ticket on a public support page as an anonymous
 * Supabase user. When they sign in, the real session replaces the guest one,
 * so when they click a sign-in action on a support page (or open the sign-in
 * page with a support `redirect`, i.e. they are continuing that
 * conversation) we save the guest's tokens;
 * once the real sign-in completes, the signed-in user confirms ("Link to my
 * account") a preview of the conversations and `adopt-guest-tickets` moves
 * them to the real account (it verifies the guest access token server-side).
 *
 * Hardening:
 * - only a guest this browser created itself (`githelp.ownGuestId`, set by
 *   ensureSupportSession) can be saved or adopted — a guest session planted
 *   through a crafted `#access_token=` link is refused (login CSRF);
 * - nothing is adopted without the signed-in user's confirmation (also
 *   covers the next person signing in on a shared computer);
 * - the key is only written by a sign-in from a support page (never because
 *   an unrelated page, e.g. an AuthGuard bounce, opened sign-in), expires
 *   after 60 minutes, and is cleared on sign-out and after a definitive
 *   (4xx) answer;
 * - a confirmation is bound to the previewed key and account
 *   (`expected_user_id`; the function answers 409 `account_changed` on a
 *   mismatch, which starts over and asks the current account).
 */

export {
  GUEST_ADOPTION_KEY,
  GUEST_ADOPTION_MAX_AGE_MS,
  OWN_GUEST_ID_KEY,
  clearSavedGuestSession,
  readSavedGuestSession,
  saveGuestSession,
}
export type { SavedGuestSession } from "@/lib/guest-adoption-storage"

export interface GuestTicketPreview {
  id: string
  title: string
  project_name: string | null
  status: string
  created_at: string
}

export interface AdoptedOpenTicket {
  id: string
  project_id: string | null
}

export type GuestAdoptionResult =
  | { status: "none" }
  | {
      status: "adopted"
      adoptedTicketIds: string[]
      openTicketIds: string[]
      /** The open adopted tickets with their project (for landing on one). */
      openTickets?: AdoptedOpenTicket[]
    }
  /** The signed-in user said "Not mine — discard"; the key was cleared. */
  | { status: "discarded"; ticketIds?: string[] }
  /** The dialog was dismissed: nothing adopted, the key is kept to ask again later. */
  | { status: "deferred" }
  /** Another tab ran the flow; refetch to see its outcome. */
  | { status: "elsewhere" }
  /** Still running after the caller's timeout; the key is kept for a later retry. */
  | { status: "timeout" }
  | {
      status: "failed"
      code: string | null
      message: string
      /** Network / 5xx: the key was kept so a later visit retries. */
      retryable: boolean
    }

type AdoptionClient = Pick<SupabaseClient, "auth" | "functions"> & Partial<Pick<SupabaseClient, "from">>

interface AdoptionDeps {
  client?: AdoptionClient
  storage?: StorageLike | null
  /** Refresh the guest session without touching the app's persisted session. */
  refreshGuestSession?: (refreshToken: string) => Promise<string | null>
  now?: () => number
}

/**
 * "superseded": the dialog was closed for the user (another tab took over,
 * or the session signed out) — unlike "later" it is not remembered.
 */
export type GuestAdoptionChoice = "link" | "discard" | "later" | "superseded"

interface FlowDeps extends AdoptionDeps {
  /**
   * Ask the signed-in user (named by `account`) to confirm the preview.
   * Defaults to the app dialog.
   */
  confirm?: (tickets: GuestTicketPreview[], account: string) => Promise<GuestAdoptionChoice>
  /** This tab's id for the cross-tab lock (tests). */
  tabId?: string
  /**
   * Cap on each network step (preview, adoption) and on waiting for another
   * tab's run; the user's decision is not timed.
   */
  timeoutMs?: number
  /** Whether this tab is visible (lock takeover); defaults to document.visibilityState. */
  isVisible?: () => boolean
  /** Ask even if the user chose "later" recently (the "Link conversation" button). */
  force?: boolean
}

/** After "ask me later", no automatic re-prompt for this long. */
export const GUEST_ADOPTION_LATER_MS = 10 * 60 * 1000

const storageOf = (deps: AdoptionDeps) => (deps.storage === undefined ? defaultStorage() : deps.storage)

/**
 * Called when a guest signs in from a support page (banner, top bar, sidebar,
 * chat intro) or opens the sign-in page with a support `redirect`: refresh
 * the anonymous session (fresh access token for the adoption call) and save
 * its tokens. Only for the guest this browser created itself. Returns true
 * when a guest session was saved. Never throws. Never call this because an
 * unrelated page opened sign-in (shared computers: the next person would
 * inherit the conversation).
 */
export async function prepareGuestAdoption(
  deps: AdoptionDeps = {},
  keep: Pick<SavedGuestSession, "saved_at" | "confirmed" | "ticket_ids"> | null = null,
): Promise<boolean> {
  const client = deps.client ?? supabase
  const storage = storageOf(deps)
  const now = deps.now ?? Date.now
  try {
    const {
      data: { session },
    } = await client.auth.getSession()
    if (!session?.user || !isAnonymousUser(session.user)) return false
    // A planted guest session (not created by this browser) is never saved.
    if (readOwnGuestId(storage) !== session.user.id) return false

    let current = session
    try {
      const { data, error } = await client.auth.refreshSession()
      if (!error && data.session && data.session.user?.id === session.user.id) current = data.session
    } catch {
      // Keep the current tokens; adoption retries with the refresh token.
    }

    return saveGuestSession(
      {
        access_token: current.access_token,
        refresh_token: current.refresh_token,
        user_id: current.user.id,
        // Refreshing an existing key never extends its 60-minute window.
        saved_at: keep?.saved_at ?? new Date(now()).toISOString(),
        ...(keep?.confirmed ? { confirmed: true } : {}),
        ...(keep?.ticket_ids ? { ticket_ids: keep.ticket_ids } : {}),
      },
      storage,
    )
  } catch (error) {
    console.warn("Could not save the guest session for sign-in:", error)
    return false
  }
}

/**
 * On the sign-in page's provider buttons: refresh the tokens of a key that
 * an explicit support-page click already saved for THIS guest. Never creates
 * a key and never extends its expiry.
 */
export async function refreshSavedGuestAdoption(deps: AdoptionDeps = {}): Promise<boolean> {
  const storage = storageOf(deps)
  const saved = readSavedGuestSession(storage, deps.now)
  if (!saved) return false
  const client = deps.client ?? supabase
  try {
    const {
      data: { session },
    } = await client.auth.getSession()
    if (!session?.user || !isAnonymousUser(session.user) || session.user.id !== saved.user_id) return false
  } catch {
    return false
  }
  return prepareGuestAdoption(deps, saved)
}

/** Default: a separate, non-persisting client so the real session is untouched. */
async function refreshWithIsolatedClient(refreshToken: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  const guestClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "githelp-guest-adoption",
    },
  })
  const { data, error } = await guestClient.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) return null
  return data.session.access_token
}

const asIdList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

function asPreviewList(value: unknown): GuestTicketPreview[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object" && typeof (t as { id?: unknown }).id === "string")
    .map((t) => ({
      id: t.id as string,
      title: typeof t.title === "string" ? t.title : "Support conversation",
      project_name: typeof t.project_name === "string" ? t.project_name : null,
      status: typeof t.status === "string" ? t.status : "",
      created_at: typeof t.created_at === "string" ? t.created_at : "",
    }))
}

/** 409 from the function: the signed-in account isn't the one expected. */
function isAccountChanged(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "account_changed"
}

/** Definitive answers: the saved guest session can never be adopted. */
const FINAL_ADOPTION_CODES = new Set(["invalid_guest_token", "sign_in_required"])

/**
 * Whether an adoption failure is definitive (clear the key) or transient
 * (network error, 5xx, rate limit — keep it so a later visit retries).
 */
export function isFinalAdoptionError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === "string" && FINAL_ADOPTION_CODES.has(code)) return true
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429
}

type Context = { saved: SavedGuestSession; userId: string; account: string }

/** The saved key, if it may be adopted into the current (real) session. */
async function adoptionContext(deps: AdoptionDeps): Promise<Context | null> {
  const client = deps.client ?? supabase
  const storage = storageOf(deps)
  const saved = readSavedGuestSession(storage, deps.now)
  if (!saved) return null
  // Only a guest this browser created itself (login-CSRF guard).
  if (readOwnGuestId(storage) !== saved.user_id) {
    clearSavedGuestSession(storage)
    return null
  }
  const {
    data: { session },
  } = await client.auth.getSession()
  // Still a guest (or no session yet): keep the key for the real sign-in.
  if (!session?.user || !isSignedInUser(session.user)) return null
  if (session.user.id === saved.user_id) {
    clearSavedGuestSession(storage)
    return null
  }
  const meta = (session.user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown }
  const account =
    session.user.email ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "this account"
  return { saved, userId: session.user.id, account }
}

/** Calls the function with the guest token, refreshing it once on invalid_guest_token. */
async function invokeWithGuestToken(
  deps: AdoptionDeps,
  saved: SavedGuestSession,
  extra: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = deps.client ?? supabase
  const refreshGuestSession = deps.refreshGuestSession ?? refreshWithIsolatedClient
  const invoke = async (guestAccessToken: string) => {
    const resp = await client.functions.invoke("adopt-guest-tickets", {
      body: { guest_access_token: guestAccessToken, ...extra },
    })
    if (resp.error) throw await toEdgeFunctionError(resp.error, "Could not move your guest conversation")
    return (resp.data ?? {}) as Record<string, unknown>
  }
  try {
    return await invoke(saved.access_token)
  } catch (error) {
    const code = (error as { code?: string | null } | null)?.code ?? null
    if (code !== "invalid_guest_token") throw error
    // The guest access token most likely expired while signing in.
    const fresh = await refreshGuestSession(saved.refresh_token).catch(() => null)
    if (!fresh) throw error
    return await invoke(fresh)
  }
}

function failureResult(deps: AdoptionDeps, saved: SavedGuestSession, error: unknown): GuestAdoptionResult {
  const storage = storageOf(deps)
  // Another run (other tab / page) finished or cleared the key meanwhile:
  // its outcome stands, so this run's failure is not reported.
  const current = readSavedGuestSession(storage, deps.now)
  if (!current || current.user_id !== saved.user_id || current.saved_at !== saved.saved_at) {
    return { status: "none" }
  }
  const final = isFinalAdoptionError(error)
  console.error("Guest ticket adoption failed:", error)
  if (final) clearSavedGuestSession(storage)
  return {
    status: "failed",
    code: (error as { code?: string | null } | null)?.code ?? null,
    message: error instanceof Error ? error.message : "Could not move your guest conversation",
    retryable: !final,
  }
}

export type GuestAdoptionPreview =
  | { status: "none" }
  | {
      status: "preview"
      tickets: GuestTicketPreview[]
      confirmed: boolean
      account: string
      userId: string
      /** The key that was previewed (a confirmation is bound to it). */
      key: Pick<SavedGuestSession, "user_id" | "saved_at">
    }
  /** The function saw a different signed-in account (409 account_changed): start over. */
  | { status: "restart" }
  | Extract<GuestAdoptionResult, { status: "failed" }>

/** What would be linked (no side effects). A key already confirmed skips the server call. */
export async function previewSavedGuestTickets(deps: AdoptionDeps = {}): Promise<GuestAdoptionPreview> {
  let ctx: Context | null
  try {
    ctx = await adoptionContext(deps)
  } catch {
    return { status: "none" }
  }
  if (!ctx) return { status: "none" }
  // A confirmation only counts for the account that gave it.
  const key = { user_id: ctx.saved.user_id, saved_at: ctx.saved.saved_at }
  if (ctx.saved.confirmed && ctx.saved.confirmed_by === ctx.userId) {
    return { status: "preview", tickets: [], confirmed: true, account: ctx.account, userId: ctx.userId, key }
  }
  try {
    const data = await invokeWithGuestToken(deps, ctx.saved, { preview: true, expected_user_id: ctx.userId })
    return {
      status: "preview",
      tickets: asPreviewList(data.tickets),
      confirmed: false,
      account: ctx.account,
      userId: ctx.userId,
      key,
    }
  } catch (error) {
    if (isAccountChanged(error)) return { status: "restart" }
    const result = failureResult(deps, ctx.saved, error)
    return result.status === "failed" ? result : { status: "none" }
  }
}

/** Tickets among `ids` the signed-in user already owns (adopted by an earlier run). */
async function ownedTicketIds(deps: AdoptionDeps, userId: string, ids: string[]): Promise<string[]> {
  const client = deps.client ?? supabase
  if (ids.length === 0 || !client.from) return []
  try {
    const { data, error } = await client.from("tickets").select("id").in("id", ids).eq("created_by", userId)
    if (error || !data) return []
    return (data as Array<{ id: string }>).map((t) => t.id)
  } catch {
    return []
  }
}

/** Project of each (now owned) ticket, to land on one after adoption. */
async function ticketProjects(deps: AdoptionDeps, ids: string[]): Promise<AdoptedOpenTicket[]> {
  const client = deps.client ?? supabase
  if (ids.length === 0) return []
  const fallback = ids.map((id) => ({ id, project_id: null }))
  if (!client.from) return fallback
  try {
    const { data, error } = await client.from("tickets").select("id, project_id").in("id", ids)
    if (error || !data) return fallback
    const byId = new Map((data as Array<{ id: string; project_id: string | null }>).map((t) => [t.id, t.project_id]))
    return ids.map((id) => ({ id, project_id: byId.get(id) ?? null }))
  } catch {
    return fallback
  }
}

/** Adopt a saved key the signed-in user has confirmed. Never throws. */
export async function adoptConfirmedGuestTickets(
  deps: AdoptionDeps = {},
): Promise<GuestAdoptionResult | { status: "restart" }> {
  const storage = storageOf(deps)
  let ctx: Context | null
  try {
    ctx = await adoptionContext(deps)
  } catch {
    return { status: "none" }
  }
  if (!ctx) return { status: "none" }
  const { saved, userId } = ctx
  // Only adopt for the account that confirmed.
  if (!saved.confirmed || saved.confirmed_by !== userId) return { status: "none" }
  try {
    const data = await invokeWithGuestToken(deps, saved, { expected_user_id: saved.confirmed_by })
    clearSavedGuestSession(storage)
    clearOwnGuestId(storage)
    const openTicketIds = asIdList(data.open_ticket_ids)
    return {
      status: "adopted",
      adoptedTicketIds: asIdList(data.adopted_ticket_ids),
      openTicketIds,
      openTickets: await ticketProjects(deps, openTicketIds),
    }
  } catch (error) {
    // The function saw another account than the one that confirmed: drop
    // the confirmation and ask again (the current account).
    if (isAccountChanged(error)) {
      resetGuestAdoptionConfirmation(userId === saved.confirmed_by ? "" : userId, storage)
      return { status: "restart" }
    }
    // invalid_guest_token after an earlier run already linked them: success.
    if ((error as { code?: string | null } | null)?.code === "invalid_guest_token") {
      const owned = await ownedTicketIds(deps, userId, saved.ticket_ids ?? [])
      if (owned.length > 0) {
        clearSavedGuestSession(storage)
        clearOwnGuestId(storage)
        return { status: "adopted", adoptedTicketIds: owned, openTicketIds: [] }
      }
    }
    return failureResult(deps, saved, error)
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, onTimeout: T): Promise<T> {
  if (!timeoutMs) return promise
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), timeoutMs)
    void promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    })
  })
}

/** Resolves once the tab is visible (the dialog never opens in a background tab). */
function waitUntilVisible(isVisible: () => boolean): Promise<void> {
  if (isVisible() || typeof document === "undefined") return Promise.resolve()
  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (!isVisible()) return
      document.removeEventListener("visibilitychange", onChange)
      resolve()
    }
    document.addEventListener("visibilitychange", onChange)
  })
}

async function runFlow(deps: FlowDeps, attempt = 0): Promise<GuestAdoptionResult> {
  const storage = storageOf(deps)
  const now = deps.now ?? Date.now
  const confirm = deps.confirm ?? requestGuestAdoptionConfirm
  const isVisible = deps.isVisible ?? documentIsVisible
  // A confirmation that no longer matches (key replaced, account changed):
  // start over with a new preview — at most a couple of times.
  const restart = (): Promise<GuestAdoptionResult> =>
    attempt < 2 ? runFlow(deps, attempt + 1) : Promise.resolve({ status: "none" })
  // "Ask me later" was chosen recently: don't prompt again by itself.
  const before = readSavedGuestSession(storage, deps.now)
  if (!deps.force && before?.later_at && !before.confirmed && now() - before.later_at < GUEST_ADOPTION_LATER_MS) {
    return { status: "deferred" }
  }
  const preview = await withTimeout<GuestAdoptionPreview | { status: "timeout" }>(
    previewSavedGuestTickets(deps),
    deps.timeoutMs,
    { status: "timeout" },
  )
  if (preview.status === "restart") return restart()
  if (preview.status !== "preview") return preview
  if (!preview.confirmed) {
    if (preview.tickets.length === 0) {
      // Nothing to link: drop the key silently.
      clearSavedGuestSession(storage)
      return { status: "none" }
    }
    await waitUntilVisible(isVisible)
    const choice = await confirm(preview.tickets, preview.account).catch((): GuestAdoptionChoice => "superseded")
    const saved = readSavedGuestSession(storage, deps.now)
    if (choice === "discard") {
      clearSavedGuestSession(storage)
      // Their unsent messages go with it.
      clearAllSupportDrafts()
      return { status: "discarded", ticketIds: preview.tickets.map((t) => t.id) }
    }
    // Closed for the user (another tab took over / signed out): not "later".
    if (choice === "superseded") return { status: "elsewhere" }
    if (!saved) return { status: "none" }
    // The key changed while the dialog was open: what was confirmed isn't
    // what would be adopted — preview again.
    if (saved.user_id !== preview.key.user_id || saved.saved_at !== preview.key.saved_at) return restart()
    // Dismissed by the user (Escape / outside click): keep the key, remember "later".
    if (choice !== "link") {
      saveGuestSession({ ...saved, later_at: now() }, storage)
      return { status: "deferred" }
    }
    // Remember who confirmed so retries (timeout / 5xx) by the same account
    // don't ask again.
    const confirmed: SavedGuestSession = {
      ...saved,
      confirmed: true,
      confirmed_by: preview.userId,
      ticket_ids: preview.tickets.map((t) => t.id),
    }
    delete confirmed.later_at
    saveGuestSession(confirmed, storage)
  }
  const adopted = await withTimeout<GuestAdoptionResult | { status: "restart" }>(
    adoptConfirmedGuestTickets(deps),
    deps.timeoutMs,
    { status: "timeout" },
  )
  return adopted.status === "restart" ? restart() : adopted
}

let inFlight: Promise<GuestAdoptionResult> | null = null
const thisTabId = `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`

/**
 * Polls until the other tab's lock is gone (released or expired) or this
 * tab may take it over (it became visible while the holder is hidden).
 * Gives up after `maxMs`. Returns whether the other tab finished.
 */
async function waitForOtherTab(
  tabId: string,
  storage: StorageLike | null,
  now: () => number,
  isVisible: () => boolean,
  maxMs: number,
): Promise<boolean> {
  const started = now()
  while (isGuestAdoptionLockedByOther(tabId, storage, now, isVisible())) {
    if (now() - started >= maxMs) return false
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return true
}

async function runLocked(deps: FlowDeps): Promise<GuestAdoptionResult> {
  const storage = storageOf(deps)
  const now = deps.now ?? Date.now
  const tabId = deps.tabId ?? thisTabId
  const isVisible = deps.isVisible ?? documentIsVisible
  if (!readSavedGuestSession(storage, deps.now)) return { status: "none" }
  // One tab previews / asks / adopts; the others wait (at most timeoutMs, so
  // /auth/confirmed never hangs) and then refetch. A visible tab may take
  // over from a hidden holder.
  if (!acquireGuestAdoptionLock(tabId, storage, now, isVisible())) {
    const finished = await waitForOtherTab(tabId, storage, now, isVisible, deps.timeoutMs ?? 10 * 60 * 1000)
    if (!finished) return { status: "timeout" }
    // Released or expired: the other tab's outcome stands — refetch, don't
    // prompt. Still held, but by a hidden tab while we're visible: take over.
    if (!isGuestAdoptionLockHeld(storage, now)) return { status: "elsewhere" }
    if (!acquireGuestAdoptionLock(tabId, storage, now, isVisible())) return { status: "elsewhere" }
  }
  const keepAlive = setInterval(() => {
    // Heartbeat with our visibility; taken over by a visible tab → drop our
    // (background) dialog instead of competing with it.
    if (!acquireGuestAdoptionLock(tabId, storage, now, isVisible())) cancelGuestAdoptionConfirm()
  }, GUEST_ADOPTION_LOCK_TTL_MS / 3)
  try {
    return await runFlow(deps)
  } finally {
    clearInterval(keepAlive)
    releaseGuestAdoptionLock(tabId, storage)
  }
}

/**
 * Shared post-sign-in step (/auth/confirmed, sign-in page, support pages):
 * if a guest session this browser created was saved and the current user is
 * a real account, preview its conversations, ask the user to confirm (naming
 * the account), and adopt them. Calls in this tab share one run; across tabs
 * a short localStorage lock lets one tab run it while the others wait for
 * the outcome (`elsewhere`). Never throws — sign-in must not be blocked.
 */
export function runGuestAdoptionFlow(deps: FlowDeps = {}): Promise<GuestAdoptionResult> {
  if (!inFlight) {
    inFlight = runLocked(deps)
      .catch((error): GuestAdoptionResult => {
        console.error("Guest ticket adoption failed:", error)
        return { status: "failed", code: null, message: "Could not move your guest conversation", retryable: true }
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/**
 * The landing for a post-sign-in redirect: an invite / project-join
 * destination (self-onboarding) always wins — the adoption still happened
 * (or was declined) in the background, the user keeps their invite.
 */
export function adoptionLandingForRedirect(result: GuestAdoptionResult, redirectTo: string | null | undefined): string | null {
  if (handlesOwnOnboarding(redirectTo)) return null
  return landingAfterGuestAdoption(result, redirectTo)
}

/**
 * Where to go after the flow, given the page / destination `target`
 * (path + query), or null to stay:
 * - adopted with open tickets, and `target` isn't already the chat on one of
 *   them: the open ticket on the target's project, else the first one;
 * - discarded while `target` is the chat on a discarded ticket: a fresh
 *   composer for that project.
 */
export function landingAfterGuestAdoption(result: GuestAdoptionResult, target: string | null | undefined): string | null {
  const url = new URL(target || "/", "http://local")
  const onChat = url.pathname === "/support/chat"
  const ticketParam = onChat ? url.searchParams.get("ticket") : null
  const projectParam = url.searchParams.get("project")
  if (result.status === "adopted") {
    const open = result.openTickets?.length
      ? result.openTickets
      : result.openTicketIds.map((id) => ({ id, project_id: null as string | null }))
    if (open.length === 0) return null
    if (ticketParam && open.some((t) => t.id === ticketParam)) return null
    const pick = (projectParam && open.find((t) => t.project_id === projectParam)) || open[0]
    return pick.project_id
      ? `/support/chat?ticket=${encodeURIComponent(pick.id)}&project=${encodeURIComponent(pick.project_id)}`
      : `/support/chat?ticket=${encodeURIComponent(pick.id)}`
  }
  if (result.status === "discarded" && ticketParam && result.ticketIds?.includes(ticketParam)) {
    return projectParam ? `/support/chat?project=${encodeURIComponent(projectParam)}` : "/support/chat"
  }
  return null
}

/**
 * Sign-in URL for a support visitor: lands back on `redirectTo` and skips the
 * project-creation onboarding (see /auth/confirmed `skipOnboarding`).
 */
export function supportSignInHref(redirectTo: string): string {
  return signInHref(redirectTo, { support: true })
}

/**
 * "Sign in" clicked by a guest on a support page: save the guest tokens for
 * adoption, then go to the sign-in page with a redirect back to `redirectTo`.
 */
export async function startGuestSignIn(
  redirectTo: string,
  navigate: (href: string) => void,
  deps: AdoptionDeps = {},
): Promise<void> {
  await prepareGuestAdoption(deps)
  navigate(supportSignInHref(redirectTo))
}
