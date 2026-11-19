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
 * `leave_guest_ticket` as a keepalive request, so it survives the page being
 * unloaded: with an id, the caller's own open guest ticket; without, all of
 * them. supabase-js cannot be used here (its request needs an awaited
 * `getSession`, and nothing can be awaited during `pagehide`), so this is a
 * plain fetch with the token the hook kept. Never throws.
 */
function leaveGuestTickets(accessToken: string | null, ticketId?: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey || !accessToken) return
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
 * Presence for a guest's open ticket (or, without an id, all of their open
 * guest tickets — used by the support layout on every /support page).
 *
 * Heartbeat: a cron job closes guest tickets nobody has seen for 15 minutes
 * ("the visitor left"), so while the ticket is on screen we call
 * `touch_guest_ticket`: on mount, every 30 s — also while the tab is hidden
 * (visitors switch tabs to try a fix; browsers throttle background timers to
 * about once a minute, which is enough) — and right away when the tab becomes
 * visible again or the page is restored from the back/forward cache
 * (`pageshow` with `persisted`).
 *
 * Window closed: on `pagehide` we report `leave_guest_ticket` with a keepalive
 * request, so the ticket is removed quickly instead of after the idle
 * timeout. The session's access token is kept in a ref (refreshed with every
 * heartbeat) because `getSession` cannot be awaited during `pagehide`; without
 * a token nothing is sent. `pagehide` also fires for reloads and for pages
 * going into the back/forward cache: the touch on the next mount or `pageshow`
 * clears the leave mark again. Hiding the tab (`visibilitychange`) is never a
 * leave.
 */
export function useGuestPresence(ticketId: string | null | undefined, enabled: boolean) {
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const refreshToken = () => {
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
      refreshToken()
    }
    touch()
    const interval = setInterval(touch, GUEST_PRESENCE_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") touch()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) touch()
    }
    const onPageHide = () => leaveGuestTickets(accessTokenRef.current, ticketId ?? undefined)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pageshow", onPageShow)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      cancelled = true
      accessTokenRef.current = null
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
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
