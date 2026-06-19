import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { ConnectStatusFields } from "@/lib/payment-status"

export type PaymentStatusScope = "organization" | "user"

interface UsePaymentStatusArgs {
  scope: PaymentStatusScope
  /** organization id or user id depending on scope. Empty disables the query. */
  scopeId: string
  /**
   * When set, a sandbox project routes the read to the test-mode columns so the
   * displayed Connect/card status reflects the same Stripe environment the
   * project transacts in. Omit (or a live project) reads the live columns.
   */
  projectId?: string
}

export type PaymentStatusData = ConnectStatusFields & {
  default_payment_method_id: string | null
  card_brand: string | null
  card_last4: string | null
}

/**
 * Live → test column map. Test-mode reads alias the `stripe_test_*` columns
 * back to the canonical live field names (PostgREST `alias:column`) so
 * `PaymentStatusData` stays mode-agnostic for consumers.
 */
const TEST_COLUMN: Record<string, string> = {
  stripe_account_id: "stripe_test_account_id",
  stripe_details_submitted: "stripe_test_details_submitted",
  stripe_charges_enabled: "stripe_test_charges_enabled",
  stripe_payouts_enabled: "stripe_test_payouts_enabled",
  default_payment_method_id: "stripe_test_default_payment_method_id",
  card_brand: "card_test_brand",
  card_last4: "card_test_last4",
}

/**
 * Read Connect status fields + the default payment method id for an
 * organization or a user. Returns null when no row exists yet. When `projectId`
 * names a sandbox project, the test-mode columns are read instead of live.
 */
export function usePaymentStatus({ scope, scopeId, projectId }: UsePaymentStatusArgs) {
  const table = scope === "organization"
    ? "organizations_payments_config"
    : "users_payments_config"
  // card_brand / card_last4 exist only on users_payments_config for now; the
  // org config table keeps id-only display until org-billed payments land.
  const fields = scope === "organization"
    ? ["stripe_account_id", "stripe_details_submitted", "stripe_charges_enabled", "stripe_payouts_enabled", "default_payment_method_id"]
    : ["stripe_account_id", "stripe_details_submitted", "stripe_charges_enabled", "stripe_payouts_enabled", "default_payment_method_id", "card_brand", "card_last4"]
  return useQuery({
    queryKey: ["payment-status", scope, scopeId, projectId ?? null],
    enabled: !!scopeId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PaymentStatusData | null> => {
      // A sandbox project transacts in Stripe test mode; show its test status.
      let mode: "test" | "live" = "live"
      if (projectId) {
        const { data: proj, error: projError } = await supabase
          .from("projects")
          .select("sandbox")
          .eq("project_id", projectId)
          .maybeSingle()
        if (projError) throw projError
        if ((proj as { sandbox?: boolean } | null)?.sandbox === true) mode = "test"
      }
      const columns = fields
        .map((f) => (mode === "test" ? `${f}:${TEST_COLUMN[f]}` : f))
        .join(", ")
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
