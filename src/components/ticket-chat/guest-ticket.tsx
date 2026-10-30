"use client"

import { UserX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Helper-side UI for guest tickets (opened by a visitor without an account).
 * Helpers can read and reply, but nobody can claim, log time or bill until
 * the visitor signs in; the ticket then stops being a guest ticket (realtime
 * update after adoption) and the claim button becomes available.
 */

export const GUEST_CLAIM_BLOCKED_COPY =
  "The visitor needs to sign in before this ticket can be claimed. You can still reply."

/** Display name for a ticket creator: guests show as "Guest". */
export function ticketCreatorDisplayName(name: string | null | undefined, isGuest: boolean, fallback = "User"): string {
  if (isGuest) return "Guest"
  return name?.trim() || fallback
}

export function GuestTicketBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      data-slot="guest-ticket-badge"
      className={cn(
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
      title="Opened by a visitor who hasn't signed in yet"
    >
      <UserX aria-hidden />
      Guest — not signed in
    </Badge>
  )
}

interface ClaimTicketButtonProps {
  isGuest: boolean
  pending?: boolean
  onClaim: () => void
  /** Show the explanation under the button (detail panel) or only as a tooltip (toolbar). */
  showExplanation?: boolean
  className?: string
}

/** "Claim ticket", disabled with an explanation while the ticket is a guest ticket. */
export function ClaimTicketButton({ isGuest, pending, onClaim, showExplanation = true, className }: ClaimTicketButtonProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        onClick={onClaim}
        disabled={pending || isGuest}
        variant="lavender"
        className="cursor-pointer w-fit"
        title={isGuest ? GUEST_CLAIM_BLOCKED_COPY : undefined}
        aria-describedby={isGuest && showExplanation ? "guest-claim-explanation" : undefined}
      >
        {pending ? "Claiming…" : "Claim ticket"}
      </Button>
      {isGuest && showExplanation && (
        <p id="guest-claim-explanation" className="text-[13px] text-muted-foreground">
          {GUEST_CLAIM_BLOCKED_COPY}
        </p>
      )}
    </div>
  )
}

/** Customer-side action on a `visitor_left` system message. */
export function VisitorLeftAction({ onStartNewConversation }: { onStartNewConversation: () => void }) {
  return (
    <div className="mt-2">
      <Button type="button" size="sm" variant="lavender" className="cursor-pointer" onClick={onStartNewConversation}>
        Start a new conversation
      </Button>
    </div>
  )
}
