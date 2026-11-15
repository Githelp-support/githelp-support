import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { isAnonymousUser } from "@/lib/supabase/auth-state"
import { isOwnGuestId } from "@/lib/guest-adoption-storage"

/** How often guest presence is reported. */
export const GUEST_PRESENCE_INTERVAL_MS = 30_000

/**
 * `touch_guest_ticket`: with an id, the caller's own open guest ticket;
 * without, all of the caller's open guest tickets. A no-op for anything
 * else. It is also how a guest re-enters a ticket they left less than 30
 * minutes ago: the server reopens it. Never throws; resolves to whether the
 * call went through.
 */
function touchGuestTickets(ticketId?: string): Promise<boolean> {
  const call = ticketId
    ? supabase.rpc("touch_guest_ticket", { p_ticket_id: ticketId })
    : supabase.rpc("touch_guest_ticket")
  return Promise.resolve(call)
    .then(({ error }: { error: { message?: string } | null }) => {
      if (error) console.warn("touch_guest_ticket failed:", error.message)
      return !error
    })
    .catch(() => false)
}

/**
 * `leave_guest_ticket`: the guest closed the window. Marks the caller's own
 * open guest ticket (or, without an id, all of them) as left, so the server
 * closes it after a short grace period instead of the 15 minute idle
 * timeout; a closed guest ticket is hidden from every Helper/Admin list (see
 * `lib/abandoned-guest-tickets`). The next `touch_guest_ticket` (a reload,
 * another tab that is still open) clears the mark, so only a visitor who is
 * really gone loses the conversation.
 *
 * Sent with `keepalive` so the request survives the page being torn down;
 * `supabase.rpc` would be aborted with it. Never throws.
 */
function leaveGuestTickets(accessToken: string | null, ticketId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!accessToken || !url || !anonKey) return
  try {
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
 * right away when the tab becomes visible again. When the window is closed
 * (`pagehide`) the tickets are reported as left (`leaveGuestTickets`).
 *
 * A guest who closed the window can come back for 30 minutes: the first touch
 * after mount reopens the ticket on the server. `onReentered` runs once that
 * touch has gone through, so the caller can refetch what it loaded in the
 * meantime (the ticket may have been read while still closed).
 */
export function useGuestPresence(ticketId: string | null | undefined, enabled: boolean, onReentered?: () => void) {
  const onReenteredRef = useRef(onReentered)
  useEffect(() => {
    onReenteredRef.current = onReentered
  }, [onReentered])

  useEffect(() => {
    if (!enabled) return

    // No id: all of the caller's open guest tickets (a no-op without any).
    // The access token is kept at hand because `pagehide` can't wait for it.
    let accessToken: string | null = null
    let active = true
    const rememberToken = () => {
      try {
        Promise.resolve(supabase.auth.getSession())
          .then((result) => {
            if (active) accessToken = result?.data?.session?.access_token ?? null
          })
          .catch(() => {})
      } catch {
        // Presence is best effort.
      }
    }
    const touch = () => {
      rememberToken()
      return touchGuestTickets(ticketId ?? undefined)
    }
    void touch().then((ok) => {
      if (ok && active) onReenteredRef.current?.()
    })
    const interval = setInterval(() => void touch(), GUEST_PRESENCE_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void touch()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    // Window or tab closed (also a reload or leaving the site: the next
    // touch, if there is one, takes the mark back).
    const onPageHide = () => leaveGuestTickets(accessToken, ticketId ?? undefined)
    // Restored from the back/forward cache: still here after all.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void touch()
    }
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)

    return () => {
      active = false
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
        if (!cancelled && isAnonymousUser(session?.user) && isOwnGuestId(session?.user?.id)) void touchGuestTickets()
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
