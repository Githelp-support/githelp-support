"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUser } from "@/contexts/user-context"
import {
  GUEST_ADOPTION_CHANGED_EVENT,
  GUEST_ADOPTION_KEY,
  GUEST_ADOPTION_MAX_AGE_MS,
  readOwnGuestId,
} from "@/lib/guest-adoption-storage"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(GUEST_ADOPTION_CHANGED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(GUEST_ADOPTION_CHANGED_EVENT, onChange)
  }
}

function snapshot(): string | null {
  try {
    return window.localStorage.getItem(GUEST_ADOPTION_KEY)
  } catch {
    return null
  }
}

/**
 * Whether the raw saved key is a pending, unconfirmed guest conversation of
 * this browser's own guest that `userId` could link. Pure (no storage
 * writes) so it is safe during render.
 */
export function hasLinkableGuestConversation(raw: string | null, userId: string | undefined, ownGuestId: string | null, now: number): boolean {
  if (!raw || !userId || !ownGuestId) return false
  try {
    const key = JSON.parse(raw) as { user_id?: unknown; saved_at?: unknown; confirmed?: unknown; confirmed_by?: unknown }
    const savedAt = typeof key.saved_at === "string" ? Date.parse(key.saved_at) : NaN
    if (key.user_id !== ownGuestId || Number.isNaN(savedAt) || now - savedAt > GUEST_ADOPTION_MAX_AGE_MS) return false
    return !(key.confirmed === true && key.confirmed_by === userId)
  } catch {
    return false
  }
}

/**
 * Mounted by the support layout: while a signed-in user has a pending,
 * unconfirmed guest conversation from this browser (e.g. after "ask me
 * later"), offer to link it from any /support page. Dismissible.
 */
export function GuestLinkBanner() {
  const { user } = useUser()
  const router = useRouter()
  const queryClient = useQueryClient()
  const raw = useSyncExternalStore(subscribe, snapshot, () => null)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Expiry is checked against the mount time (render must stay pure).
  const [mountedAt] = useState(() => Date.now())

  const linkable =
    typeof window !== "undefined" && hasLinkableGuestConversation(raw, user.id, readOwnGuestId(), mountedAt)
  if (!linkable || dismissedFor === raw) return null

  const handleLink = async () => {
    setPending(true)
    try {
      const [{ runGuestAdoptionFlow, landingAfterGuestAdoption }, { notifyGuestAdoptionResult }] = await Promise.all([
        import("@/lib/guest-adoption"),
        import("@/lib/guest-adoption-toast"),
      ])
      const result = await runGuestAdoptionFlow({ force: true, timeoutMs: 10_000 })
      notifyGuestAdoptionResult(result)
      if (result.status === "adopted" || result.status === "elsewhere") void queryClient.invalidateQueries()
      const landing = landingAfterGuestAdoption(result, window.location.pathname + window.location.search)
      if (landing) router.replace(landing)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="mx-4 mt-3 rounded-[10px] border border-border bg-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
      data-slot="guest-link-banner"
      role="status"
    >
      <p className="text-sm text-foreground">You have a guest conversation from this browser.</p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="lavender" className="cursor-pointer" disabled={pending} onClick={() => void handleLink()}>
          Link it to your account
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer"
          onClick={() => setDismissedFor(raw)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
