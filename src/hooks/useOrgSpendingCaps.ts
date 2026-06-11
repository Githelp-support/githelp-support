import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface OrgSpendingCaps {
  monthly_spend_cap_smallest_unit: number | null
  default_user_monthly_cap_smallest_unit: number | null
}

/**
 * Read the org's two monthly spending caps. Null means "no cap" / unlimited.
 */
export function useOrgSpendingCaps(orgId: string) {
  return useQuery({
    queryKey: ["org-spending-caps", orgId],
    enabled: !!orgId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OrgSpendingCaps | null> => {
      const { data, error } = await supabase
        .from("organizations_payments_config")
        .select(
          "monthly_spend_cap_smallest_unit, default_user_monthly_cap_smallest_unit",
        )
        .eq("id", orgId)
        .maybeSingle()
      if (error) throw error
      return data as OrgSpendingCaps | null
    },
  })
}

export interface UpdateOrgSpendingCapsArgs {
  organizationId: string
  monthlySpendCapSmallestUnit: number | null
  defaultUserMonthlyCapSmallestUnit: number | null
}

/**
 * Update both cap fields on `organizations_payments_config`. Null clears
 * the cap.
 */
export function useUpdateOrgSpendingCaps() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: UpdateOrgSpendingCapsArgs) => {
      const { error } = await supabase
        .from("organizations_payments_config")
        .update({
          monthly_spend_cap_smallest_unit: args.monthlySpendCapSmallestUnit,
          default_user_monthly_cap_smallest_unit: args.defaultUserMonthlyCapSmallestUnit,
        })
        .eq("id", args.organizationId)
      if (error) throw new Error(error.message || "Failed to update spending caps")
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ["org-spending-caps", args.organizationId] })
    },
  })
}
