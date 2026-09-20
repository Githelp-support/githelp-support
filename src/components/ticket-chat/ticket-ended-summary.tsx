"use client"

import NextLink from "next/link"
import { Button } from "@/components/ui/button"
import { usePaymentTransfers } from "@/hooks/usePayments"
import { cn } from "@/lib/utils"

interface TicketEndedSummaryProps {
  ticketId: string
  /** Ticket ended with "Not able to help" (cancelled) — nothing is charged. */
  isCancelledEnd: boolean
  /** Project runs free support — the payment gate is open with no charge. */
  isFreeSupport: boolean
  /** Amount Stripe actually captured, in smallest unit (cents). */
  chargedSmallestUnit: number | null
  /** Capture succeeded (payment row is distributing/completed). */
  paymentSettled: boolean
  /** Capture is still in flight (hold authorized / capture pending). */
  paymentProcessing: boolean
  /** Capture failed — offer a retry. */
  paymentFailed: boolean
  /** Stripe's failure message, when the capture failed. */
  paymentFailureReason: string | null
  /** Total logged time, preformatted (e.g. "01:30 h"). */
  timeLoggedFormatted: string
  onRetryPayment: () => void
  isRetryingPayment: boolean
}

/** "$X.XX" from smallest-unit cents. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * End-of-ticket summary card: Outcome / Time logged / Charged, plus — once the
 * payment has settled — an indented breakdown of where the charged amount went
 * (helper share, project share, Stripe fee). Shown to both Helpers and Admins.
 */
export function TicketEndedSummary({
  ticketId,
  isCancelledEnd,
  isFreeSupport,
  chargedSmallestUnit,
  paymentSettled,
  paymentProcessing,
  paymentFailed,
  paymentFailureReason,
  timeLoggedFormatted,
  onRetryPayment,
  isRetryingPayment,
}: TicketEndedSummaryProps) {
  const chargedLabel = isCancelledEnd
    ? "No charge"
    : isFreeSupport
      ? "Free support"
      : paymentSettled && chargedSmallestUnit != null
        ? formatCents(chargedSmallestUnit)
        : paymentProcessing
          ? "Processing…"
          : paymentFailed
            ? "Failed"
            : "—"

  // The breakdown only makes sense once money actually moved: hide it entirely
  // for "No charge" / "Free support" / "Processing…" / "Failed" end states.
  const showBreakdown =
    !isCancelledEnd && !isFreeSupport && paymentSettled && chargedSmallestUnit != null

  // Per-recipient splits for this ticket (payments_transfers rows). Only
  // fetched once the breakdown is visible so we never cache a pre-capture
  // empty result.
  const { data: transfers, isLoading: transfersLoading } = usePaymentTransfers({
    ticketId,
    enabled: showBreakdown,
  })

  // Same aggregation as the payout reports: failed rows don't count.
  const nonFailedTransfers = (transfers ?? []).filter((t) => t.status !== "failed")
  const sumByType = (type: string) =>
    nonFailedTransfers
      .filter((t) => t.transfer_user_type === type)
      .reduce((acc, t) => acc + t.amount_smallest_unit, 0)
  const helperShare = sumByType("helper")
  const projectShare = sumByType("project")
  const platformShare = sumByType("platform")
  // The Stripe fee is the remainder the platform deducts before splitting
  // (2.9% + $0.30 — see distribution-preview.tsx); derived rather than stored.
  const stripeFee =
    chargedSmallestUnit != null
      ? Math.max(0, chargedSmallestUnit - (helperShare + projectShare + platformShare))
      : 0

  // While transfers are loading or distribution hasn't written rows yet, keep
  // the sub-rows visible with em-dash placeholders.
  const transfersReady = !transfersLoading && nonFailedTransfers.length > 0

  const breakdownRows = [
    { label: "Share helper", amount: helperShare },
    { label: "Share project", amount: projectShare },
    { label: "Stripe fee", amount: stripeFee },
  ]

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 max-w-xs">
      <div className="space-y-1.5 text-[13px]">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Outcome</span>
          <span className="font-medium text-foreground">
            {isCancelledEnd ? "Not able to help" : "Resolved"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Time logged</span>
          <span className="font-medium text-foreground tabular-nums">{timeLoggedFormatted}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Charged</span>
          <span className="font-medium text-foreground tabular-nums">{chargedLabel}</span>
        </div>

        {showBreakdown && (
          <div className="ml-1 border-l-2 border-border pl-3 space-y-1 pt-0.5">
            {breakdownRows.map(({ label, amount }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-6 text-[12px]"
              >
                <span className="text-muted-foreground/80">{label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    transfersReady ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {transfersReady ? formatCents(amount) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {paymentFailed && paymentFailureReason && (
        <p className="mt-2 text-[12px] leading-snug text-destructive">{paymentFailureReason}</p>
      )}
      {paymentFailed && (
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          The customer has been notified and can update their card from the ticket chat; the
          charge retries automatically once they do.
        </p>
      )}
      {paymentFailed && (
        <Button
          onClick={onRetryPayment}
          disabled={isRetryingPayment}
          variant="outline"
          size="sm"
          className="mt-3 border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
        >
          {isRetryingPayment ? "Retrying…" : "Retry payment"}
        </Button>
      )}

      <div className="mt-3">
        <NextLink href="/tickets">
          <Button variant="default" size="sm">
            Back to tickets
          </Button>
        </NextLink>
      </div>
    </div>
  )
}
