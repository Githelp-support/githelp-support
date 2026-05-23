import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

interface StartArgs {
  organizationId: string
}

/**
 * Org-side Connect onboarding: invokes payments-create-account (idempotent)
 * then payments-link-account, returning the Stripe-hosted onboarding URL the
 * caller should redirect to.
 */
export function useStartPaymentConnect() {
  return useMutation({
    mutationFn: async ({ organizationId }: StartArgs) => {
      const created = await supabase.functions.invoke("payments-create-account", {
        body: { scope: "organization", organization_id: organizationId },
      })
      if (created.error) {
        throw new Error(created.error.message || "Failed to create Connect account")
      }
      const linked = await supabase.functions.invoke("payments-link-account", {
        body: { scope: "organization", organization_id: organizationId },
      })
      if (linked.error) {
        throw new Error(linked.error.message || "Failed to create onboarding link")
      }
      const url = (linked.data as { url?: string } | null)?.url
      if (!url) throw new Error("No onboarding URL returned")
      return { url }
    },
  })
}
