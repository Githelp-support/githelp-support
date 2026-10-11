import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type HoldAfterSetupStatus =
  | "authorized"
  | "requires_action"
  | "declined"
  | "already_held"
  /** A card saved later already has a hold in progress. */
  | "superseded"
  | "not_needed"
  /** The card isn't confirmed yet; the webhook places the hold and the chat updates via realtime. */
  | "pending"

export interface HoldAfterSetupResult {
  status: HoldAfterSetupStatus
  holdAmountSmallestUnit?: number
  /** Set when the bank wants 3-D Secure (`requires_action`). */
  clientSecret?: string
  /** The bank's reason, when `declined`. */
  declineMessage?: string
}

/**
 * Back from the ticket's card-setup Checkout (`?card=added&session_id=…`):
 * saves the card and places the ticket's hold on it straight away. The
 * "Add payment method" Checkout only saves the card, so Stripe's page never
 * reads like a charge; the hold follows here.
 */
export function useHoldTicketAfterSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { ticketId: string; sessionId: string }): Promise<HoldAfterSetupResult> => {
      const resp = await supabase.functions.invoke("payments-hold-ticket-after-setup", {
        body: { ticket_id: args.ticketId, session_id: args.sessionId },
      })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to place the hold")
      }
      const data = (resp.data ?? {}) as Record<string, unknown>
      return {
        status: data.status as HoldAfterSetupStatus,
        holdAmountSmallestUnit: data.hold_amount_smallest_unit as number | undefined,
        clientSecret: data.client_secret as string | undefined,
        declineMessage: data.decline_message as string | undefined,
      }
    },
    onSuccess: (_result, args) => {
      queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", args.ticketId] })
    },
  })
}
