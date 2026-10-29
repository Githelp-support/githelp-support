"use client"

import Link from "next/link"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SignInToStartTicketProps {
  /** Path (+ query) to return to after signing in, e.g. "/support?slug=acme". */
  redirectTo: string
}

/**
 * Replaces the message composer for visitors without a session. Tickets need
 * a signed-in creator (RLS: `created_by = auth.uid()`), so instead of a
 * composer whose insert would silently fail, offer sign-in with a redirect
 * back to this page.
 */
export function SignInToStartTicket({ redirectTo }: SignInToStartTicketProps) {
  // skipOnboarding: a customer coming from a public support page must land back
  // in the chat, not in the project-creation wizard (see /auth/confirmed).
  const href = `/auth/signin?redirect=${encodeURIComponent(redirectTo)}&skipOnboarding=true`
  return (
    <div
      className="bg-white border border-border rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] mx-4 mb-4 p-5 flex flex-wrap items-center justify-between gap-4"
      data-slot="sign-in-to-start-ticket"
    >
      <div>
        <p className="text-sm font-medium text-foreground">Sign in to start a ticket</p>
        <p className="text-sm text-muted-foreground">
          You need an account so the helper can reach you and your support history is kept.
        </p>
      </div>
      <Button asChild variant="lavender" className="cursor-pointer">
        <Link href={href}>
          <LogIn className="w-4 h-4" />
          Sign in to start a ticket
        </Link>
      </Button>
    </div>
  )
}
