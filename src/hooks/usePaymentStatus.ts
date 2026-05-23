import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { ConnectStatusFields } from "@/lib/payment-status"

export type PaymentStatusScope = "organization" | "user"

interface UsePaymentStatusArgs {
  scope: PaymentStatusScope
  /** organization id or user id depending on scope. Empty disables the query. */
  scopeId: string
}

/**
 * Read Connect status fields for an organization or a user. Returns null when
 * no row exists yet (i.e. before payments-create-account has run).
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
    queryFn: async (): Promise<ConnectStatusFields | null> => {
      const { data, error } = await supabase
        .from(table)
        .select(
          "stripe_account_id, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled",
        )
        .eq("id", scopeId)
        .maybeSingle()
      if (error) throw error
      return data as ConnectStatusFields | null
    },
  })
}
