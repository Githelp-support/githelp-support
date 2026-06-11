import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type SetupPaymentMethodScope = "organization" | "user"

interface SetupArgs {
  scope: SetupPaymentMethodScope
  organizationId?: string
}

interface SetupResult {
  checkoutUrl: string
}

/**
 * Kick off a Stripe-hosted SetupIntent Checkout for adding / replacing the
 * default card on file. Returns the checkout URL the caller should redirect
 * to. The `setup_intent.succeeded` webhook persists the resulting payment
 * method on the matching `*_payments_config` row.
 */
export function useSetupPaymentMethod() {
  return useMutation({
    mutationFn: async ({ scope, organizationId }: SetupArgs): Promise<SetupResult> => {
      const body: Record<string, unknown> = { scope }
      if (scope === "organization") {
        if (!organizationId) {
          throw new Error("organizationId is required for scope=organization")
        }
        body.organization_id = organizationId
      }
      const resp = await supabase.functions.invoke("payments-setup-method", { body })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to start card setup")
      }
      const checkoutUrl = (resp.data as { checkout_url?: string } | null)?.checkout_url
      if (!checkoutUrl) throw new Error("No checkout URL returned")
      return { checkoutUrl }
    },
  })
}
