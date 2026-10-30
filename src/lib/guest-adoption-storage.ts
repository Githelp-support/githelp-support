import { clearAllSupportDrafts } from "@/lib/support-draft"
/**
 * Storage for the guest session saved before a guest signs in (see
 * lib/guest-adoption). Kept free of the Supabase client so sign-out and
 * other light modules can clear it.
 */

export const GUEST_ADOPTION_KEY = "githelp.guestAdoption"

/** A saved guest session older than this is ignored and deleted. */
export const GUEST_ADOPTION_MAX_AGE_MS = 60 * 60 * 1000

export interface SavedGuestSession {
  access_token: string
  refresh_token: string
  user_id: string
  saved_at: string
  /** The signed-in user confirmed "Link to my account" (retries skip the dialog). */
  confirmed?: boolean
  /** Who confirmed: a retry only skips the dialog for that same account. */
  confirmed_by?: string
  /** "Ask me later" (dialog dismissed) at this time: no automatic re-prompt for a while. */
  later_at?: number
  /** The previewed ticket ids the user confirmed (to recognise an earlier success). */
  ticket_ids?: string[]
}

/**
 * The guest id this browser created itself via signInAnonymously(). A guest
 * session planted through a crafted link (implicit-flow `#access_token=`)
 * never gets this mark, so it can never be saved for or adopted into the
 * victim's account.
 */
export const OWN_GUEST_ID_KEY = "githelp.ownGuestId"

export function readOwnGuestId(storage: StorageLike | null = defaultStorage()): string | null {
  if (!storage) return null
  try {
    return storage.getItem(OWN_GUEST_ID_KEY)
  } catch {
    return null
  }
}

/** Fired on window when this browser's own guest id changes (user-context re-syncs). */
export const OWN_GUEST_CHANGED_EVENT = "githelp:own-guest-changed"

export function saveOwnGuestId(guestId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(OWN_GUEST_ID_KEY, guestId)
  } catch {
    // Storage unavailable: the guest can chat but not link the conversation.
  }
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(OWN_GUEST_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

/** The anonymous session is this browser's own guest (not a planted/foreign one). */
export function isOwnGuestId(guestId: string | null | undefined, storage: StorageLike | null = defaultStorage()): boolean {
  return !!guestId && readOwnGuestId(storage) === guestId
}

/**
 * A different account signed in: a confirmation given by another account
 * no longer counts (the dialog asks again, naming the new account).
 */
export function resetGuestAdoptionConfirmation(currentUserId: string, storage: StorageLike | null = defaultStorage()): void {
  const saved = readSavedGuestSession(storage)
  if (!saved?.confirmed || saved.confirmed_by === currentUserId) return
  const rest: SavedGuestSession = { ...saved }
  delete rest.confirmed
  delete rest.confirmed_by
  saveGuestSession(rest, storage)
}

export function clearOwnGuestId(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(OWN_GUEST_ID_KEY)
  } catch {
    // ignore
  }
}

