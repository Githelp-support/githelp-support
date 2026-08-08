"use client"

import Link from "next/link"

export default function ConnectReturnPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Account setup aborted</h1>
        <p className="text-sm text-muted-foreground">
          Stripe wasn’t able to finalise your account. Go back to Stripe to
          complete the setup in order to be able to accept payments.
        </p>
        <Link
          href="/settings/payment"
          className="inline-block rounded-md bg-[#554abf] px-4 py-2 text-sm font-medium text-white"
        >
          Back to payment settings
        </Link>
      </div>
    </div>
  )
}
