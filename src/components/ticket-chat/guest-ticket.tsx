"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getPostgresHint } from "@/lib/functions-error"
import { guestLabel, type GuestIdentity } from "@/lib/guest-label"
import { cn } from "@/lib/utils"

/**
 * Helper-side UI for guest tickets (opened by a visitor without an account).
 * Helpers can read and reply, but nobody can claim, log time or bill until
 * the visitor signs in; the ticket then stops being a guest ticket (realtime
 * update after adoption) and the claim button becomes available.
 */

export const GUEST_CLAIM_BLOCKED_COPY =
  "The user needs to sign in before this ticket can be claimed. You can still reply."

/**
 * Display name for a ticket creator. Guests show their email, else
 * "Guest · " + a short code from their id, else "Guest" (see `guestLabel`).
 */
export function ticketCreatorDisplayName(
  name: string | null | undefined,
  isGuest: boolean,
  fallback = "User",
  guest?: GuestIdentity | null,
): string {
  if (isGuest) return guestLabel(guest).label
  return name?.trim() || fallback
}

interface ClaimTicketButtonProps {
  isGuest: boolean
  pending?: boolean
  onClaim: () => void
  /** Also show the explanation under the button (detail panel); the toolbar keeps the tooltip only. */
  showExplanation?: boolean
  className?: string
}

/**
 * "Claim ticket", disabled while the ticket is a guest ticket. The reason is
 * shown under the button (unless `showExplanation` is false) and as a
 * tooltip: the Button primitive sets `disabled:pointer-events-none`, so a
 * disabled button never sees hover; a focusable wrapper is the trigger instead,
 * which also lets keyboard users reach the explanation.
 */
export function ClaimTicketButton({ isGuest, pending, onClaim, showExplanation = true, className }: ClaimTicketButtonProps) {
  const label = pending ? "Claiming…" : "Claim ticket"

  if (!isGuest) {
    return (
      <Button onClick={onClaim} disabled={pending} variant="lavender" className={cn("cursor-pointer w-fit", className)}>
        {label}
      </Button>
    )
  }

  const button = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-describedby={showExplanation ? "guest-claim-explanation" : undefined}
          className={cn(
            "inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
            !showExplanation && className,
          )}
        >
          <Button disabled variant="lavender" className="w-fit">
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{GUEST_CLAIM_BLOCKED_COPY}</TooltipContent>
    </Tooltip>
  )

  if (!showExplanation) return button

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {button}
      <p id="guest-claim-explanation" data-slot="guest-claim-explanation" className="w-fit rounded-md bg-bg-subtle px-3 py-2 text-ui text-text-muted">
        {GUEST_CLAIM_BLOCKED_COPY}
      </p>
    </div>
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

/**
 * Helper-side action on the `guest_abandoned` system message: formally end the
 * ticket the guest walked away from (`end_abandoned_guest_ticket`). Shown only
 * while `isGuestAbandoned` holds, so it goes away when the guest returns.
 */
export function GuestAbandonedAction({ onEndTicket, pending }: { onEndTicket: () => void; pending?: boolean }) {
  return (
    <div className="mt-2" data-slot="guest-abandoned-action">
      <Button type="button" variant="lavender" loading={pending} className="cursor-pointer" onClick={onEndTicket}>
        End ticket
      </Button>
    </div>
  )
}

export const GUEST_BACK_IN_CHAT_COPY = "The guest is back in the chat."
export const END_ABANDONED_GENERIC_ERROR_COPY = "Couldn't end the ticket. Please try again."

/**
 * What to do when `end_abandoned_guest_ticket` fails, from its Postgres hint:
 * - `guest_ticket_not_abandoned`: the guest came back; say so and refetch;
 * - `ticket_closed`: someone already ended it; just refetch to show that;
 * - `guest_ticket_not_found` and anything else: generic error.
 */
export function endAbandonedGuestTicketErrorAction(error: unknown): { message: string | null; refetch: boolean } {
  const hint = getPostgresHint(error)
  if (hint === "guest_ticket_not_abandoned") return { message: GUEST_BACK_IN_CHAT_COPY, refetch: true }
  if (hint === "ticket_closed") return { message: null, refetch: true }
  return { message: END_ABANDONED_GENERIC_ERROR_COPY, refetch: false }
}
