import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface RetryTicketPaymentResult {
  checkoutUrl: string
  payerType?: "user" | "organization"
  failureReason?: string | null
}

/**
 * Customer-initiated remedy for a failed ticket payment: returns a Stripe
 * Checkout (setup) URL to save a new card. Once Stripe confirms the card, the
 * backend retries the ticket's charge automatically — no helper action
 * needed. Used by the "Update payment method" CTA on a `payment_failed`
 * system message.
 */
export function useRetryTicketPayment() {
  return useMutation({
    mutationFn: async (args: { ticketId: string }): Promise<RetryTicketPaymentResult> => {
      const returnOrigin =
        typeof window !== "undefined" ? window.location.origin : undefined
      const resp = await supabase.functions.invoke("payments-retry-ticket-payment", {
        body: { ticket_id: args.ticketId, return_origin: returnOrigin },
      })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to start checkout")
      }
      const data = (resp.data ?? {}) as Record<string, unknown>
      if (typeof data.error === "string") {
        throw new Error(data.error)
      }
      return {
        checkoutUrl: data.checkout_url as string,
        payerType: data.payer_type as "user" | "organization" | undefined,
        failureReason: (data.failure_reason as string | null | undefined) ?? null,
      }
    },
  })
}
