"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startGuestSignIn } from "@/lib/guest-adoption"

interface GuestBannerProps {
  /** Path (+ query) to return to after signing in — ideally the chat with `?ticket=`. */
  redirectTo: string
  /** Page-provided sign-in (e.g. also keeps the unsent message); defaults to startGuestSignIn. */
  onSignIn?: () => void
}

/**
 * Shown above the composer while the visitor chats as a guest (anonymous
 * session). Signing in saves the guest session first so the conversation is
 * moved to the real account afterwards (see lib/guest-adoption).
 */
export function GuestBanner({ redirectTo, onSignIn }: GuestBannerProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleSignIn = async () => {
    if (pending) return
    setPending(true)
    if (onSignIn) {
      onSignIn()
      return
    }
    try {
      await startGuestSignIn(redirectTo, (href) => router.push(href))
    } catch {
      setPending(false)
    }
  }

  return (
    <div
      className="mx-4 mb-2 rounded-[10px] border border-border bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      data-slot="guest-banner"
    >
      <p className="text-sm text-foreground">
        You&rsquo;re chatting as a guest. Sign in to get notified when a helper replies and to get help.
      </p>
      <Button variant="lavender" size="sm" className="cursor-pointer" onClick={() => void handleSignIn()} disabled={pending}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Sign in
      </Button>
    </div>
  )
}
