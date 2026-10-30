import { useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { isAnonymousUser } from "@/lib/supabase/auth-state"
import { isOwnGuestId } from "@/lib/guest-adoption-storage"

/** How often guest presence is reported. */
export const GUEST_PRESENCE_INTERVAL_MS = 30_000

/**
 * `touch_guest_ticket`: with an id, the caller's own open guest ticket;
 * without, all of the caller's open guest tickets. A no-op for anything
 * else. Never throws.
 */
function touchGuestTickets(ticketId?: string) {
  const call = ticketId
    ? supabase.rpc("touch_guest_ticket", { p_ticket_id: ticketId })
    : supabase.rpc("touch_guest_ticket")
  Promise.resolve(call)
    .then(({ error }: { error: { message?: string } | null }) => {
      if (error) console.warn("touch_guest_ticket failed:", error.message)
    })
    .catch(() => {})
}

/**
 * Presence heartbeat for a guest's open ticket (or, without an id, all of
 * their open guest tickets — used by the support layout on every /support
 * page). A cron job closes guest
 * tickets nobody has seen for 15 minutes ("the visitor left"), so while the
 * ticket is on screen we call `touch_guest_ticket`: on mount, every 30 s —
 * also while the tab is hidden (visitors switch tabs to try a fix; browsers
 * throttle background timers to about once a minute, which is enough) — and
 * right away when the tab becomes visible again.
 */
export function useGuestPresence(ticketId: string | null | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    // No id: all of the caller's open guest tickets (a no-op without any).
    const touch = () => touchGuestTickets(ticketId ?? undefined)
    touch()
    const interval = setInterval(touch, GUEST_PRESENCE_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") touch()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [ticketId, enabled])
}

/**
 * On /auth/signin and /auth/confirmed: while the session is still a guest,
 * keep all of their open guest tickets alive (no id) so a ticket isn't
 * closed as "visitor left" while they sign in. Stops by itself once the
 * session is a real account.
 */
export function useGuestSignInPresence() {
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        // Only this browser's own guest (never a foreign anonymous session).
        if (!cancelled && isAnonymousUser(session?.user) && isOwnGuestId(session?.user?.id)) touchGuestTickets()
      } catch {
        // Presence is best effort.
      }
    }
    void tick()
    const interval = setInterval(() => void tick(), GUEST_PRESENCE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
}
