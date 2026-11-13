"use client"

import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
      <Icon name="fi-rr-user-xmark" />
      Guest — not signed in
    </Badge>
  )
}

interface ClaimTicketButtonProps {
  isGuest: boolean
  pending?: boolean
  onClaim: () => void
  className?: string
}

/**
 * "Claim ticket", disabled while the ticket is a guest ticket. The reason is a
 * tooltip: the Button primitive sets `disabled:pointer-events-none`, so a
 * disabled button never sees hover; a focusable wrapper is the trigger instead,
 * which also lets keyboard users reach the explanation.
 */
export function ClaimTicketButton({ isGuest, pending, onClaim, className }: ClaimTicketButtonProps) {
  const label = pending ? "Claiming…" : "Claim ticket"

  if (!isGuest) {
    return (
      <Button onClick={onClaim} disabled={pending} variant="lavender" className={cn("cursor-pointer w-fit", className)}>
        {label}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40", className)}>
          <Button disabled variant="lavender" className="w-fit">
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{GUEST_CLAIM_BLOCKED_COPY}</TooltipContent>
    </Tooltip>
  )
}

/** Customer-side action on a `visitor_left` system message. */
export function VisitorLeftAction({ onStartNewConversation }: { onStartNewConversation: () => void }) {
  return (
    <div className="mt-2">
      <Button type="button" variant="lavender" className="cursor-pointer" onClick={onStartNewConversation}>
        Start a new conversation
      </Button>
    </div>
  )
}
