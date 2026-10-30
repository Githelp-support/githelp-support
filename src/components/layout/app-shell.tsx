"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"

/**
 * The app shell renders the Sidebar and the page frame once, in the root
 * layout, so navigation never remounts the sidebar. Pages render only their
 * Header and content. Which routes get the shell is decided by pathname (no
 * URL changes, no route groups) — see `isShellRoute`.
 */

// Top-level sections that always live inside the shell (admin, helper, user).
const SHELL_PREFIXES = [
  "/helpers",
  "/tickets",
  "/slas",
  "/reports",
  "/landing-page",
  "/notifications",
  "/help",
  "/settings",
  "/helper",
  "/user",
]

// The signed-in user's support pages. Every other /support route (the public
// entry page with PublicSupportSidebar, /support/[slug], get-support, sla)
// stays outside the shell.
const SHELL_SUPPORT_PATHS = ["/support/about", "/support/chat", "/support/rates", "/support/resources", "/support/tickets"]

// Stripe Connect return/refresh pages render standalone.
const NO_SHELL_PREFIXES = ["/settings/payment/connect"]

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

export function isShellRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === "/") return true
  if (NO_SHELL_PREFIXES.some((p) => matches(pathname, p))) return false
  if (SHELL_SUPPORT_PATHS.some((p) => matches(pathname, p))) return true
  if (pathname.startsWith("/support")) return false
  return SHELL_PREFIXES.some((p) => matches(pathname, p))
}

interface ShellContextValue {
  setProjectPageHref: (href: string | undefined) => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

/**
 * Support pages (about, chat, rates, resources) know the project they belong
 * to; they publish the "Open project page" link for the sidebar through this
 * hook. The link clears again when the page unmounts.
 */
export function useSetProjectPageHref(href: string | undefined) {
  const ctx = useContext(ShellContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setProjectPageHref(href)
    return () => ctx.setProjectPageHref(undefined)
  }, [ctx, href])
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [projectPageHref, setProjectPageHref] = useState<string | undefined>(undefined)
  const ctx = useMemo<ShellContextValue>(() => ({ setProjectPageHref }), [])

  if (!isShellRoute(pathname)) {
    return <ShellContext.Provider value={ctx}>{children}</ShellContext.Provider>
  }

  return (
    <ShellContext.Provider value={ctx}>
      {/* `min-h-0` lets the row shrink inside the h-screen column so the page scrolls, not the window. */}
      <div className="flex flex-1 min-h-0 overflow-hidden print:block print:h-auto print:overflow-visible">
        <Sidebar projectPageHref={projectPageHref} className="print:hidden" />
        {/* The content column. Pages render a sticky Header plus a scrolling <main> inside it. */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">{children}</div>
      </div>
    </ShellContext.Provider>
  )
}
