"use client"

import { usePathname } from "next/navigation"
import { AuthGuard } from "@/components/auth/auth-guard"

interface ProtectedLayoutProps {
  children: React.ReactNode
}

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/",
  "/helpers",
  "/tickets",
  "/slas",
  "/reports",
  "/landing-page",
  "/settings",
  "/helper",
]

// Routes that should NOT be protected (support pages, onboarding, public project pages)
const PUBLIC_ROUTES = ["/support", "/auth", "/onboarding", "/projects", "/invite"]

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const pathname = usePathname()

  // Check if current route should be protected
  const shouldProtect = PROTECTED_ROUTES.some((route) => pathname?.startsWith(route))
  const isPublic = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route))
  const isProtectedSubRoute = pathname?.includes("/invite-contributors")

  // If it's a public route but a protected sub-route (e.g. /projects/[id]/invite-contributors), protect it
  if (isPublic && !isProtectedSubRoute) {
    return <>{children}</>
  }
  if (isProtectedSubRoute || shouldProtect) {
    return <AuthGuard>{children}</AuthGuard>
  }

  // Default: don't protect (for unknown routes)
  return <>{children}</>
}
