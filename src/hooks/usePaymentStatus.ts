import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { ConnectStatusFields } from "@/lib/payment-status"

export type PaymentStatusScope = "organization" | "user"

interface UsePaymentStatusArgs {
  scope: PaymentStatusScope
  /** organization id or user id depending on scope. Empty disables the query. */
  scopeId: string
}

export type PaymentStatusData = ConnectStatusFields & {
  default_payment_method_id: string | null
  card_brand: string | null
  card_last4: string | null
}

/**
 * Read Connect status fields + the default payment method id for an
 * organization or a user. Returns null when no row exists yet.
 */
export function usePaymentStatus({ scope, scopeId }: UsePaymentStatusArgs) {
  const table = scope === "organization"
    ? "organizations_payments_config"
    : "users_payments_config"
  // card_brand / card_last4 exist only on users_payments_config for now; the
  // org config table keeps id-only display until org-billed payments land.
  const columns = scope === "organization"
    ? "stripe_account_id, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, default_payment_method_id"
    : "stripe_account_id, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, default_payment_method_id, card_brand, card_last4"
  return useQuery({
    queryKey: ["payment-status", scope, scopeId],
    enabled: !!scopeId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PaymentStatusData | null> => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq("id", scopeId)
        .maybeSingle()
      if (error) throw error
      return data as PaymentStatusData | null
    },
  })
}
