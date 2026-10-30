"use client"

import type React from "react"
import { SupportSandboxBanner } from "@/components/layout/support-sandbox-banner"
import { SupportGuestPresence } from "@/components/support/support-guest-presence"
import { GuestLinkBanner } from "@/components/support/guest-link-banner"
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
      {/* Keeps a guest's open ticket alive on every /support page. */}
      <SupportGuestPresence />
      {/* "Link your guest conversation" for a signed-in user with a pending key. */}
      <GuestLinkBanner />
      <SupportSandboxBanner slug={slugParam ?? null} projectId={projectIdParam ?? null} />
      <main className="flex-1 min-h-0 bg-bg-subtle flex flex-col">{children}</main>
    </div>
  )
}
