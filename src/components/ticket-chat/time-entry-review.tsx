"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Check, Clock, X } from "lucide-react"
import { TIME_ENTRY_AUTO_ACCEPT_HOURS, type TimeEntryReviewStatus } from "@/lib/time-entries"

/** Wording shown to the customer when they decline a logged entry. */
export const DECLINE_TIME_ENTRY_PROMPT =
  "Please explain in a few words why you declined the logged time by the helper. The explanation for your decline will be shared directly with the helper in this chat."

export const DECLINE_REASON_MAX_LENGTH = 500

/**
 * Customer-side dialog opened from "Decline" on a logged-time bubble. The
 * explanation is mandatory: the RPC rejects a decline without one, and the
 * helper only sees the reason through the chat message it produces.
 */
export function DeclineTimeEntryDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  durationLabel,
  helperName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void | Promise<void>
  pending?: boolean
  /** e.g. "1h 30min" — shown in the title so it's clear which entry is declined. */
  durationLabel?: string | null
  helperName?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Decline {durationLabel ? `${durationLabel} ` : ""}logged{helperName ? ` by ${helperName}` : ""}?
          </DialogTitle>
          <DialogDescription className="leading-relaxed">{DECLINE_TIME_ENTRY_PROMPT}</DialogDescription>
        </DialogHeader>
        {/* Content unmounts with the dialog, so each decline starts with an empty explanation. */}
        <DeclineReasonForm pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  )
}

function DeclineReasonForm({
  pending,
  onCancel,
  onConfirm,
}: {
  pending?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void | Promise<void>
}) {
  const [reason, setReason] = useState("")
  const trimmed = reason.trim()
  const canSubmit = trimmed.length > 0 && !pending

  return (
    <>
        <div className="space-y-2">
          <Label htmlFor="decline-time-entry-reason" className="text-sm text-muted-foreground">
            Why are you declining this time?
          </Label>
          <Textarea
            id="decline-time-entry-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, DECLINE_REASON_MAX_LENGTH))}
            placeholder="e.g. We only worked together for about 20 minutes, not an hour."
            className="border-input min-h-[96px] resize-none"
            maxLength={DECLINE_REASON_MAX_LENGTH}
            autoFocus
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Required. The declined time will not be charged.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm(trimmed)} disabled={!canSubmit}>
            {pending ? "Declining…" : "Decline logged time"}
          </Button>
        </DialogFooter>
    </>
  )
}

/**
 * Accept / Decline actions rendered inside a pending `time_logged` bubble
 * for the ticket creator.
 */
export function TimeEntryReviewActions({
  onAccept,
  onDecline,
  pending,
  autoAcceptHint,
  className,
}: {
  onAccept: () => void
  onDecline: () => void
  pending?: boolean
  /** e.g. "in about 5 hours" — when the entry is accepted automatically if left alone. */
  autoAcceptHint?: string | null
  className?: string
}) {
  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
        {pending ? "Saving…" : "Accept"}
      </button>
      <button
        type="button"
        onClick={onDecline}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
      >
        <X className="h-4 w-4" />
        Decline
      </button>
      <span className="text-xs text-muted-foreground">
        Please accept or decline before the session ends.
        {autoAcceptHint ? ` Accepted automatically ${autoAcceptHint} otherwise.` : ""}
      </span>
    </div>
  )
}

const STATUS_LABEL: Record<TimeEntryReviewStatus, string> = {
  pending: "Awaiting review",
  accepted: "Accepted",
  declined: "Declined",
}

/**
 * Small inline status used in the Logged time sidebars and the End ticket
 * drawer. `perspective` only changes the pending wording.
 */
export function TimeEntryReviewStatusBadge({
  status,
  auto,
  perspective = "helper",
  className,
}: {
  status: TimeEntryReviewStatus
  /** Accepted by the 24h job rather than the customer. */
  auto?: boolean | null
  perspective?: "helper" | "customer"
  className?: string
}) {
  const label =
    status === "pending"
      ? perspective === "customer"
        ? "Awaiting your review"
        : "Waiting for approval"
      : status === "accepted" && auto
        ? "Accepted automatically"
        : STATUS_LABEL[status]
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "accepted" && "bg-emerald-50 text-emerald-700",
        status === "declined" && "bg-red-50 text-red-700",
        status === "pending" && "bg-amber-50 text-amber-800",
        className,
      )}
    >
      {status === "accepted" ? (
        <Check className="h-3 w-3" />
      ) : status === "declined" ? (
        <X className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </span>
  )
}

/**
 * Customer-side strip above the chat input while logged entries are waiting
 * for their decision. Ending the session is blocked on the helper's side
 * until every entry has been accepted or declined.
 */
export function TimeEntryReviewBanner({ pendingCount, className }: { pendingCount: number; className?: string }) {
  if (pendingCount <= 0) return null
  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3",
        className,
      )}
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="flex-1 text-sm leading-relaxed text-foreground">
        <p className="font-medium">
          {pendingCount === 1 ? "The helper logged time that needs your review." : `${pendingCount} logged time entries need your review.`}
        </p>
        <p className="text-muted-foreground">
          Accept or decline {pendingCount === 1 ? "it" : "each one"} in the chat above. The session can&apos;t be ended
          until you have. If you decline, you&apos;ll be asked for a short explanation that is shared with the helper.
          Entries you don&apos;t review within {TIME_ENTRY_AUTO_ACCEPT_HOURS} hours are accepted automatically.
        </p>
      </div>
    </div>
  )
}

/**
 * Helper-side strip above the chat input while the customer still has to
 * accept or decline logged time. Mirrors `TimeEntryReviewBanner`.
 */
export function TimeEntryAwaitingApprovalBanner({
  pendingCount,
  customerName,
  autoAcceptHint,
  className,
}: {
  pendingCount: number
  customerName?: string | null
  /** e.g. "in about 5 hours" — for the oldest pending entry. */
  autoAcceptHint?: string | null
  className?: string
}) {
  if (pendingCount <= 0) return null
  const who = customerName || "the user"
  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3",
        className,
      )}
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="flex-1 text-sm leading-relaxed text-foreground">
        <p className="font-medium">
          {pendingCount === 1
            ? `Waiting for ${who} to approve your logged time`
            : `Waiting for ${who} to approve ${pendingCount} logged time entries`}
        </p>
        <p className="text-muted-foreground">
          The session can&apos;t be ended until {pendingCount === 1 ? "it has" : "each one has"} been accepted or
          declined.{autoAcceptHint ? ` Accepted automatically ${autoAcceptHint} otherwise.` : ""}
        </p>
      </div>
    </div>
  )
}
