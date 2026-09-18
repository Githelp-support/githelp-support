import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type TicketPaymentStatus =
  | "sla_covered"
  | "free"
  | "authorized"
  | "requires_action"
  | "pending"
  | "failed"
  | "distributing"
  | "completed"
  | "cancelled"
  | "none"

export interface TicketPaymentResult {
  status: TicketPaymentStatus
  isReady: boolean
  /**
   * Total actually captured from the payer across every payments row for the
   * ticket (hold capture + any overage charge beyond the hold), in the
   * smallest currency unit. Null until something has been captured.
   */
  capturedAmountSmallestUnit: number | null
  /**
   * Stripe's human-readable reason for the most recent payment row when it is
   * `failed` (declined, expired authorization, …). Null otherwise.
   */
  failureReason: string | null
}

interface PaymentRow {
  status: TicketPaymentStatus
  captured_amount_smallest_unit: number | null
  failure_reason?: string | null
}

interface Opts {
  /** When non-null, the ticket is SLA-covered and the gate auto-opens. */
  slaId?: string | null
  /**
   * True when the project offers free support (all three ticket prices are
   * zero — see `isFreeSupport`). Free tickets never get a payments row, so the
   * gate opens without one. An existing payments row still takes precedence
   * (e.g. a hold placed before the project switched to free).
   */
  isFree?: boolean
}

/**
 * Read the payments rows for a ticket (status from the most recent one,
 * captured amount summed across all captured rows) and subscribe to realtime
 * inserts/updates so the helper UI auto-unlocks when the customer
 * completes Stripe Checkout. SLA-covered tickets short-circuit to
 * isReady=true; the existing minutes-based metering takes over from
 * payments-complete-sla-ticket. Free-support tickets (opts.isFree) are ready
 * as long as no payments row exists.
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
        .select("status, captured_amount_smallest_unit, failure_reason")
        .eq("ticket_id", ticketId as string)
        .order("created_at", { ascending: false })
      if (resp.error) throw resp.error
      return ((resp.data as PaymentRow[] | null) ?? [])
    },
    staleTime: 30_000,
    // Realtime is the primary signal, but poll while the payment is still in
    // flight (no row yet / pending / requires_action / authorized-awaiting-
    // capture) so the UI converges even if a realtime event is missed.
    refetchInterval: (query) => {
      const rows = query.state.data
      const latest = rows?.[0]
      // Free support: no payments row is ever expected, so don't poll for one.
      if (!latest) return opts.isFree ? false : 5_000
      return latest.status === "completed" || latest.status === "failed" || latest.status === "cancelled"
        ? false
        : 5_000
    },
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

  if (opts.slaId) {
    return { status: "sla_covered", isReady: true, capturedAmountSmallestUnit: null, failureReason: null }
  }
  const latest = data?.[0]
  if (!latest) {
    // `data === undefined` means the rows haven't loaded yet: stay closed until
    // we know there is no payments row, so an existing row always wins.
    return opts.isFree && data !== undefined
      ? { status: "free", isReady: true, capturedAmountSmallestUnit: null, failureReason: null }
      : { status: "none", isReady: false, capturedAmountSmallestUnit: null, failureReason: null }
  }
  const capturedRows = (data ?? []).filter(
    (r) => (r.status === "distributing" || r.status === "completed") && r.captured_amount_smallest_unit != null,
  )
  const capturedTotal = capturedRows.length
    ? capturedRows.reduce((sum, r) => sum + (r.captured_amount_smallest_unit ?? 0), 0)
    : null
  return {
    status: latest.status,
    isReady: latest.status === "authorized",
    capturedAmountSmallestUnit: capturedTotal,
    failureReason: latest.status === "failed" ? latest.failure_reason?.trim() || null : null,
  }
}
