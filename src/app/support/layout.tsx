"use client"

import type React from "react"
import { SupportSandboxBanner } from "@/components/layout/support-sandbox-banner"
import { useParams, useSearchParams } from "next/navigation"

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ slug?: string }>()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("project")
  const slugParam = params?.slug || searchParams.get("slug")

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SupportSandboxBanner slug={slugParam ?? null} projectId={projectIdParam ?? null} />
      <main className="flex-1 min-h-0 bg-bg-subtle flex flex-col">{children}</main>
    </div>
  )
}
