import { useEffect, useRef } from "react"
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
  void touchGuestTicketsNow(ticketId)
}

/**
 * Awaitable `touch_guest_ticket`, for a guest coming back: besides the
 * heartbeat, the call reopens a ticket that was closed because they left
 * (for 30 minutes), so wait for it before looking the ticket up. Resolves
 * true when the call went through. Never throws.
 */
export async function touchGuestTicketsNow(ticketId?: string): Promise<boolean> {
  try {
    const { error } = (await (ticketId
      ? supabase.rpc("touch_guest_ticket", { p_ticket_id: ticketId })
      : supabase.rpc("touch_guest_ticket"))) as { error: { message?: string } | null }
    if (error) console.warn("touch_guest_ticket failed:", error.message)
    return !error
  } catch {
    return false
  }
}

/**
 * `leave_guest_ticket`: "the guest closed the window". Same optional id as
 * `touch_guest_ticket`. Sent from `pagehide`, so it has to outlive the page:
 * a `keepalive` fetch straight to PostgREST with a token read beforehand
 * (nothing can be awaited during unload). The next touch clears the mark.
 * Never throws.
 */
function leaveGuestTickets(accessToken: string | null, ticketId?: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!accessToken || !url || !anonKey) return
    void fetch(`${url}/rest/v1/rpc/leave_guest_ticket`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ticketId ? { p_ticket_id: ticketId } : {}),
    }).catch(() => {})
  } catch {
    // Presence is best effort.
  }
}

/**
 * Presence heartbeat for a guest's open ticket (or, without an id, all of
 * their open guest tickets — used by the support layout on every /support
 * page). A cron job closes guest
 * tickets nobody has seen for 15 minutes ("the visitor left"), so while the
 * ticket is on screen we call `touch_guest_ticket`: on mount, every 30 s —
 * also while the tab is hidden (visitors switch tabs to try a fix; browsers
 * throttle background timers to about once a minute, which is enough) — and
 * right away when the tab becomes visible again or the page is restored from
 * the back/forward cache.
 *
 * On `pagehide` (window closed, reload, navigation away — not a tab switch)
 * it calls `leave_guest_ticket`, so the ticket is closed after a short grace
 * period instead of 15 minutes; any later touch clears that mark.
 */
export function useGuestPresence(ticketId: string | null | undefined, enabled: boolean) {
  // pagehide cannot await getSession, so the token is kept at hand.
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const rememberToken = () => {
      try {
        Promise.resolve(supabase.auth.getSession())
          .then((result) => {
            if (!cancelled) accessTokenRef.current = result?.data?.session?.access_token ?? null
          })
          .catch(() => {})
      } catch {
        // Presence is best effort.
      }
    }

    // No id: all of the caller's open guest tickets (a no-op without any).
    const touch = () => {
      touchGuestTickets(ticketId ?? undefined)
      // Each heartbeat also picks up a refreshed token.
      rememberToken()
    }
    touch()
    const interval = setInterval(touch, GUEST_PRESENCE_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") touch()
    }
    const onPageHide = () => leaveGuestTickets(accessTokenRef.current, ticketId ?? undefined)
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) touch()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)

    return () => {
      cancelled = true
      accessTokenRef.current = null
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [ticketId, enabled])
}

/**
 * On /auth/signin and /auth/confirmed: while the session is still a guest,
 * keep all of their open guest tickets alive (no id) so a ticket isn't
 * closed as "visitor left" while they sign in. Stops by itself once the
 * session is a real account. While it is a guest, closing the window reports
 * `leave_guest_ticket` like `useGuestPresence` does.
 */
export function useGuestSignInPresence() {
  // Set only while the session is this browser's own guest.
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return
        // Only this browser's own guest (never a foreign anonymous session).
        const isOwnGuest = isAnonymousUser(session?.user) && isOwnGuestId(session?.user?.id)
        accessTokenRef.current = isOwnGuest ? (session?.access_token ?? null) : null
        if (isOwnGuest) touchGuestTickets()
      } catch {
        // Presence is best effort.
      }
    }
    void tick()
    const interval = setInterval(() => void tick(), GUEST_PRESENCE_INTERVAL_MS)
    const onPageHide = () => leaveGuestTickets(accessTokenRef.current)
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void tick()
    }
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      cancelled = true
      accessTokenRef.current = null
      clearInterval(interval)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])
}
