"use client"

import { useEffect } from "react"

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
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f9ff" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f0f11", marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#55555d", marginBottom: 24 }}>
            A critical error occurred. Please refresh the page or try again later.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "#3c2ec5",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