/** Sign-out: forget the saved guest session, this browser's guest id and unsent drafts. */
export function clearAllGuestAdoptionState(storage: StorageLike | null = defaultStorage()): void {
  clearSavedGuestSession(storage)
  clearOwnGuestId(storage)
  clearGuestAdoptionExpired(storage)
  // Unsent support messages belong to this browser session's visitor too.
  clearAllSupportDrafts(storage)
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

/** Fired on window when the saved guest session changes in this tab (banner re-reads). */
export const GUEST_ADOPTION_CHANGED_EVENT = "githelp:guest-adoption-changed"

function notifyChanged(): void {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_ADOPTION_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

/**
 * Set when a saved guest session expired unlinked (60 minutes), so the chat
 * can say "wasn't linked in time" instead of "may have been removed".
 */
export const GUEST_ADOPTION_EXPIRED_KEY = "githelp.guestAdoptionExpiredAt"
const EXPIRED_NOTICE_MS = 24 * 60 * 60 * 1000

export function wasGuestAdoptionExpired(
  storage: StorageLike | null = defaultStorage(),
  now: () => number = Date.now,
): boolean {
  if (!storage) return false
  try {
    const at = Number(storage.getItem(GUEST_ADOPTION_EXPIRED_KEY))
    return Number.isFinite(at) && at > 0 && now() - at < EXPIRED_NOTICE_MS
  } catch {
    return false
  }
}

export function clearGuestAdoptionExpired(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(GUEST_ADOPTION_EXPIRED_KEY)
  } catch {
    // ignore
  }
}

export function clearSavedGuestSession(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(GUEST_ADOPTION_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
  notifyChanged()
}

/**
 * The saved guest session, or null when there is none, it is malformed, or
 * it is older than 60 minutes (expired / malformed entries are deleted).
 */
export function readSavedGuestSession(
  storage: StorageLike | null = defaultStorage(),
  now: () => number = Date.now,
): SavedGuestSession | null {
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(GUEST_ADOPTION_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SavedGuestSession> | null
    const savedAt = typeof parsed?.saved_at === "string" ? Date.parse(parsed.saved_at) : NaN
    if (
      !parsed ||
      typeof parsed.access_token !== "string" ||
      typeof parsed.refresh_token !== "string" ||
      typeof parsed.user_id !== "string" ||
      Number.isNaN(savedAt) ||
      now() - savedAt > GUEST_ADOPTION_MAX_AGE_MS ||
      savedAt - now() > 5 * 60 * 1000
    ) {
      // A well-formed key that simply ran out of time: remember it expired.
      if (!Number.isNaN(savedAt) && now() - savedAt > GUEST_ADOPTION_MAX_AGE_MS) {
        try {
          storage.setItem(GUEST_ADOPTION_EXPIRED_KEY, String(now()))
        } catch {
          // ignore
        }
      }
      clearSavedGuestSession(storage)
      return null
    }
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      user_id: parsed.user_id,
      saved_at: parsed.saved_at as string,
      ...(parsed.confirmed === true ? { confirmed: true } : {}),
      ...(typeof parsed.confirmed_by === "string" ? { confirmed_by: parsed.confirmed_by } : {}),
      ...(typeof parsed.later_at === "number" ? { later_at: parsed.later_at } : {}),
      ...(Array.isArray(parsed.ticket_ids)
        ? { ticket_ids: parsed.ticket_ids.filter((id): id is string => typeof id === "string") }
        : {}),
    }
  } catch {
    clearSavedGuestSession(storage)
    return null
  }
}

export function saveGuestSession(session: SavedGuestSession, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(GUEST_ADOPTION_KEY, JSON.stringify(session))
  } catch {
    return false
  }
  clearGuestAdoptionExpired(storage)
  notifyChanged()
  return true
}

/**
 * Cross-tab lock for the adoption flow, so only one tab previews / asks /
 * adopts. Short TTL, refreshed (heartbeat) while the flow runs; a crashed
 * tab's lock simply expires. The lock records whether its holder is visible:
 * a visible tab may take over a lock held by a hidden one, so the dialog is
 * never stuck in a background tab.
 */
export const GUEST_ADOPTION_LOCK_KEY = "githelp.guestAdoptionLock"
export const GUEST_ADOPTION_LOCK_TTL_MS = 30_000

interface LockValue {
  owner: string
  expires_at: number
  visible: boolean
}

function readLock(storage: StorageLike | null): LockValue | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(GUEST_ADOPTION_LOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LockValue>
    if (typeof parsed.owner !== "string" || typeof parsed.expires_at !== "number") return null
    return { owner: parsed.owner, expires_at: parsed.expires_at, visible: parsed.visible !== false }
  } catch {
    return null
  }
}

export function documentIsVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

/**
 * Another tab holds the lock and this tab may not take it over: a live lock
 * of another owner, unless its holder is hidden and this tab is visible.
 */
export function isGuestAdoptionLockedByOther(
  owner: string,
  storage: StorageLike | null = defaultStorage(),
  now: () => number = Date.now,
  visible: boolean = documentIsVisible(),
): boolean {
  const lock = readLock(storage)
  if (!lock || lock.owner === owner || lock.expires_at <= now()) return false
  return !(visible && !lock.visible)
}

/** Some tab holds a live (unexpired) lock. */
export function isGuestAdoptionLockHeld(storage: StorageLike | null = defaultStorage(), now: () => number = Date.now): boolean {
  const lock = readLock(storage)
  return !!lock && lock.expires_at > now()
}

/** This tab still holds the lock (not taken over by another tab). */
export function holdsGuestAdoptionLock(owner: string, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return true
  return readLock(storage)?.owner === owner
}

/** Take (or refresh) the lock for `owner`; false when another tab holds it. */
export function acquireGuestAdoptionLock(
  owner: string,
  storage: StorageLike | null = defaultStorage(),
  now: () => number = Date.now,
  visible: boolean = documentIsVisible(),
): boolean {
  if (!storage) return true
  if (isGuestAdoptionLockedByOther(owner, storage, now, visible)) return false
  try {
    storage.setItem(
      GUEST_ADOPTION_LOCK_KEY,
      JSON.stringify({ owner, expires_at: now() + GUEST_ADOPTION_LOCK_TTL_MS, visible }),
    )
  } catch {
    return true
  }
  // Read back: if two tabs raced, the last writer wins and the other backs off.
  return readLock(storage)?.owner === owner
}

export function releaseGuestAdoptionLock(owner: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  if (readLock(storage)?.owner !== owner) return
  try {
    storage.removeItem(GUEST_ADOPTION_LOCK_KEY)
  } catch {
    // ignore
  }
}
