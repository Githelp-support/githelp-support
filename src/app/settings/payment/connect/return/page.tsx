"use client"

import Link from "next/link"

export default function ConnectReturnPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Account setup complete</h1>
        <p className="text-sm text-muted-foreground">
          Stripe is finalising your account. Status updates appear here once
          Stripe confirms everything is in order — usually within a few
          seconds.
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
