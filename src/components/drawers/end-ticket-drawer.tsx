"use client"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Icon } from "@/components/ui/icon"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"
import type { TimeEntry } from "./log-time-drawer"
import { TimeEntriesReviewStatus } from "@/components/ticket-chat/time-entry-review"
import { TIME_ENTRY_AUTO_ACCEPT_HOURS, describeAutoAcceptDeadline } from "@/lib/time-entries"
import { cn } from "@/lib/utils"

interface EndTicketDrawerProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Ends the ticket. May be async: the drawer stays open (and the button
   * shows "Ending…") until it resolves, and stays open if it rejects so the
   * helper can retry after the page's error toast.
   */
  onEndTicket: (outcome: string) => void | Promise<void>
  timeEntries?: TimeEntry[]
  /** Set when the customer has asked to end the session — shown as a reminder to log remaining time first. */
  userRequestedEnd?: boolean
  /**
   * Set while the logged-time summary is waiting for the customer's
   * confirmation (`tickets.time_review_requested_at`). While entries are
   * pending and no summary has been sent, the primary action sends it via
   * `onRequestTimeReview` instead of ending.
   */
  timeReviewRequestedAt?: string | null
  onRequestTimeReview?: () => void | Promise<void>
  requestTimeReviewPending?: boolean
}

