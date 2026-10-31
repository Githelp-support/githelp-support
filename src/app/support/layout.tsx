"use client"

import type React from "react"
import { SupportSandboxBanner } from "@/components/layout/support-sandbox-banner"
import { SupportGuestPresence } from "@/components/support/support-guest-presence"
import { GuestLinkBanner } from "@/components/support/guest-link-banner"
import { useParams, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { MobileNavToggle } from "@/components/layout/mobile-nav"
import { Logo } from "@/components/brand/logo"

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ slug?: string }>()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("project")
  const slugParam = params?.slug || searchParams.get("slug")
  const { user } = useUser()
  // Signed-out visitors and anonymous guests get no TopBar, so below lg this
  // strip carries the menu button that opens the support sidebar sheet.
  const signedOut = !user?.id

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {signedOut && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-sidebar px-4 py-2 lg:hidden">
          <MobileNavToggle className="-ml-1" />
          <Logo />
          <span className="truncate text-ui font-medium text-foreground">Support</span>
        </div>
      )}
      {/* Keeps a guest's open ticket alive on every /support page. */}
      <SupportGuestPresence />
      {/* "Link your guest conversation" for a signed-in user with a pending key. */}
      <GuestLinkBanner />
      <SupportSandboxBanner slug={slugParam ?? null} projectId={projectIdParam ?? null} />
      {/* `touch-targets`: buyer pages get ≥40px controls below md (see globals.css). */}
      <main className="flex-1 min-h-0 bg-bg-subtle flex flex-col touch-targets">{children}</main>
    </div>
  )
}
