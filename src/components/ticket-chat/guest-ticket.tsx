"use client"

import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getPostgresHint } from "@/lib/functions-error"
import { cn } from "@/lib/utils"

/**
 * Helper-side UI for guest tickets (opened by a visitor without an account).
 * Helpers can read and reply, but nobody can claim, log time or bill until
 * the visitor signs in; the ticket then stops being a guest ticket (realtime
 * update after adoption) and the claim button becomes available.
 */

export const GUEST_CLAIM_BLOCKED_COPY =
  "The user needs to sign in before this ticket can be claimed. You can still reply."

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

export const GUEST_ABANDONED_END_COPY =
  "The guest has left. End the ticket to keep a record of the support given."

/** `end_abandoned_guest_ticket` error hints, mapped to helper-facing copy. */
export const END_ABANDONED_GUEST_TICKET_HINT_MESSAGES: Record<string, string> = {
  guest_ticket_not_abandoned: "The guest is back in the chat.",
  ticket_closed: "This ticket is already closed.",
  guest_ticket_not_found: "Ticket not found.",
}

/** Helper-facing copy for a failed `end_abandoned_guest_ticket` call, or null for an unknown error. */
export function endAbandonedGuestTicketErrorMessage(error: unknown): string | null {
  const hint = getPostgresHint(error)
  return hint && Object.hasOwn(END_ABANDONED_GUEST_TICKET_HINT_MESSAGES, hint)
    ? END_ABANDONED_GUEST_TICKET_HINT_MESSAGES[hint]
    : null
}

interface EndAbandonedGuestTicketButtonProps {
  pending?: boolean
  onEnd: () => void
  /** Also show the explanation under the button (detail panel); the header keeps the button only. */
  showExplanation?: boolean
  className?: string
}

/**
 * "End ticket" for a guest ticket the visitor has abandoned. Guest tickets
 * can't be claimed, so the normal End ticket drawer never applies; this ends
 * the ticket directly (no billing, time logging or summary).
 */
export function EndAbandonedGuestTicketButton({
  pending = false,
  onEnd,
  showExplanation = true,
  className,
}: EndAbandonedGuestTicketButtonProps) {
  const button = (
    <Button
      type="button"
      variant="lavender"
      loading={pending}
      onClick={onEnd}
      aria-describedby={showExplanation ? "guest-abandoned-end-explanation" : undefined}
      className={cn("cursor-pointer w-fit", !showExplanation && className)}
    >
      End ticket
    </Button>
  )

  if (!showExplanation) return button

  return (
    <div data-slot="end-abandoned-guest-ticket" className={cn("flex flex-col gap-1.5", className)}>
      {button}
      <p id="guest-abandoned-end-explanation" data-slot="guest-abandoned-end-explanation" className="text-ui text-text-muted">
        {GUEST_ABANDONED_END_COPY}
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