export function EndTicketDrawer({
  isOpen,
  onClose,
  onEndTicket,
  timeEntries = [],
  userRequestedEnd,
  timeReviewRequestedAt,
  onRequestTimeReview,
  requestTimeReviewPending,
}: EndTicketDrawerProps) {
  const [supportOutcome, setSupportOutcome] = useState("")
  const [ending, setEnding] = useState(false)

  // The drawer stays mounted while closed (exit animation); reset the form on close.
  const handleClose = () => {
    setSupportOutcome("")
    onClose()
  }

  const formatTimeEntry = (entry: TimeEntry) => {
    return {
      type: entry.type === "together" ? "Together" : "Solo",
      date: entry.date,
      hours: `${String(entry.hours).padStart(2, "0")}:${String(entry.minutes).padStart(2, "0")} h`,
    }
  }

  // Entries the user has not confirmed yet. Ending is blocked until they
  // have confirmed the summary: the charge is computed from what they
  // accepted. Until the summary is sent, the primary action sends it.
  const pendingReview = timeEntries.filter((entry) => entry.reviewStatus === "pending")
  const summaryRequested = !!timeReviewRequestedAt
  const needsSummary = pendingReview.length > 0 && !summaryRequested && !!onRequestTimeReview
  const waitingForUser = pendingReview.length > 0 && !needsSummary
  const canEnd = !!supportOutcome && pendingReview.length === 0
  const autoAcceptHint = summaryRequested ? describeAutoAcceptDeadline(timeReviewRequestedAt) : null

  const getTotalTime = () => {
    const totalMinutes = timeEntries.reduce((acc, entry) => {
      if (entry.reviewStatus === "declined") return acc
      return acc + entry.hours * 60 + entry.minutes
    }, 0)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} h`
  }

  const handleEndTicket = async () => {
    if (ending) return
    setEnding(true)
    try {
      await onEndTicket(supportOutcome)
      handleClose()
    } catch {
      // The page already reported the failure; keep the drawer open to retry.
    } finally {
      setEnding(false)
    }
  }

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={handleClose}
      title="End ticket"
      footerClassName="border-t-0"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          {needsSummary ? (
            <Button
              onClick={() => void onRequestTimeReview?.()}
              loading={requestTimeReviewPending}
              title="The user confirms all logged time at once before the session ends"
              variant="default"
              className="flex-1"
            >
              Send summary to user
            </Button>
          ) : (
            <Button
              onClick={() => void handleEndTicket()}
              disabled={!canEnd}
              loading={ending}
              title={waitingForUser ? "Waiting for the user to confirm the logged time" : undefined}
              variant="default"
              className="flex-1"
            >
              {waitingForUser ? "Waiting for user confirmation" : "End ticket"}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex-1 p-6 space-y-6.5 overflow-auto">
        {userRequestedEnd && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-foreground">
            <p className="font-medium">The user has asked to end this session.</p>
            <p className="text-muted-foreground mt-1">
              Make sure all your time is logged below before ending the ticket{" "}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="More information"
                    className="inline-flex cursor-help items-center justify-center rounded-sm align-text-bottom text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                  >
                    <Icon name="fi-rr-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  The user either confirms the total logged time or declines it with an explanation. If they decline the
                  logged time, agree on the final time together in the chat. If the user doesn&apos;t respond within 24
                  hours, the time is confirmed automatically. You can end the ticket once it&apos;s confirmed.
                </TooltipContent>
              </Tooltip>
            </p>
          </div>
        )}
        {needsSummary && (
          <div role="status" className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-foreground">
            <p className="font-medium flex items-center gap-2">
              <Icon name="fi-rr-clock" className="text-brand-primary" />
              {pendingReview.length === 1
                ? "1 logged entry needs the user's confirmation."
                : `${pendingReview.length} logged entries need the user's confirmation.`}
            </p>
            <p className="text-muted-foreground mt-1">
              Make sure all your time is logged, then send the summary. The user confirms it in one go (they can
              decline single entries with a reason) and you can end the ticket right after. If they don&apos;t respond
              within {TIME_ENTRY_AUTO_ACCEPT_HOURS} hours it is confirmed automatically. Declined time is not charged.
            </p>
          </div>
        )}
        {waitingForUser && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-foreground">
            <p className="font-medium flex items-center gap-2">
              <Icon name="fi-rr-clock" className="text-amber-700" />
              Waiting for the user to confirm the logged time.
            </p>
            <p className="text-muted-foreground mt-1">
              You sent the summary ({pendingReview.length === 1 ? "1 entry" : `${pendingReview.length} entries`}). The
              ticket can end once they confirm it
              {autoAcceptHint ? `; it is confirmed automatically ${autoAcceptHint} otherwise` : ""}. You can remind them
              in the chat. Declined time is not charged.
            </p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-4">How did the support go?</h3>
          <RadioGroup value={supportOutcome} onValueChange={setSupportOutcome}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="able-to-help" id="able-to-help" />
              <Label htmlFor="able-to-help" className="text-sm font-normal text-muted-foreground">
                Was able to help
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not-able-to-help" id="not-able-to-help" />
              <Label htmlFor="not-able-to-help" className="text-sm font-normal text-muted-foreground">
                Was not able to help
              </Label>
              {/* Sibling of the Label, not a child: hovering or clicking it must not toggle the radio. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="More information"
                    className="inline-flex cursor-help items-center justify-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                  >
                    <Icon name="fi-rr-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Consider not logging any time, if you weren&apos;t able to help the user.</TooltipContent>
              </Tooltip>
            </div>
          </RadioGroup>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-4">Logged time</h3>
          {timeEntries.length > 0 ? (
            <div className="space-y-3">
              {timeEntries.map((entry) => {
                const formatted = formatTimeEntry(entry)
                return (
                  <div key={entry.id} className="py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar
                          id={entry.helperUser?.id ?? entry.helperId}
                          name={entry.helperUser?.name}
                          avatarUrl={entry.helperUser?.avatarUrl ?? null}
                          size="sm"
                          radius="8.25px"
                          className="w-6 h-6"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatted.type}</p>
                          <p className="text-xs text-muted-foreground">{formatted.date}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm text-muted-foreground",
                          entry.reviewStatus === "declined" && "line-through",
                        )}
                      >
                        {formatted.hours}
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-1 ml-9">{entry.note}</p>}
                    {entry.reviewStatus === "declined" && (
                      <p className="text-xs text-muted-foreground mt-1 ml-9 italic">
                        Declined{entry.declineReason ? `: ${entry.declineReason}` : ""}
                      </p>
                    )}
                  </div>
                )
              })}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total time</span>
                <span className="text-sm font-medium text-foreground">{getTotalTime()}</span>
              </div>
              <TimeEntriesReviewStatus entries={timeEntries} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No time logged yet</p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <h4 className="text-ui font-semibold text-foreground mb-2">Completed support</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If the support was completed successfully, log the time spent. If you were not able to help, consider
            adjusting any time spent, in accordance with the user&apos;s expectations and actual delivery.
          </p>
        </div>
      </div>
    </DrawerPanel>
  )
}
