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
}

/**
 * Read Connect status fields + the default payment method id for an
 * organization or a user. Returns null when no row exists yet.
 */
export function usePaymentStatus({ scope, scopeId }: UsePaymentStatusArgs) {
  const table = scope === "organization"
    ? "organizations_payments_config"
    : "users_payments_config"
  return useQuery({
    queryKey: ["payment-status", scope, scopeId],
    enabled: !!scopeId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PaymentStatusData | null> => {
      const { data, error } = await supabase
        .from(table)
        .select(
          "stripe_account_id, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, default_payment_method_id",
        )
        .eq("id", scopeId)
        .maybeSingle()
      if (error) throw error
      return data as PaymentStatusData | null
    },
  })
}
