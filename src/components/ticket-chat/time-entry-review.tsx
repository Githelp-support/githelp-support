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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Check, Clock, X } from "lucide-react"
import { TIME_ENTRY_AUTO_ACCEPT_HOURS, type TimeEntryReviewStatus } from "@/lib/time-entries"

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
 * Small inline status used in the Logged time sidebars and the End ticket
 * drawer. Pending is the normal state during a session (the customer confirms
 * everything at once when the helper ends), so it is worded neutrally.
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
        ? "To confirm when the session ends"
        : STATUS_LABEL.pending
      : status === "accepted" && auto
        ? "Confirmed automatically"
        : STATUS_LABEL[status]
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

/**
 * Customer-side summary of everything the helper logged, confirmed with a
 * single action before the session ends. Each not-yet-confirmed entry can be
 * declined individually; a decline needs a reason, which the RPC posts into
 * the chat for the helper. Entries confirmed earlier (a previous summary) are
 * listed read-only so the total matches what will be charged.
 */
export function TimeEntrySummaryDialog({
  open,
  onOpenChange,
  entries,
  onConfirm,
  pending,
  autoAcceptHint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: TimeEntrySummaryItem[]
  onConfirm: (declines: TimeEntrySummaryDecline[]) => void | Promise<void>
  pending?: boolean
  /** e.g. "in about 5 hours" — when the summary is confirmed automatically if left alone. */
  autoAcceptHint?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confirm the logged time</DialogTitle>
          <DialogDescription className="leading-relaxed">
            The helper is ready to end the session. This is the time they logged on this ticket. Confirm it to let the
            session end; only confirmed time is charged.
            {autoAcceptHint ? ` It is confirmed automatically ${autoAcceptHint} otherwise.` : ""}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts with the dialog, so every summary starts without stale declines. */}
        {open && (
          <TimeEntrySummaryForm entries={entries} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TimeEntrySummaryForm({
  entries,
  pending,
  onCancel,
  onConfirm,
}: {
  entries: TimeEntrySummaryItem[]
  pending?: boolean
  onCancel: () => void
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
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-4">
        {toConfirm.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">There is no logged time waiting for your confirmation.</p>
        ) : (
          <ul className="space-y-2" aria-label="Logged time to confirm">
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
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 shrink-0 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">{entry.type === "together" ? "T" : "S"}</span>
                      </div>
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
                  {entry.note && <p className="text-xs text-muted-foreground mt-2 ml-11">{entry.note}</p>}
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
          <div className="space-y-1 text-xs text-muted-foreground">
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

        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Total to be charged</span>
          <span className="text-sm font-medium text-foreground tabular-nums" data-testid="summary-total">
            {formatSummaryDuration(chargedTotal.hours, chargedTotal.minutes)}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Not now
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
        <p className="font-medium">Waiting for {who} to confirm the logged time</p>
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
