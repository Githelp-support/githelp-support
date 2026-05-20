"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { SandboxBanner } from "@/components/layout/sandbox-banner"

interface AuthGuardProps {
  children: React.ReactNode
}

// Routes that should skip onboarding check
const SKIP_ONBOARDING_ROUTES = ["/onboarding", "/auth", "/support", "/projects", "/invite"]

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          // Not authenticated, redirect to sign in with return URL
          const redirectUrl = encodeURIComponent(pathname || "/")
          router.push(`/auth/signin?redirect=${redirectUrl}`)
          return
        }

        setIsAuthenticated(true)
      } catch (error) {
        console.error("Auth check error:", error)
        const redirectUrl = encodeURIComponent(pathname || "/")
        router.push(`/auth/signin?redirect=${redirectUrl}`)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        const redirectUrl = encodeURIComponent(pathname || "/")
        router.push(`/auth/signin?redirect=${redirectUrl}`)
      } else if (event === "SIGNED_IN" && session) {
        setIsAuthenticated(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  // Check onboarding status after authentication
  useEffect(() => {
    if (!isAuthenticated || isLoading || onboardingLoading) return
    if (!onboardingStatus) return

    // Skip onboarding check for certain routes
    const shouldSkip = SKIP_ONBOARDING_ROUTES.some((route) => pathname?.startsWith(route))
    if (shouldSkip) return

    // Redirect based on onboarding status
    if (onboardingStatus.needsOnboarding) {
      router.push("/onboarding")
      return
    }

    if (onboardingStatus.onboardingCompleted && !onboardingStatus.isMember) {
      router.push("/onboarding/waiting")
      return
    }
  }, [isAuthenticated, isLoading, onboardingLoading, onboardingStatus, router, pathname])

  if (isLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SandboxBanner />
      <div className="min-h-0 flex-1 overflow-hidden [&>*]:!h-full">
        {children}
      </div>
    </div>
  )
}
