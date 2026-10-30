import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type TicketPaymentStatus =
  | "sla_covered"
  | "free"
  | "authorized"
  | "requires_action"
  | "pending"
  | "processing"
  | "failed"
  | "distributing"
  | "completed"
  | "cancelled"
  /**
   * Closed (completed) ticket whose only outcome was holds released because
   * the amount left was below the card minimum (`below_minimum_waived`):
   * nothing was charged.
   */
  | "waived"
  /**
   * Cancelled ("not able to help") ticket on which money had already been
   * captured (a weekly segment, or a capture that raced the cancel). The rows
   * are flagged for a refund; `capturedAmountSmallestUnit` is what was taken.
   */
  | "refund_pending"
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
   * Stripe's human-readable reason for the failed attempt when `status` is
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
  /** Set on hold rows; null on remainder (overage/retry) charges. */
  hold_expires_at?: string | null
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
  /**
   * The ticket's own status (`tickets.status`). Once the ticket is closed
   * (`completed` / `cancelled`) the status is aggregated over every payments
   * row instead of read off the newest one (see `derivePaymentStatus`).
   */
  ticketStatus?: string | null
  /**
   * True for a flat-fee ticket (pricing snapshot with both per-minute prices
   * 0 — see `isFlatFeePricing`). Mirrors the DB gate: once the start price was
   * collected (a processing/distributing/completed row) logging stays open
   * without an authorized hold.
   */
  isFlatFee?: boolean
}

const CAPTURED_STATUSES = new Set<TicketPaymentStatus>(["distributing", "completed"])
const COLLECTED_STATUSES = new Set<TicketPaymentStatus>(["processing", "distributing", "completed"])
const WAIVED_PREFIX = "below_minimum_waived"
const CARD_DECLINED_PREFIX = /^card_declined:/i

const isCaptured = (r: PaymentRow) => CAPTURED_STATUSES.has(r.status) && r.captured_amount_smallest_unit != null
const isWaived = (r: PaymentRow) => r.status === "cancelled" && !!r.failure_reason?.startsWith(WAIVED_PREFIX)

/**
 * A `failed` row that leaves money owed: a declined remainder charge (no hold
 * window), or a declined capture of a hold that had been authorized (the
 * backend's `card_declined:` marker — see `showsAuthorizedHold` in
 * backend `_shared/payments/capture-ticket.ts`). A weekly renewal hold the
 * bank refused reserved nothing, so on a closed ticket it does not mean the
 * ticket is unpaid (the helper could not log time past it; uncovered time is
 * charged as a new remainder row). A row without `hold_expires_at` in the
 * result counts as owed, the conservative reading.
 */
function isOwedFailure(r: PaymentRow): boolean {
  if (r.status !== "failed") return false
  if (r.hold_expires_at == null) return true
  return CARD_DECLINED_PREFIX.test(r.failure_reason ?? "")
}

const displayReason = (r: PaymentRow | undefined) =>
  r?.status === "failed" ? r.failure_reason?.replace(CARD_DECLINED_PREFIX, "").trim() || null : null

export interface DerivedPaymentStatus {
  status: TicketPaymentStatus
  failureReason: string | null
}

/**
 * Display status for a ticket's payments rows (newest first).
 *
 * Open ticket (or ticket status unknown): the newest row's status, as before.
 *
 * Completed ticket, over all rows:
 *  - the newest non-cancelled row is a failed attempt that leaves money owed
 *    (`isOwedFailure`) and no later row waived the rest → `failed`;
 *  - the newest non-cancelled row is still in flight (authorized hold not yet
 *    captured, pending/requires_action, processing charge) → that status;
 *  - anything captured → `distributing` while any captured row is, else
 *    `completed` (callers show the captured total — "paid");
 *  - only holds released below the card minimum → `waived`;
 *  - otherwise the newest non-cancelled (else newest) row's status.
 *
 * Cancelled ticket: anything captured → `refund_pending`; otherwise the
 * newest row's status (callers show "No charge").
 */
export function derivePaymentStatus(
  rows: PaymentRow[],
  ticketStatus?: string | null,
): DerivedPaymentStatus {
  const latest = rows[0]
  if (!latest) return { status: "none", failureReason: null }
  const fromLatest = { status: latest.status, failureReason: displayReason(latest) }
  const captured = rows.some(isCaptured)

  if (ticketStatus === "cancelled") {
    return captured ? { status: "refund_pending", failureReason: null } : fromLatest
  }
  if (ticketStatus !== "completed") return fromLatest

  const newestLiveIndex = rows.findIndex((r) => r.status !== "cancelled")
  const newestLive = newestLiveIndex === -1 ? undefined : rows[newestLiveIndex]
  // Rows newer than newestLive are all `cancelled`; one of them waiving the
  // remainder settles the ticket.
  const waivedAfter = rows.slice(0, Math.max(newestLiveIndex, 0)).some(isWaived)
  if (newestLive && isOwedFailure(newestLive) && !waivedAfter) {
    return { status: "failed", failureReason: displayReason(newestLive) }
  }
  if (
    newestLive &&
    (newestLive.status === "authorized" ||
      newestLive.status === "pending" ||
      newestLive.status === "requires_action" ||
      newestLive.status === "processing")
  ) {
    return { status: newestLive.status, failureReason: null }
  }
  if (captured) {
    return {
      status: rows.some((r) => isCaptured(r) && r.status === "distributing") ? "distributing" : "completed",
      failureReason: null,
    }
  }
  if (rows.some(isWaived)) return { status: "waived", failureReason: null }
  return newestLive ? { status: newestLive.status, failureReason: displayReason(newestLive) } : fromLatest
}

/**
 * Read the payments rows for a ticket (status from `derivePaymentStatus`:
 * the newest row while the ticket is open, aggregated over every row once it
 * is closed; captured amount summed across all captured rows) and subscribe to realtime
 * inserts/updates so the helper UI auto-unlocks when the customer
 * completes Stripe Checkout. SLA-covered tickets short-circuit to
 * isReady=true; the existing minutes-based metering takes over from
 * payments-complete-sla-ticket. Free-support tickets (opts.isFree) are ready
 * as long as no payments row exists. Flat-fee tickets (opts.isFlatFee) stay
 * ready once the start price was collected, like the DB gate.
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
          "status, captured_amount_smallest_unit, amount_platform_smallest_unit, amount_project_smallest_unit, amount_helper_smallest_unit, failure_reason, hold_expires_at",
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
      if (latest.status === "requires_action" || latest.status === "pending" || latest.status === "processing") return 5_000
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
  const capturedRows = (data ?? []).filter(isCaptured)
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
  // The gate (time logging) follows the DB trigger, not the display status:
  // an authorized hold, or — flat fee — the start price already collected.
  const isReady =
    latest.status === "authorized" || (!!opts.isFlatFee && (data ?? []).some((r) => COLLECTED_STATUSES.has(r.status)))
  const derived = derivePaymentStatus(data ?? [], opts.ticketStatus)
  return {
    status: derived.status,
    isReady,
    capturedAmountSmallestUnit: capturedTotal,
    capturedSplits,
    // The backend prefixes genuine declines with "card_declined:" (stripped by derivePaymentStatus).
    failureReason: derived.failureReason,
    error,
  }
}
