"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
      <div className="text-center max-w-md px-4">
        <h1 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="bg-brand-primary hover:bg-brand-primary/90">
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
