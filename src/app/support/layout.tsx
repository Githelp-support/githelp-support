"use client"

import type React from "react"

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 bg-bg-subtle">{children}</main>
    </div>
  )
}
