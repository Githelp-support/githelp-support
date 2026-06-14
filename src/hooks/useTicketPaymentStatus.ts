import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type TicketPaymentStatus =
  | "sla_covered"
  | "authorized"
  | "requires_action"
  | "pending"
  | "failed"
  | "distributing"
  | "completed"
  | "none"

export interface TicketPaymentResult {
  status: TicketPaymentStatus
  isReady: boolean
  /** Amount actually captured from the payer, in the smallest currency unit. Null until capture. */
  capturedAmountSmallestUnit: number | null
}

interface PaymentRow {
  status: TicketPaymentStatus
  captured_amount_smallest_unit: number | null
}

interface Opts {
  /** When non-null, the ticket is SLA-covered and the gate auto-opens. */
  slaId?: string | null
}

/**
 * Read the latest payments row for a ticket and subscribe to realtime
 * inserts/updates so the helper UI auto-unlocks when the customer
 * completes Stripe Checkout. SLA-covered tickets short-circuit to
 * isReady=true; the existing minutes-based metering takes over from
 * payments-complete-sla-ticket.
 */
export function useTicketPaymentStatus(
  ticketId: string | null | undefined,
  opts: Opts = {},
): TicketPaymentResult {
  const queryClient = useQueryClient()
  const enabled = !!ticketId && !opts.slaId

  const { data } = useQuery({
    queryKey: ["ticket-payment-status", ticketId],
    enabled,
    queryFn: async () => {
      const resp = await supabase
        .from("payments")
        .select("status, captured_amount_smallest_unit")
        .eq("ticket_id", ticketId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (resp.error) throw resp.error
      return (resp.data as PaymentRow | null) ?? null
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!ticketId || opts.slaId) return
    const channel = supabase
      .channel(`payments:ticket=${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `ticket_id=eq.${ticketId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", ticketId] })
        },
      )
      .subscribe()
    return () => {
      channel.unsubscribe()
    }
  }, [ticketId, opts.slaId, queryClient])

  if (opts.slaId) return { status: "sla_covered", isReady: true, capturedAmountSmallestUnit: null }
  if (!data) return { status: "none", isReady: false, capturedAmountSmallestUnit: null }
  return {
    status: data.status,
    isReady: data.status === "authorized",
    capturedAmountSmallestUnit: data.captured_amount_smallest_unit ?? null,
  }
}
