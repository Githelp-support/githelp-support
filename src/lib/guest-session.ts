import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { defaultStorage, readOwnGuestId, saveOwnGuestId, type StorageLike } from "@/lib/guest-adoption-storage"

export type SupportSessionResult =
  | { ok: true; userId: string; isGuest: boolean }
  | { ok: false; message: string }

/**
 * The session used to open a ticket on a public support page: the existing
 * one (signed-in, or a guest this browser created), else a new anonymous
 * guest session. Visitors can ask a question without an account and sign in
 * later. A guest session this browser did not create (planted via a crafted
 * `#access_token=` link) is dropped and replaced by a fresh one of our own.
 */
export async function ensureSupportSession(
  client: Pick<SupabaseClient, "auth"> = supabase,
  storage: StorageLike | null = defaultStorage(),
): Promise<SupportSessionResult> {
  try {
    const {
      data: { session },
    } = await client.auth.getSession()
    if (session?.user?.id) {
      const isGuest = session.user.is_anonymous === true
      if (!isGuest || readOwnGuestId(storage) === session.user.id) {
        return { ok: true, userId: session.user.id, isGuest }
      }
      await client.auth.signOut({ scope: "local" }).catch(() => undefined)
    }
    const { data, error } = await client.auth.signInAnonymously()
    if (error || !data.user?.id) {
      return { ok: false, message: error?.message ?? "Couldn't start a guest session." }
    }
    saveOwnGuestId(data.user.id, storage)
    return { ok: true, userId: data.user.id, isGuest: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Couldn't start a guest session." }
  }
}

export interface GuestOpenTicket {
  id: string
  project_id: string
}

/**
 * The caller's newest open ticket they created on this project (for a guest:
 * their open guest ticket — a guest has at most one). Used to resume the
 * conversation after a reload / sign-in and when ticket creation hits
 * `guest_open_ticket_exists`. Never throws; null when there is none or the
 * lookup fails.
 */
export async function findOpenTicket(
  userId: string,
  /** null: any project (e.g. a guest landing on /onboarding). */
  projectId: string | null,
  opts: { guestOnly?: boolean } = {},
  client: Pick<SupabaseClient, "from"> = supabase,
): Promise<GuestOpenTicket | null> {
  if (!userId || projectId === "") return null
  try {
    let query = client.from("tickets").select("id, project_id").eq("created_by", userId)
    if (projectId) query = query.eq("project_id", projectId)
    if (opts.guestOnly) query = query.eq("guest", true)
    const { data, error } = await query
      .is("deleted_at", null)
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
    if (error || !data || data.length === 0) return null
    const row = data[0] as { id?: unknown; project_id?: unknown }
    return typeof row.id === "string" ? { id: row.id, project_id: String(row.project_id ?? projectId ?? "") } : null
  } catch {
    return null
  }
}

/** A guest's open guest ticket on this project (see findOpenTicket). */
export function findGuestOpenTicket(
  guestId: string,
  projectId: string | null,
  client: Pick<SupabaseClient, "from"> = supabase,
): Promise<GuestOpenTicket | null> {
  return findOpenTicket(guestId, projectId, { guestOnly: true }, client)
}

/**
 * The current session is this browser's own guest — read from the session
 * directly, so a sign-in click in the first moments (before the user
 * context has caught up) still saves the guest for adoption.
 */
export async function isOwnGuestSession(
  client: Pick<SupabaseClient, "auth"> = supabase,
  storage: StorageLike | null = defaultStorage(),
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await client.auth.getSession()
    return !!session?.user && session.user.is_anonymous === true && readOwnGuestId(storage) === session.user.id
  } catch {
    return false
  }
}
