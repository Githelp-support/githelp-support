"use client"

import { useMemo, useState } from "react"
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
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Check, Clock, X } from "lucide-react"
import { TIME_ENTRY_AUTO_ACCEPT_HOURS, type TimeEntriesRejection, type TimeEntryReviewStatus } from "@/lib/time-entries"

/** Wording shown to the customer next to the reason field when they decline an entry. */
export const DECLINE_TIME_ENTRY_PROMPT =
  "Explain in a few words why you don't accept this time. Your explanation is shared with the helper in the chat, and the declined time is not charged."

export const DECLINE_REASON_MAX_LENGTH = 500

/**
 * Helper-side confirmation before deleting one of their own logged entries.
 * The customer sees a "removed" message in the chat afterwards.
 */
export function DeleteTimeEntryDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  durationLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  pending?: boolean
  /** e.g. "1h 30min" — shown in the title so it's clear which entry is deleted. */
  durationLabel?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {durationLabel ? `${durationLabel} of ` : ""}logged time?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            The entry is removed and won&apos;t be charged. The user will see a message in the chat that you removed it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_LABEL: Record<TimeEntryReviewStatus, string> = {
  pending: "Not yet confirmed",
  accepted: "Confirmed",
  declined: "Declined",
}

/**
 * Small inline status. Pending is the normal state during a session (the
 * customer confirms everything at once when the helper ends), so it is worded
 * neutrally.
 */
export function TimeEntryReviewStatusBadge({
  status,
  auto,
  perspective = "helper",
  label: labelOverride,
  className,
}: {
  status: TimeEntryReviewStatus
  /** Accepted by the 24h job rather than the customer. */
  auto?: boolean | null
  perspective?: "helper" | "customer"
  /** Replaces the default wording, e.g. "2 declined". */
  label?: string
  className?: string
}) {
  const label =
    labelOverride ??
    (status === "pending"
      ? perspective === "customer"
        ? "To confirm when the session ends"
        : STATUS_LABEL.pending
      : status === "accepted" && auto
        ? "Confirmed automatically"
        : STATUS_LABEL[status])
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "accepted" && "bg-emerald-50 text-emerald-700",
        status === "declined" && "bg-red-50 text-red-700",
        status === "pending" && "bg-muted text-muted-foreground",
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
 * Review state of all logged time on a ticket, shown once after the total in
 * the Logged time sidebars and the End ticket drawer. Time is confirmed as one
 * summary at the end of the session, so the entries share a state: not yet
 * confirmed while anything is pending, confirmed otherwise. Entries the
 * customer declined are counted next to it.
 */
export function TimeEntriesReviewStatus({
  entries,
  perspective = "helper",
  className,
}: {
  entries: { reviewStatus?: TimeEntryReviewStatus | null; autoAccepted?: boolean | null }[]
  perspective?: "helper" | "customer"
  className?: string
}) {
  const declinedCount = entries.filter((e) => e.reviewStatus === "declined").length
  const pending = entries.some((e) => e.reviewStatus === "pending")
  const accepted = entries.filter((e) => e.reviewStatus === "accepted")
  if (!pending && accepted.length === 0 && declinedCount === 0) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {pending ? (
        <TimeEntryReviewStatusBadge status="pending" perspective={perspective} />
      ) : accepted.length > 0 ? (
        <TimeEntryReviewStatusBadge status="accepted" auto={accepted.every((e) => e.autoAccepted)} />
      ) : null}
      {declinedCount > 0 && <TimeEntryReviewStatusBadge status="declined" label={`${declinedCount} declined`} />}
    </div>
  )
}

/** One row of the logged-time summary the customer confirms. */
export interface TimeEntrySummaryItem {
  id: string
  type: string
  /** YYYY-MM-DD */
  date: string
  hours: number
  minutes: number
  note?: string | null
  reviewStatus: TimeEntryReviewStatus
  helperName?: string | null
  /** Avatar key of the helper who logged it: their user id, else `projects_helpers.helper_id`. */
  helperId?: string | null
  helperAvatarUrl?: string | null
}

