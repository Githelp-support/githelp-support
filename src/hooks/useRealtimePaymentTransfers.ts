import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

/**
 * Keep `usePaymentTransfers` fresh for a project: payout rows are written by
 * the capture edge function when a ticket closes and flipped to `completed`
 * by the Stripe webhook later, neither of which the browser initiates. The
 * query has a 30-minute staleTime, so without this the reports pages would
 * show closed tickets only after a reload.
 */
export function useRealtimePaymentTransfers(projectId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`payments_transfers:project=${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments_transfers",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["payment-transfers"] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])
}
