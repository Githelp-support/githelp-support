"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Clock, Info } from "lucide-react"

/**
 * Customer-side "End session" confirmation. Makes it explicit that pressing
 * the button does NOT end the ticket — it only notifies the helper, who logs
 * any remaining time and finalises from their side.
 */
export function EndSessionRequestDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>End this session?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            This lets the helper know you&apos;d like to wrap up. They will log any remaining time and end the
            session from their side. You can keep writing in the chat, and you can cancel this request at any time
            until the helper has ended the session.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep session open
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Notifying helper…" : "Ask to end session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Customer-side status strip shown above the chat input while an end request
 * is outstanding. Stays until the helper ends the session (the row's status
 * flips and the page swaps to the ended summary) or the customer withdraws.
 */
export function EndSessionRequestedBanner({
  requestedAt,
  onCancel,
  pending,
  className,
}: {
  requestedAt?: string | null
  onCancel: () => void
  pending?: boolean
  className?: string
}) {
  const when = requestedAt
    ? new Date(requestedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null
  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border border-brand-primary/30 bg-brand-primary/5 px-4 py-3",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
      <div className="flex-1 text-sm leading-relaxed text-foreground">
        <p className="font-medium">The helper has been notified that you&apos;d like to end the session.</p>
        <p className="text-muted-foreground">
          Awaiting their final confirmation{when ? ` (requested ${when})` : ""}. You can still write in the chat, or
          cancel this request at any time until the helper ends the session.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="shrink-0 cursor-pointer">
        {pending ? "Cancelling…" : "Cancel request"}
      </Button>
    </div>
  )
}

/**
 * Helper-side prompt shown above the chat input when the customer has asked to
 * end the session. The helper finalises via the regular End ticket drawer
 * (outcome + logged time); logging time first is offered as a shortcut.
 */
export function EndSessionRequestedHelperBanner({
  requesterName,
  requestedAt,
  onLogTime,
  onEndSession,
  className,
}: {
  requesterName?: string | null
  requestedAt?: string | null
  onLogTime?: () => void
  onEndSession: () => void
  className?: string
}) {
  const when = requestedAt
    ? new Date(requestedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
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
          {requesterName ? requesterName : "The user"} has asked to end this session{when ? ` (${when})` : ""}.
        </p>
        <p className="text-muted-foreground">
          Log any remaining time, then end the session to finalise the ticket. The user can still write or withdraw the
          request until you do.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {onLogTime && (
          <Button variant="outline" size="sm" onClick={onLogTime} className="cursor-pointer">
            Log time
          </Button>
        )}
        <Button size="sm" onClick={onEndSession} className="cursor-pointer">
          End session
        </Button>
      </div>
    </div>
  )
}
