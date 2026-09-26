import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export type SetupPaymentMethodScope = "organization" | "user"

interface SetupArgs {
  scope: SetupPaymentMethodScope
  organizationId?: string
  /** Selects the Stripe mode via the project's sandbox flag (test vs live). */
  projectId?: string
  /** Relative app path to return to after Stripe Checkout. */
  returnPath?: string
}

interface SetupResult {
  checkoutUrl: string
}

/**
 * Kick off a Stripe-hosted SetupIntent Checkout for adding / replacing the
 * default card on file. Returns the checkout URL the caller should redirect
 * to. Stripe appends `session_id` to the success URL; hand it to
 * `useSyncPaymentMethod` on return to persist the card immediately. The
 * `setup_intent.succeeded` webhook also persists it, as the fallback.
 */
export function useSetupPaymentMethod() {
  return useMutation({
    mutationFn: async ({ scope, organizationId, projectId, returnPath }: SetupArgs): Promise<SetupResult> => {
      const body: Record<string, unknown> = { scope }
      if (scope === "organization") {
        if (!organizationId) {
          throw new Error("organizationId is required for scope=organization")
        }
        body.organization_id = organizationId
      }
      if (projectId) body.project_id = projectId
      if (returnPath) body.return_path = returnPath
      const resp = await supabase.functions.invoke("payments-setup-method", { body })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to start card setup")
      }
      const checkoutUrl = (resp.data as { checkout_url?: string } | null)?.checkout_url
      if (!checkoutUrl) throw new Error("No checkout URL returned")
      return { checkoutUrl }
    },
  })
}

export interface SyncPaymentMethodArgs {
  scope: SetupPaymentMethodScope
  organizationId?: string
  /** Must match the projectId the setup was started with (same Stripe mode). */
  projectId?: string
  /** The `session_id` Stripe put on the success URL. */
  sessionId: string
}

export type SyncPaymentMethodResult =
  | {
      synced: true
      defaultPaymentMethodId: string
      cardBrand: string | null
      cardLast4: string | null
    }
  | {
      /** The SetupIntent has not succeeded (yet); nothing was written. */
      synced: false
      setupIntentStatus: string | null
    }

interface SyncResponse {
  synced?: boolean
  default_payment_method_id?: string | null
  card_brand?: string | null
  card_last4?: string | null
  setup_intent_status?: string | null
}

/**
 * Persist the card from a completed setup Checkout session straight away
 * (invokes payments-sync-setup-method) instead of waiting on the
 * `setup_intent.succeeded` webhook, which can land after the user is already
 * back on the page. On a successful sync the payment-status queries are
 * refetched before the mutation resolves, so the new card is on screen by the
 * time `mutateAsync` returns.
 */
export function useSyncPaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scope, organizationId, projectId, sessionId }: SyncPaymentMethodArgs): Promise<SyncPaymentMethodResult> => {
      const body: Record<string, unknown> = { scope, session_id: sessionId }
      if (scope === "organization") {
        if (!organizationId) {
          throw new Error("organizationId is required for scope=organization")
        }
        body.organization_id = organizationId
      }
      if (projectId) body.project_id = projectId
      const resp = await supabase.functions.invoke("payments-sync-setup-method", { body })
      if (resp.error) {
        throw new Error(resp.error.message || "Failed to sync card")
      }
      const data = resp.data as SyncResponse | null
      if (!data || typeof data.synced !== "boolean") {
        throw new Error("Unexpected response from card sync")
      }
      if (!data.synced) {
        return { synced: false, setupIntentStatus: data.setup_intent_status ?? null }
      }
      if (!data.default_payment_method_id) {
        throw new Error("Card sync returned no payment method")
      }
      return {
        synced: true,
        defaultPaymentMethodId: data.default_payment_method_id,
        cardBrand: data.card_brand ?? null,
        cardLast4: data.card_last4 ?? null,
      }
    },
    onSuccess: async (result) => {
      if (result.synced) {
        await queryClient.invalidateQueries({ queryKey: ["payment-status"] })
      }
    },
  })
}
