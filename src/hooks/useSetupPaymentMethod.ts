import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type SetupPaymentMethodScope = "organization" | "user"

interface SetupArgs {
  scope: SetupPaymentMethodScope
  organizationId?: string
  /** Selects the Stripe mode via the project's sandbox flag (test vs live). */
  projectId?: string
  /** Relative app path to return to after Stripe Checkout. */
  returnPath?: string
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
    mutationFn: async ({ scope, organizationId, projectId, returnPath }: SetupArgs): Promise<SetupResult> => {
      const body: Record<string, unknown> = { scope }
      if (scope === "organization") {
        if (!organizationId) {
          throw new Error("organizationId is required for scope=organization")
        }
        body.organization_id = organizationId
      }
      if (projectId) body.project_id = projectId
      if (returnPath) body.return_path = returnPath
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
