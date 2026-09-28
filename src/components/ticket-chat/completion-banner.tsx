"use client"

import { useState } from "react"
import { Bot, CheckCircle2, Clock, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatUsd, useTicketCompletion } from "@/hooks/useApiAccess"

/** The ticket fields the completion handshake needs. */
export interface CompletionTicket {
  id: string
  status: string
  created_by: string | null
  pricing_mode?: "time" | "fixed_answer" | null
  fixed_price_smallest_unit?: number | null
  completion_proposed_by?: string | null
  completion_proposed_at?: string | null
  completion_summary?: string | null
}

type Mode = null | "decline" | "propose" | "escalate"

const OPEN_STATUSES = ["claimed", "in-progress"]

function Strip({
  tone,
  icon,
  children,
  className,
}: {
  tone: "brand" | "amber" | "muted"
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border px-4 py-3",
        tone === "brand" && "border-brand-primary/30 bg-brand-primary/5",
        tone === "amber" && "border-amber-300 bg-amber-50",
        tone === "muted" && "border-border bg-muted/40",
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

/**
 * The two-sided "is this ticket done?" handshake (ticket-completion edge
 * function). One side proposes the ticket is resolved, the other accepts
 * (completes it and charges the customer) or declines with a reason.
 *
 * On time-based tickets the customer keeps the existing End session request
 * and the helper keeps the End ticket drawer; the banner then only covers a
 * helper's proposal (customer view) or the helper's own proposal. Tickets an
 * AI agent answers (pricing_mode = fixed_answer) are only finished here.
 */
export function CompletionBanner({
  ticket,
  currentUserId,
  role,
  paymentStatus,
  className,
}: {
  ticket: CompletionTicket
  currentUserId?: string | null
  role: "customer" | "helper"
  /** useTicketPaymentStatus().status — gates accepting a paid agent answer. */
  paymentStatus?: string | null
  className?: string
}) {
  const completion = useTicketCompletion()
  const [mode, setMode] = useState<Mode>(null)
  const [text, setText] = useState("")

  if (!currentUserId || !OPEN_STATUSES.includes(ticket.status)) return null

  const fixed = ticket.pricing_mode === "fixed_answer"
  // On agent tickets only the claiming agent (via the API) speaks for the
  // helper side; human helpers and admins just watch.
  if (role === "helper" && fixed) return null
  const price = formatUsd(ticket.fixed_price_smallest_unit)
  const paidAgentAnswer = fixed && (ticket.fixed_price_smallest_unit ?? 0) > 0
  // The server refuses to complete a ticket whose payment isn't secured
  // (payment_not_authorized); mirror that so Accept isn't a dead end.
  const PAYMENT_OK = ["authorized", "free", "sla_covered", "distributing", "completed"]
  const holdMissing =
    paymentStatus != null &&
    !(fixed && !paidAgentAnswer) &&
    !PAYMENT_OK.includes(paymentStatus)
  const proposerSide = ticket.completion_proposed_by
    ? ticket.completion_proposed_by === ticket.created_by
      ? "customer"
      : "helper"
    : null

  const run = async (input: Parameters<typeof completion.mutateAsync>[0], success: string) => {
    try {
      const result = await completion.mutateAsync(input)
      const payment = result?.payment as
        | { status?: string; charged?: string; failure_reason?: string; error?: string }
        | undefined
      if (payment?.status === "failed" || payment?.status === "capture_error") {
        toast.warning(
          `${success}, but the payment did not go through: ${payment.failure_reason ?? payment.error ?? "unknown error"}`,
        )
      } else if (payment?.charged && payment.status !== "free") {
        toast.success(`${success} — charged ${payment.charged}`)
      } else {
        toast.success(success)
      }
      setMode(null)
      setText("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  const inlineForm = (opts: {
    placeholder: string
    submitLabel: string
    required?: boolean
    onSubmit: (value: string) => void
  }) => (
    <div className="mt-2 space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={opts.placeholder}
        rows={2}
        className="bg-white"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={completion.isPending || (opts.required && !text.trim())}
          onClick={() => opts.onSubmit(text.trim())}
          className="cursor-pointer"
        >
          {completion.isPending ? "Saving…" : opts.submitLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(null)
            setText("")
          }}
          className="cursor-pointer"
        >
          Cancel
        </Button>
      </div>
    </div>
  )

  const escalateAction =
    role === "customer" && fixed ? (
      mode === "escalate" ? (
        inlineForm({
          placeholder: "What should the human helper know? (optional)",
          submitLabel: "Ask for a human",
          onSubmit: (reason) =>
            run(
              { action: "escalate", ticket_id: ticket.id, reason: reason || undefined },
              "The ticket was handed to the project's human helpers",
            ),
        })
      ) : (
        <Button
          variant="link"
          size="sm"
          className="px-0 h-auto cursor-pointer"
          onClick={() => setMode("escalate")}
          disabled={completion.isPending}
        >
          Ask for a human instead
        </Button>
      )
    ) : null

  // The other side proposed: accept or decline.
  if (proposerSide && proposerSide !== role) {
    if (role === "helper" && !fixed) return null // covered by the End session request banner
    const who = proposerSide === "helper" ? (fixed ? "The AI agent" : "Your helper") : "The customer"
    return (
      <Strip
        tone="amber"
        icon={<CheckCircle2 className="h-4 w-4 text-amber-700" />}
        className={className}
      >
        <p className="font-medium">{who} says this ticket is resolved.</p>
        {ticket.completion_summary && (
          <p className="text-muted-foreground whitespace-pre-wrap">{ticket.completion_summary}</p>
        )}
        {mode === "decline" ? (
          inlineForm({
            placeholder: "What is still not working?",
            submitLabel: "Decline",
            required: true,
            onSubmit: (reason) =>
              run({ action: "respond", ticket_id: ticket.id, accept: false, reason }, "Sent — the conversation continues"),
          })
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={completion.isPending || (role === "customer" && holdMissing)}
              title={role === "customer" && holdMissing ? "Add a payment method first" : undefined}
              onClick={() => run({ action: "respond", ticket_id: ticket.id, accept: true }, "Ticket completed")}
              className="cursor-pointer"
            >
              {role === "customer" && paidAgentAnswer
                ? `Accept answer & pay ${price}`
                : "Accept & complete"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={completion.isPending}
              onClick={() => setMode("decline")}
              className="cursor-pointer"
            >
              Not resolved yet
            </Button>
          </div>
        )}
        {role === "customer" && holdMissing && mode !== "decline" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Add a payment method first — use the payment prompt in the chat. You are only charged when you accept.
          </p>
        )}
        {mode !== "decline" && escalateAction}
      </Strip>
    )
  }

  // Our own proposal is waiting for the other side.
  if (proposerSide === role) {
    if (role === "customer" && !fixed) return null // covered by the End session request banner
    return (
      <Strip tone="brand" icon={<Clock className="h-4 w-4 text-brand-primary" />} className={className}>
        <p className="font-medium">
          Waiting for {role === "customer" ? "the AI agent" : "the customer"} to confirm the ticket is resolved.
        </p>
        <p className="text-muted-foreground">You can keep writing in the chat meanwhile.</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button
            variant="link"
            size="sm"
            className="px-0 h-auto cursor-pointer"
            disabled={completion.isPending}
            onClick={() => run({ action: "withdraw", ticket_id: ticket.id }, "Proposal withdrawn")}
          >
            Withdraw
          </Button>
          {escalateAction}
        </div>
      </Strip>
    )
  }

  // No proposal yet.
  if (role === "customer") {
    if (!fixed) return null // customers use End session on time-based tickets
    return (
      <Strip tone="muted" icon={<Bot className="h-4 w-4 text-muted-foreground" />} className={className}>
        <p className="font-medium">The project&apos;s AI agent is answering this ticket.</p>
        <p className="text-muted-foreground">
          {paidAgentAnswer
            ? `You pay ${price} only if you accept its answer.`
            : "Its answers are free."}
        </p>
        {mode === "propose" ? (
          inlineForm({
            placeholder: "Anything to add? (optional)",
            submitLabel: "Mark as resolved",
            onSubmit: (summary) =>
              run(
                { action: "propose", ticket_id: ticket.id, summary: summary || undefined },
                "Sent — the agent will confirm",
              ),
          })
        ) : mode === "escalate" ? (
          escalateAction
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode("propose")}
              disabled={completion.isPending}
              className="cursor-pointer"
            >
              Mark as resolved
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("escalate")}
              disabled={completion.isPending}
              className="cursor-pointer"
            >
              <UserRound className="h-3.5 w-3.5 mr-1" />
              Ask for a human instead
            </Button>
          </div>
        )}
      </Strip>
    )
  }

  return mode === "propose" ? (
    <Strip tone="muted" icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} className={className}>
      <p className="font-medium">Propose that this ticket is resolved</p>
      <p className="text-muted-foreground">
        The customer confirms before the ticket is completed and charged
        {fixed ? "." : " (logged time they have not reviewed yet must be reviewed first)."}
      </p>
      {inlineForm({
        placeholder: "Short summary of the fix (optional)",
        submitLabel: "Send proposal",
        onSubmit: (summary) =>
          run(
            { action: "propose", ticket_id: ticket.id, summary: summary || undefined },
            "Proposal sent to the customer",
          ),
      })}
    </Strip>
  ) : (
    <div className={cn("mx-4 mb-2 flex justify-end", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode("propose")}
        className="cursor-pointer text-muted-foreground"
      >
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        Ask customer to confirm it&apos;s resolved
      </Button>
    </div>
  )
}
