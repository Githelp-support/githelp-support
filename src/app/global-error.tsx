"use client"

import { useEffect } from "react"
import "./globals.css"

// Replaces the root layout when it throws, so it brings its own <html>/<body>
// and imports globals.css itself to get the tokens.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global application error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="m-0 flex min-h-screen items-center justify-center bg-page-muted p-6 font-sans text-foreground">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-xl font-semibold text-text-heading">Something went wrong</h1>
          <p className="mb-6 text-text-muted">
            A critical error occurred. Please refresh the page or try again later.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="h-8 cursor-pointer rounded-md bg-brand-primary px-4 text-sm font-medium text-brand-foreground hover:bg-brand-primary-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
