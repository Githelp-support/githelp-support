import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type AuthorizeTicketStatus =
  | "authorized"
  | "requires_action"
  | "requires_checkout"
  | "sla_covered"
  | "failed"
  | "pending"

interface AuthorizeArgs {
  ticketId: string
  payerType: "user" | "organization"
  organizationId?: string
}

export type AuthorizeTicketResult =
  | {
      status: "requires_checkout"
      ticketId?: string
      checkoutUrl: string
      holdAmountSmallestUnit?: number
    }
  | {
      status: "sla_covered"
      ticketId?: string
      slaId?: string
      message?: string
    }
  | {
      status: Exclude<AuthorizeTicketStatus, "requires_checkout" | "sla_covered">
      paymentId?: string
      stripePaymentIntentId?: string
      holdAmountSmallestUnit?: number
      holdExpiresAt?: string
    }

/**
 * Invoke the backend `payments-authorize-ticket` edge function after a ticket
 * is created. Returns a discriminated union: the caller decides whether to
 * redirect (requires_checkout), no-op (sla_covered / authorized), or surface
 * an error (requires_action / failed).
 */
export function useAuthorizeTicket() {
  return useMutation({
    mutationFn: async (args: AuthorizeArgs): Promise<AuthorizeTicketResult> => {
      const body: Record<string, unknown> = {
        ticket_id: args.ticketId,
        payer_type: args.payerType,
      }
      if (args.payerType === "organization") {
        if (!args.organizationId) {
          throw new Error("organizationId is required for payer_type=organization")
        }
        body.organization_id = args.organizationId
      }
      const resp = await supabase.functions.invoke("payments-authorize-ticket", { body })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to authorize ticket")
      }
      const data = (resp.data ?? {}) as Record<string, unknown>
      const status = data.status as AuthorizeTicketStatus
      if (status === "requires_checkout") {
        return {
          status,
          ticketId: data.ticket_id as string | undefined,
          checkoutUrl: data.checkout_url as string,
          holdAmountSmallestUnit: data.hold_amount_smallest_unit as number | undefined,
        }
      }
      if (status === "sla_covered") {
        return {
          status,
          ticketId: data.ticket_id as string | undefined,
          slaId: data.sla_id as string | undefined,
          message: data.message as string | undefined,
        }
      }
      return {
        status,
        paymentId: data.payment_id as string | undefined,
        stripePaymentIntentId: data.stripe_payment_intent_id as string | undefined,
        holdAmountSmallestUnit: data.hold_amount_smallest_unit as number | undefined,
        holdExpiresAt: data.hold_expires_at as string | undefined,
      }
    },
  })
}
