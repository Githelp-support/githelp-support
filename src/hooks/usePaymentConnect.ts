import { useMutation } from "@tanstack/react-query"
import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"

interface StartArgs {
  organizationId: string
  /** Drives Stripe mode server-side: sandbox project → test, otherwise live. */
  projectId: string
}

/**
 * Edge functions return their real error as a JSON body, but supabase-js
 * surfaces non-2xx responses as a FunctionsHttpError with a generic message.
 * Pull the body message out so callers see the actual cause.
 */
async function toInvokeError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body && typeof body.error === "string") return new Error(body.error)
  }
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message
  return new Error(message || fallback)
}

/**
 * Org-side Connect onboarding: invokes payments-create-account (idempotent)
 * then payments-link-account, returning the Stripe-hosted onboarding URL the
 * caller should redirect to.
 */
export function useStartPaymentConnect() {
  return useMutation({
    mutationFn: async ({ organizationId, projectId }: StartArgs) => {
      const body = {
        scope: "organization",
        organization_id: organizationId,
        project_id: projectId,
      }
      const created = await supabase.functions.invoke("payments-create-account", { body })
      if (created.error) {
        throw await toInvokeError(created.error, "Failed to create Connect account")
      }
      const linked = await supabase.functions.invoke("payments-link-account", { body })
      if (linked.error) {
        throw await toInvokeError(linked.error, "Failed to create onboarding link")
      }
      const url = (linked.data as { url?: string } | null)?.url
      if (!url) throw new Error("No onboarding URL returned")
      return { url }
    },
  })
}

/**
 * Helper-side Connect onboarding: invokes payments-create-account (scope=user)
 * then payments-link-account, returning the Stripe-hosted onboarding URL the
 * caller should redirect to. No organizationId — the authenticated user is
 * the scope.
 */
export function useStartHelperPaymentConnect() {
  return useMutation({
    mutationFn: async () => {
      const created = await supabase.functions.invoke("payments-create-account", {
        body: { scope: "user" },
      })
      if (created.error) {
        throw new Error(created.error.message || "Failed to create Connect account")
      }
      const linked = await supabase.functions.invoke("payments-link-account", {
        body: { scope: "user" },
      })
      if (linked.error) {
        throw new Error(linked.error.message || "Failed to create onboarding link")
      }
      const url = (linked.data as { url?: string } | null)?.url
      if (!url) throw new Error("No onboarding URL returned")
      return { url }
    },
  })
}
