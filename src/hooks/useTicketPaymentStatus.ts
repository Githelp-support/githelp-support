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
   * How the captured total was split, summed across the captured rows. Null
   * until something has been captured.
   */
  capturedSplits: CapturedSplits | null
  /**
   * Stripe's human-readable reason for the most recent payment row when it is
   * `failed` (declined, expired authorization, …). Null otherwise.
   */
  failureReason: string | null
  /**
   * Message of the last failed `payments` read, or null. While set, `status`
   * reflects the last successful read (or "none"), so callers should show the
   * error rather than a silent "waiting for payment".
   */
  error: string | null
}

const EMPTY: Omit<TicketPaymentResult, "status" | "isReady"> = {
  capturedAmountSmallestUnit: null,
  capturedSplits: null,
  failureReason: null,
  error: null,
}

const TERMINAL_STATUSES = new Set<TicketPaymentStatus>(["completed", "failed", "cancelled"])

export interface CapturedSplits {
  helperSmallestUnit: number
  projectSmallestUnit: number
  /**
   * The platform slice of each captured row. The platform fee is 0%, so this
   * is exactly Stripe's processing fee for the charges (see `computeSplits`).
   */
  stripeFeeSmallestUnit: number
}

interface PaymentRow {
  status: TicketPaymentStatus
  captured_amount_smallest_unit: number | null
  amount_platform_smallest_unit?: number | null
  amount_project_smallest_unit?: number | null
  amount_helper_smallest_unit?: number | null
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

  const { data, error: queryError } = useQuery({
    queryKey: ["ticket-payment-status", ticketId],
    enabled,
    queryFn: async () => {
      const resp = await supabase
        .from("payments")
        .select(
          "status, captured_amount_smallest_unit, amount_platform_smallest_unit, amount_project_smallest_unit, amount_helper_smallest_unit, failure_reason",
        )
        .eq("ticket_id", ticketId as string)
        .order("created_at", { ascending: false })
      if (resp.error) throw resp.error
      return ((resp.data as PaymentRow[] | null) ?? [])
    },
    staleTime: 30_000,
    // Realtime is the primary signal; polling is only a safety net while the
    // payment is still in flight. No row yet / pending / requires_action poll
    // every 5 s (the customer is in Checkout or 3-D Secure right now); an
    // authorized hold only changes at capture, so 30 s is plenty; terminal
    // rows stop polling altogether.
    refetchInterval: (query) => {
      const rows = query.state.data
      const latest = rows?.[0]
      // Free support: no payments row is ever expected, so don't poll for one.
      if (!latest) return opts.isFree ? false : 5_000
      if (TERMINAL_STATUSES.has(latest.status)) return false
      if (latest.status === "requires_action" || latest.status === "pending") return 5_000
      return 30_000
    },
  })
  const error = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null

  useEffect(() => {
    if (!ticketId || opts.slaId) return
    // Unique topic per mount: a fixed topic would make two mounted views
    // (or a fast remount) share one channel and its handlers.
    const topic = `payments:ticket=${ticketId}:${Math.random().toString(36).slice(2, 10)}`
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `ticket_id=eq.${ticketId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", ticketId] })
        },
      )
      .subscribe((status) => {
        // Re-join after a drop: catch up on anything missed meanwhile.
        if (status === "SUBSCRIBED") {
          queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", ticketId] })
        }
      })
    return () => {
      // removeChannel (not unsubscribe) also drops the channel from the
      // client, so remounts don't accumulate bindings.
      void supabase.removeChannel(channel)
    }
  }, [ticketId, opts.slaId, queryClient])

  if (opts.slaId) {
    return { ...EMPTY, status: "sla_covered", isReady: true }
  }
  const latest = data?.[0]
  if (!latest) {
    // `data === undefined` means the rows haven't loaded yet: stay closed until
    // we know there is no payments row, so an existing row always wins.
    return opts.isFree && data !== undefined
      ? { ...EMPTY, status: "free", isReady: true, error }
      : { ...EMPTY, status: "none", isReady: false, error }
  }
  const capturedRows = (data ?? []).filter(
    (r) => (r.status === "distributing" || r.status === "completed") && r.captured_amount_smallest_unit != null,
  )
  const capturedTotal = capturedRows.length
    ? capturedRows.reduce((sum, r) => sum + (r.captured_amount_smallest_unit ?? 0), 0)
    : null
  const sum = (pick: (r: PaymentRow) => number | null | undefined) =>
    capturedRows.reduce((acc, r) => acc + (pick(r) ?? 0), 0)
  const capturedSplits = capturedRows.length
    ? {
        helperSmallestUnit: sum((r) => r.amount_helper_smallest_unit),
        projectSmallestUnit: sum((r) => r.amount_project_smallest_unit),
        stripeFeeSmallestUnit: sum((r) => r.amount_platform_smallest_unit),
      }
    : null
  return {
    status: latest.status,
    isReady: latest.status === "authorized",
    capturedAmountSmallestUnit: capturedTotal,
    capturedSplits,
    failureReason: latest.status === "failed" ? latest.failure_reason?.trim() || null : null,
    error,
  }
}
