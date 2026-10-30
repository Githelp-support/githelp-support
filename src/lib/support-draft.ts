/**
 * The visitor's unsent question, kept across the sign-in round-trip (also
 * when the magic link opens in a new tab): per project, in localStorage, for
 * 60 minutes. It is restored once into the chat composer and then removed,
 * so it never pre-fills a later new-ticket composer.
 */
const DRAFT_PREFIX = "githelp.supportDraft:"
export const SUPPORT_DRAFT_MAX_AGE_MS = 60 * 60 * 1000

const draftKey = (projectId: string) => `${DRAFT_PREFIX}${projectId}`

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export function saveSupportDraft(
  projectId: string | null | undefined,
  text: string,
  store: StorageLike | null = storage(),
  now: () => number = Date.now,
): void {
  if (!store || !projectId || !text.trim()) return
  try {
    store.setItem(draftKey(projectId), JSON.stringify({ text, saved_at: now() }))
  } catch {
    // Storage unavailable: the draft is simply lost.
  }
}

export function clearSupportDraft(projectId: string | null | undefined, store: StorageLike | null = storage()): void {
  if (!store || !projectId) return
  try {
    store.removeItem(draftKey(projectId))
  } catch {
    // ignore
  }
}

/** Sign-out: remove every project's draft (githelp.supportDraft:*). */
export function clearAllSupportDrafts(store: StorageLike | null = storage()): void {
  if (!store) return
  try {
    const keys: string[] = []
    const enumerable = store as Partial<Pick<Storage, "length" | "key">>
    if (typeof enumerable.length === "number" && typeof enumerable.key === "function") {
      for (let i = 0; i < enumerable.length; i++) {
        const k = enumerable.key(i)
        if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k)
      }
    }
    for (const k of keys) store.removeItem(k)
  } catch {
    // ignore
  }
}

/** Read and remove the draft (null when none or older than 60 minutes). */
export function takeSupportDraft(
  projectId: string | null | undefined,
  store: StorageLike | null = storage(),
  now: () => number = Date.now,
): string | null {
  if (!store || !projectId) return null
  let raw: string | null = null
  try {
    raw = store.getItem(draftKey(projectId))
  } catch {
    return null
  }
  if (!raw) return null
  clearSupportDraft(projectId, store)
  try {
    const parsed = JSON.parse(raw) as { text?: unknown; saved_at?: unknown }
    if (typeof parsed.text !== "string" || typeof parsed.saved_at !== "number") return null
    if (now() - parsed.saved_at > SUPPORT_DRAFT_MAX_AGE_MS) return null
    return parsed.text
  } catch {
    return null
  }
}

/**
 * The support page currently on screen registers its composer here, so the
 * top-bar and sidebar "Sign in" can keep the unsent message too.
 */
type DraftSource = () => { projectId: string | null | undefined; text: string }
let source: DraftSource | null = null

export function registerSupportDraftSource(next: DraftSource | null): void {
  source = next
}

export function saveRegisteredSupportDraft(): void {
  if (!source) return
  const { projectId, text } = source()
  saveSupportDraft(projectId, text)
}
