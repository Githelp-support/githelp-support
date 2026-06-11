import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface CreateCheckoutResult {
  checkoutUrl: string
  holdAmountSmallestUnit?: number
}

/**
 * Customer-initiated: returns a Stripe Checkout URL for adding a card
 * AND placing a hold on this specific ticket in one redirect. Used by
 * the chat-side "Add payment method" CTA on the payment_required
 * system message.
 */
export function useCreateCheckoutForTicket() {
  return useMutation({
    mutationFn: async (args: { ticketId: string }): Promise<CreateCheckoutResult> => {
      const resp = await supabase.functions.invoke("payments-create-checkout-for-ticket", {
        body: { ticket_id: args.ticketId },
      })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to start checkout")
      }
      const data = (resp.data ?? {}) as Record<string, unknown>
      return {
        checkoutUrl: data.checkout_url as string,
        holdAmountSmallestUnit: data.hold_amount_smallest_unit as number | undefined,
      }
    },
  })
}
