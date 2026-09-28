"use client"

import { Suspense, useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSyncPaymentConnect } from "@/hooks/usePaymentConnect"
import { connectStatusLabel } from "@/lib/payment-status"

/**
 * Stripe sends the user here after hosted Connect onboarding. The link's
 * return_url carries `scope`, `organization_id` (org scope) and `project_id`
 * (mode) as query params — we use them to reconcile the account status
 * straight from Stripe instead of waiting on the `account.updated` webhook.
 */
function ConnectReturnContent() {
  const params = useSearchParams()
  const scopeParam = params.get("scope")
  const scope: "organization" | "user" = scopeParam === "organization" ? "organization" : "user"
  const organizationId = params.get("organization_id") ?? undefined
  const projectId = params.get("project_id") ?? undefined
  const backHref = scope === "organization" ? "/settings/payment" : "/helper/settings/payout"

  const sync = useSyncPaymentConnect()
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    sync.mutate({ scope, organizationId, projectId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel = sync.data ? connectStatusLabel(sync.data).label : null

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Account setup complete</h1>
        {sync.isPending && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your account status with Stripe…
          </p>
        )}
        {sync.isSuccess && (
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{statusLabel}</span>
            {statusLabel === "Pending verification" && (
              <>
                {" "}
                — Stripe still needs some information. Click &quot;Set up payouts&quot; again
                to finish.
              </>
            )}
            {statusLabel === "Restricted" && (
              <>
                {" "}
                — Stripe is reviewing your details. This usually resolves within a few minutes.
              </>
            )}
          </p>
        )}
        {sync.isError && (
          <p className="text-sm text-muted-foreground">
            Stripe is finalising your account. Status updates appear on the payment
            settings page once Stripe confirms everything is in order.
          </p>
        )}
        <Link
          href={backHref}
          className="inline-block rounded-md bg-[#554abf] px-4 py-2 text-sm font-medium text-white"
        >
          Back to payment settings
        </Link>
      </div>
    </div>
  )
}

export default function ConnectReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ConnectReturnContent />
    </Suspense>
  )
}
