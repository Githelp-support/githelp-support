"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ConnectRefreshPage() {
  const router = useRouter()
  useEffect(() => {
    // Stripe redirects here when an onboarding link expires. Send the user
    // back to the settings page so they can click "Set up payouts" again,
    // which mints a fresh link.
    router.replace("/settings/payment")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">
        Refreshing your onboarding link…
      </p>
    </div>
  )
}
