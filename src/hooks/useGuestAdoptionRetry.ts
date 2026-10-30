import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { readSavedGuestSession } from "@/lib/guest-adoption-storage"

/** How often a pending (confirmed) adoption is retried on the support pages. */
export const GUEST_ADOPTION_RETRY_MS = 10_000

export interface GuestAdoptionRetryState {
  /** An adoption key is still pending: the conversation is being / can be linked. */
  linking: boolean
  /** The user chose "ask me later"; nothing is retried until they click "Link conversation". */
  deferred: boolean
  /** The last attempt was a definitive refusal (4xx): nothing more will happen. */
  failedFinal: boolean
  /** "Link conversation": run the flow now, asking even after "later". */
  linkNow: () => void
}

const isVisible = () => typeof document === "undefined" || document.visibilityState === "visible"

/**
 * On the support pages, for a signed-in (real) user: finish a guest adoption
 * that didn't complete at sign-in (timeout / network / 5xx keep the saved key
 * for up to 60 minutes). Runs the shared flow (preview + confirmation, unless
 * already confirmed) while the tab is visible — a hidden tab never prompts;
 * it starts when the tab becomes visible — and every ~10 s while the key
 * exists, then refetches. After "ask me later" it stops until `linkNow()`.
 * No-op without a saved key.
 */
export function useGuestAdoptionRetry(
  enabled: boolean,
  /** Navigate after linking (to the open conversation) or discarding (to a fresh composer). */
  navigate?: (path: string) => void,
): GuestAdoptionRetryState {
  const queryClient = useQueryClient()
  const [linking, setLinking] = useState(() => enabled && readSavedGuestSession() != null)
  const [deferred, setDeferred] = useState(false)
  const [failedFinal, setFailedFinal] = useState(false)
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])
  const attemptRef = useRef<((force: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let stopped = false

    const attempt = async (force: boolean) => {
      if (cancelled || running) return
      if (!readSavedGuestSession()) {
        setLinking(false)
        return
      }
      setLinking(true)
      // Never prompt from a background tab: wait for visibilitychange.
      if (!isVisible()) return
      running = true
      try {
        const [{ runGuestAdoptionFlow, landingAfterGuestAdoption }, { notifyGuestAdoptionResult }] = await Promise.all([
          import("@/lib/guest-adoption"),
          import("@/lib/guest-adoption-toast"),
        ])
        const result = await runGuestAdoptionFlow({ timeoutMs: GUEST_ADOPTION_RETRY_MS, force })
        if (cancelled) return
        if (result.status === "adopted" || result.status === "elsewhere") {
          if (result.status === "adopted") notifyGuestAdoptionResult(result)
          void queryClient.invalidateQueries()
        }
        if (result.status === "failed" && !result.retryable) setFailedFinal(true)
        const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : null
        const landing = landingAfterGuestAdoption(result, here)
        if (landing && navigateRef.current) navigateRef.current(landing)
        const pending = readSavedGuestSession() != null
        setLinking(pending)
        // "Ask me later": stop until the user clicks "Link conversation".
        stopped = result.status === "deferred"
        setDeferred(stopped && pending)
        if (pending && !stopped) timer = setTimeout(() => void attempt(false), GUEST_ADOPTION_RETRY_MS)
        // Done (expired / refused / discarded): show whatever is visible now.
        else if (!pending && result.status !== "adopted") {
          void queryClient.invalidateQueries({ queryKey: ["ticket-with-details"] })
        }
      } finally {
        running = false
      }
    }
    attemptRef.current = (force) => {
      stopped = false
      if (timer) clearTimeout(timer)
      return attempt(force)
    }

    const onVisibilityChange = () => {
      if (isVisible() && !stopped) void attempt(false)
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    void attempt(false)

    return () => {
      cancelled = true
      attemptRef.current = null
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [enabled, queryClient])

  const linkNow = useCallback(() => {
    setDeferred(false)
    void attemptRef.current?.(true)
  }, [])

  return { linking: enabled && linking, deferred: enabled && deferred, failedFinal, linkNow }
}
