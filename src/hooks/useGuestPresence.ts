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
 * `leave_guest_ticket`: the window is closing. Marks the caller's own open
 * guest ticket (or, without an id, all of them) as left; the next
 * `touch_guest_ticket` clears the mark. Sent as a plain keepalive `fetch`
 * because `supabase.rpc` awaits the session first and is not reliable during
 * unload, so the caller passes the access token it has cached. Never throws.
 */
export function leaveGuestTickets(accessToken: string | null | undefined, ticketId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey || !accessToken) return
  try {
    void fetch(`${url}/rest/v1/rpc/leave_guest_ticket`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
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
 * right away when the tab becomes visible again or the page is shown
 * (reload, back/forward cache restore).
 *
 * Closing the window is reported on `pagehide` with `leave_guest_ticket`, so
 * the ticket is closed after a 2-minute grace instead of 15 minutes. Never on
 * `visibilitychange` (a tab switch is not leaving) and never on unmount
 * (in-app navigation does not fire `pagehide`). A page that goes into the
 * back/forward cache also leaves: its timers are frozen, and the `pageshow`
 * touch clears the mark when it is restored.
 */
export function useGuestPresence(ticketId: string | null | undefined, enabled: boolean) {
  // `pagehide` cannot await `getSession()`, so the token is kept at hand.
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    Promise.resolve(supabase.auth.getSession())
      .then((result) => {
        const token = result?.data?.session?.access_token
        if (!cancelled && token && !accessTokenRef.current) accessTokenRef.current = token
      })
      .catch(() => {})
    // Only stores the token: no Supabase calls inside the callback (auth lock).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null
    })

    return () => {
      cancelled = true
      data?.subscription?.unsubscribe()
      accessTokenRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    // No id: all of the caller's open guest tickets (a no-op without any).
    const touch = () => touchGuestTickets(ticketId ?? undefined)
    touch()
    const interval = setInterval(touch, GUEST_PRESENCE_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") touch()
    }
    const onPageHide = () => leaveGuestTickets(accessTokenRef.current, ticketId ?? undefined)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pageshow", touch)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", touch)
      window.removeEventListener("pagehide", onPageHide)
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
