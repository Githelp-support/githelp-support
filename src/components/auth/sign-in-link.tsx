"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { isSupportRoute, signInHref } from "@/lib/sign-in-href"
import { useSupportSignInRedirect } from "@/lib/support-sign-in-redirect"
import { saveRegisteredSupportDraft } from "@/lib/support-draft"

type SignInLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  /** Path (+ query) to return to after signing in. */
  redirectTo: string
  children: ReactNode
}

/**
 * "Sign in" link that behaves like the other sign-in entry points: from a
 * support route it adds `skipOnboarding=true`, and a guest (anonymous
 * session) first saves the guest session so their tickets are adopted after
 * sign-in (see lib/guest-adoption).
 */
export function SignInLink({ redirectTo, children, onClick, ...rest }: SignInLinkProps) {
  const pathname = usePathname()
  const { user } = useUser()
  // On a support chat page: return to the conversation (?ticket=…), the same
  // target as the guest banner, instead of the page's welcome screen.
  const published = useSupportSignInRedirect()
  const onSupport = isSupportRoute(pathname)
  const href = signInHref(onSupport && published ? published : redirectTo, { support: onSupport })

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Keep an unsent support message across the sign-in round-trip.
    if (onSupport) saveRegisteredSupportDraft()
    // Off support routes only a known guest needs saving; on support routes
    // always check the session itself (user.guestId can lag right after the
    // first send). prepareGuestAdoption is a no-op unless it's our own guest.
    if (!onSupport && !user?.guestId) return
    // Loaded lazily: it pulls in the Supabase client.
    const prepare = import("@/lib/guest-adoption").then(({ prepareGuestAdoption }) => prepareGuestAdoption())
    // Ctrl/Cmd/Shift/middle-click: let the browser open its new tab or
    // window; the guest session is still saved (best effort) for adoption.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      void prepare.catch(() => {})
      return
    }
    e.preventDefault()
    void prepare.finally(() => window.location.assign(href))
  }

  return (
    <Link {...rest} href={href} onClick={handleClick}>
      {children}
    </Link>
  )
}