export interface TimeEntrySummaryDecline {
  entryId: string
  reason: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "01:30 h" — same format as the Logged time sidebars. */
export function formatSummaryDuration(hours: number, minutes: number): string {
  return `${pad(hours)}:${pad(minutes)} h`
}

/** YYYY-MM-DD → dd/mm/yyyy without timezone surprises; anything else is shown as-is. */
export function formatSummaryDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date
}

function sumMinutes(entries: TimeEntrySummaryItem[]): { hours: number; minutes: number } {
  const total = entries.reduce((acc, e) => acc + e.hours * 60 + e.minutes, 0)
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

/** Body text of the "Logged time rejected" view. */
export const REJECT_LOGGED_TIME_PROMPT =
  "You have rejected the time logged. Please explain why you are rejecting the logged time. Your explanation will be shared with your helper(s) in the ticket chat, so you together can coordinate what the logged time should be."

/**
 * Customer-side summary of everything the helper logged, confirmed with a
 * single action before the session ends. Each not-yet-confirmed entry can be
 * declined individually; a decline needs a reason, which the RPC posts into
 * the chat for the helper. Entries confirmed earlier (a previous summary) are
 * listed read-only so the total matches what will be charged.
 *
 * "Reject logged time" switches the same dialog to a second view asking for an
 * explanation, which `onReject` receives.
 */
export function TimeEntrySummaryDialog({
  open,
  onOpenChange,
  entries,
  onConfirm,
  onReject,
  pending,
  autoAcceptHint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: TimeEntrySummaryItem[]
  onConfirm: (declines: TimeEntrySummaryDecline[]) => void | Promise<void>
  /** Rejects the whole summary; `reason` is trimmed and never empty. */
  onReject: (reason: string) => void | Promise<void>
  pending?: boolean
  /** e.g. "in about 5 hours" — when the summary is confirmed automatically if left alone. */
  autoAcceptHint?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        {/* Content unmounts with the dialog, so every summary starts on the confirm view without stale declines. */}
        {open && (
          <TimeEntrySummaryContent
            entries={entries}
            pending={pending}
            autoAcceptHint={autoAcceptHint}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TimeEntrySummaryContent({
  entries,
  pending,
  autoAcceptHint,
  onConfirm,
  onReject,
}: {
  entries: TimeEntrySummaryItem[]
  pending?: boolean
  autoAcceptHint?: string | null
  onConfirm: (declines: TimeEntrySummaryDecline[]) => void | Promise<void>
  onReject: (reason: string) => void | Promise<void>
}) {
  const [view, setView] = useState<"confirm" | "reject">("confirm")
  const [rejectReason, setRejectReason] = useState("")
  const rejecting = view === "reject"
  const trimmedReason = rejectReason.trim()

  return (
    <>
      <DialogHeader>
        <DialogTitle>{rejecting ? "Logged time rejected" : "Confirm the logged time"}</DialogTitle>
        <DialogDescription className="leading-relaxed">
          {rejecting ? (
            REJECT_LOGGED_TIME_PROMPT
          ) : (
            <>
              The helper is ready to end the session. This is the time they logged on this ticket. Confirm it to let the
              session end; only confirmed time is charged.
              {autoAcceptHint ? ` It is confirmed automatically ${autoAcceptHint} otherwise.` : ""}
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {/* Stays mounted (only hidden) so Cancel brings back any per-entry declines already typed. */}
      <div hidden={rejecting} className="contents">
        <TimeEntrySummaryForm
          entries={entries}
          pending={pending}
          onReject={() => setView("reject")}
          onConfirm={onConfirm}
        />
      </div>

      {rejecting && (
        <>
          <Textarea
            aria-label="Why are you rejecting the logged time?"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, DECLINE_REASON_MAX_LENGTH))}
            rows={5}
            className="border-input resize-none bg-white"
            maxLength={DECLINE_REASON_MAX_LENGTH}
            autoFocus
            disabled={pending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setView("confirm")} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void onReject(trimmedReason)} disabled={pending || trimmedReason.length === 0}>
              {pending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  )
}

function TimeEntrySummaryForm({
  entries,
  pending,
  onReject,
  onConfirm,
}: {
  entries: TimeEntrySummaryItem[]
  pending?: boolean
  /** Opens the "Logged time rejected" view. */
  onReject: () => void
  onConfirm: (declines: TimeEntrySummaryDecline[]) => void | Promise<void>
}) {
  // entryId → reason draft. Presence in the map means "declined".
  const [declines, setDeclines] = useState<Record<string, string>>({})

  const toConfirm = useMemo(() => entries.filter((e) => e.reviewStatus === "pending"), [entries])
  const alreadyConfirmed = useMemo(() => entries.filter((e) => e.reviewStatus === "accepted"), [entries])
  const alreadyDeclined = useMemo(() => entries.filter((e) => e.reviewStatus === "declined"), [entries])

  const declinedIds = new Set(Object.keys(declines))
  const accepting = toConfirm.filter((e) => !declinedIds.has(e.id))
  const chargedTotal = sumMinutes([...accepting, ...alreadyConfirmed])
  const missingReason = Object.values(declines).some((r) => r.trim().length === 0)
  const canSubmit = !pending && toConfirm.length > 0 && !missingReason

  const toggleDecline = (id: string) =>
    setDeclines((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = ""
      return next
    })

  const submit = () =>
    void onConfirm(
      Object.entries(declines).map(([entryId, reason]) => ({ entryId, reason: reason.trim() })),
    )

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        {toConfirm.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">There is no logged time waiting for your confirmation.</p>
        ) : (
          // Only the entries scroll: capped at three collapsed rows (3 × 66px + 2 × 8px gap);
          // the total and the buttons below stay in view.
          <ul
            className={cn(
              "min-h-0 overflow-y-auto -mx-1 px-1 space-y-2",
              toConfirm.length > 3 && "max-h-[214px]",
            )}
            aria-label="Logged time to confirm"
          >
            {toConfirm.map((entry) => {
              const declined = declinedIds.has(entry.id)
              const reasonId = `decline-reason-${entry.id}`
              return (
                <li
                  key={entry.id}
                  data-declined={declined || undefined}
                  className={cn(
                    "rounded-lg border border-border p-3",
                    declined ? "border-red-200 bg-red-50/60" : "bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Same avatar as the Logged time list in the right sidebar. */}
                      <ProfileAvatar
                        id={entry.helperId}
                        name={entry.helperName}
                        avatarUrl={entry.helperAvatarUrl ?? null}
                        size="sm"
                        radius="8.25px"
                        className="w-6 h-6"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">
                          {entry.type}
                          {entry.helperName ? <span className="font-normal text-muted-foreground"> · {entry.helperName}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatSummaryDate(entry.date)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn("text-sm tabular-nums", declined ? "line-through text-muted-foreground" : "text-foreground")}>
                        {formatSummaryDuration(entry.hours, entry.minutes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDecline(entry.id)}
                        disabled={pending}
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
                      >
                        {declined ? "Keep it" : "Decline"}
                      </button>
                    </div>
                  </div>
                  {entry.note && <p className="text-xs text-muted-foreground mt-2 ml-8">{entry.note}</p>}
                  {declined && (
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor={reasonId} className="text-xs text-muted-foreground">
                        Why are you declining this time?
                      </Label>
                      <Textarea
                        id={reasonId}
                        value={declines[entry.id] ?? ""}
                        onChange={(e) =>
                          setDeclines((prev) => ({ ...prev, [entry.id]: e.target.value.slice(0, DECLINE_REASON_MAX_LENGTH) }))
                        }
                        placeholder="e.g. We only worked together for about 20 minutes, not an hour."
                        className="border-input min-h-[72px] resize-none bg-white"
                        maxLength={DECLINE_REASON_MAX_LENGTH}
                        autoFocus
                        disabled={pending}
                      />
                      <p className="text-xs text-muted-foreground">{DECLINE_TIME_ENTRY_PROMPT}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {(alreadyConfirmed.length > 0 || alreadyDeclined.length > 0) && (
          <div className="shrink-0 space-y-1 text-xs text-muted-foreground">
            {alreadyConfirmed.length > 0 && (
              <p>
                Already confirmed earlier: {formatSummaryDuration(sumMinutes(alreadyConfirmed).hours, sumMinutes(alreadyConfirmed).minutes)} (
                {alreadyConfirmed.length} {alreadyConfirmed.length === 1 ? "entry" : "entries"})
              </p>
            )}
            {alreadyDeclined.length > 0 && (
              <p>
                Declined earlier: {alreadyDeclined.length} {alreadyDeclined.length === 1 ? "entry" : "entries"} (not charged)
              </p>
            )}
          </div>
        )}

        <div className="shrink-0 border-t border-border pt-3 mb-[3px] flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Total to be charged</span>
          <span className="text-sm font-medium text-foreground tabular-nums" data-testid="summary-total">
            {formatSummaryDuration(chargedTotal.hours, chargedTotal.minutes)}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onReject} disabled={pending || toConfirm.length === 0}>
          Reject logged time
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {pending
            ? "Confirming…"
            : declinedIds.size > 0
              ? `Confirm ${accepting.length} and decline ${declinedIds.size}`
              : "Confirm logged time"}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Customer-side strip above the chat input once the helper has sent the
 * summary. Opens the confirmation dialog; the helper cannot end the session
 * until the summary is confirmed (or the 24h auto-confirm kicks in).
 */
export function TimeEntrySummaryBanner({
  pendingCount,
  helperName,
  autoAcceptHint,
  onReview,
  className,
}: {
  pendingCount: number
  helperName?: string | null
  /** e.g. "in about 5 hours" */
  autoAcceptHint?: string | null
  onReview: () => void
  className?: string
}) {
  const who = helperName || "The helper"
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
        <p className="font-medium">{who} is ready to end the session and needs you to confirm the logged time.</p>
        <p className="text-muted-foreground">
          {pendingCount === 1 ? "1 entry is" : `${pendingCount} entries are`} waiting for your confirmation. Only confirmed
          time is charged.
          {autoAcceptHint ? ` It is confirmed automatically ${autoAcceptHint} if you don't respond.` : ""}
        </p>
      </div>
      <Button size="sm" onClick={onReview} className="shrink-0 cursor-pointer">
        Review &amp; confirm
      </Button>
    </div>
  )
}

/**
 * Helper-side strip above the chat input while the summary they sent is
 * waiting for the customer's confirmation.
 */
export function TimeEntryAwaitingApprovalBanner({
  pendingCount,
  customerName,
  autoAcceptHint,
  className,
}: {
  pendingCount: number
  customerName?: string | null
  /** e.g. "in about 5 hours" */
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
        <p className="font-[550]">Waiting for {who} to confirm the logged time</p>
        <p className="text-muted-foreground">
          You sent the summary ({pendingCount === 1 ? "1 entry" : `${pendingCount} entries`}). The session ends once
          they confirm it; declined time is not charged.
          {autoAcceptHint
            ? ` It is confirmed automatically ${autoAcceptHint} if they don't respond.`
            : ` It is confirmed automatically after ${TIME_ENTRY_AUTO_ACCEPT_HOURS} hours if they don't respond.`}
        </p>
      </div>
    </div>
  )
}

/**
 * Helper-side strip above the chat input after the customer rejected the
 * logged-time summary. Their explanation is posted in the chat.
 */
export function TimeEntryRejectedBanner({
  customerName,
  className,
}: {
  customerName?: string | null
  className?: string
}) {
  const who = customerName || "The user"
  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3",
        className,
      )}
    >
      <i
        className="fi fi-rr-cross-circle mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[16px] leading-none text-amber-700"
        aria-hidden
      />
      <div className="flex-1 text-sm leading-relaxed text-foreground">
        <p className="font-[550]">{who} has rejected the logged time</p>
        <p className="text-muted-foreground">See the explanation for the rejection in the chat.</p>
      </div>
    </div>
  )
}

/**
 * Body of the chat system message for a fully rejected summary: who rejected
 * it, then their explanation once as a quoted block. Rendered inside the amber
 * system-message bubble on both the helper and the customer side.
 */
export function TimeEntriesRejectedMessage({
  rejection,
  customerName,
}: {
  rejection: TimeEntriesRejection
  /** Used when the message metadata carries no reviewer name. */
  customerName?: string | null
}) {
  const who = rejection.reviewerName || customerName || "The user"
  return (
    <div data-slot="time-entries-rejected-message">
      <p className="font-[550]">{who} rejected the logged time</p>
      {rejection.reasons.map((reason) => (
        <blockquote key={reason} className="mt-1.5 border-l-2 border-amber-300 pl-3 whitespace-pre-wrap break-words">
          {reason}
        </blockquote>
      ))}
    </div>
  )
}
