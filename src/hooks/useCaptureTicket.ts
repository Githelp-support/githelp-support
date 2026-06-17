import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type CaptureTicketStatus = "distributing" | "completed" | "failed"

interface CaptureArgs {
  ticketId: string
}

export interface CaptureTicketResult {
  paymentId?: string
  status: CaptureTicketStatus
  /** Final amount charged to the payer, in the smallest currency unit. */
  finalAmountSmallestUnit?: number
  totalMinutes?: number
  /** True when the computed total was clamped down to the authorized hold amount. */
  cappedAtAuthorized?: boolean
  failureReason?: string
}

/**
 * Invoke the backend `payments-capture-ticket` edge function to capture the
 * authorized hold for a completed ticket and kick off payout distribution.
 * Called when a helper ends a (non-SLA) session.
 */
export function useCaptureTicket() {
  return useMutation({
    mutationFn: async (args: CaptureArgs): Promise<CaptureTicketResult> => {
      const resp = await supabase.functions.invoke("payments-capture-ticket", {
        body: { ticket_id: args.ticketId },
      })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to capture payment")
      }
      const data = (resp.data ?? {}) as Record<string, unknown>
      // The edge function returns HTTP 200 even when the Stripe capture failed
      // (status:"failed" in the body). Surface that as a thrown error so callers
      // see isError and never render it as a successful charge.
      if (data.status === "failed") {
        throw new Error((data.failure_reason as string) || "Payment capture failed")
      }
      return {
        paymentId: data.payment_id as string | undefined,
        status: data.status as CaptureTicketStatus,
        finalAmountSmallestUnit: data.final_amount_smallest_unit as number | undefined,
        totalMinutes: data.total_minutes as number | undefined,
        cappedAtAuthorized: data.capped_at_authorized as boolean | undefined,
        failureReason: data.failure_reason as string | undefined,
      }
    },
  })
}
