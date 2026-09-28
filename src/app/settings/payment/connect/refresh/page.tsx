"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function ConnectRefreshContent() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    // Stripe redirects here when an onboarding link expires. Send the user
    // back to the settings page for their scope so they can click "Set up
    // payouts" again, which mints a fresh link.
    const scope = params.get("scope")
    router.replace(scope === "user" ? "/helper/settings/payout" : "/settings/payment")
  }, [router, params])

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">
        Refreshing your onboarding link…
      </p>
    </div>
  )
}

export default function ConnectRefreshPage() {
  return (
    <Suspense fallback={null}>
      <ConnectRefreshContent />
    </Suspense>
  )
}
