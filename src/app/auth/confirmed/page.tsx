"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { ensureUserOrganization } from "@/lib/organizations"

export default function AuthConfirmedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(true)
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus()

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Wait a bit for Supabase to process the OAuth callback
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push("/auth/signin")
        return
      }

      // If user signed in with GitHub, check for pending helper invite by github_username and auto-accept
      const providers = (session.user.app_metadata?.providers as string[] | undefined) ?? []
      if (providers.includes("github")) {
        try {
          const { data } = await supabase.functions.invoke("get-pending-invite-by-github")
          if (data?.success && data?.invite?.token) {
            const { data: acceptData } = await supabase.functions.invoke("accept-project-invite", {
              body: { token: data.invite.token },
            })
            if (acceptData?.success && acceptData?.project_id) {
              router.push(`/projects/${acceptData.project_id}`)
              return
            }
            // If accept failed (e.g. needs profile), redirect to invite page
            router.push(`/invite/${data.invite.token}`)
            return
          }
        } catch {
          // Ignore - continue with normal flow
        }
      }

      setIsProcessing(false)
    }

    handleAuthCallback()
  }, [router])

  // Handle redirect after onboarding status is loaded
  useEffect(() => {
    if (isProcessing || onboardingLoading || !onboardingStatus) return

    const redirectTo = searchParams.get("redirect")
    const skipOnboarding = searchParams.get("skipOnboarding") === "true"
    const isInviteRedirect = !!redirectTo && redirectTo.startsWith("/invite/")
    
    // Support users (signing in from support chat) skip onboarding - they don't need an organization
    // Set their role to "user" by default as they are users of support
    if (skipOnboarding && redirectTo) {
      // Ensure support users have an organization and selected organization
      void ensureUserOrganization("support")

      // Set role preference to "user" for support users
      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", "user")
      }
      router.push(redirectTo)
      return
    }
    
    // Admin/helper sign-in path (non-invite): ensure organization before proceeding
    if (!skipOnboarding && !isInviteRedirect) {
      void ensureUserOrganization("admin")
    }

    // If there's a specific redirect and user doesn't need onboarding, go there
    if (redirectTo && !onboardingStatus.needsOnboarding && onboardingStatus.isMember) {
      router.push(redirectTo)
      return
    }

    // Otherwise, check onboarding status
    if (onboardingStatus.needsOnboarding) {
      router.push("/onboarding")
      return
    }

    if (onboardingStatus.onboardingCompleted && !onboardingStatus.isMember) {
      router.push("/onboarding/waiting")
      return
    }

    // Default: go to dashboard or redirect URL
    router.push(redirectTo || "/")
  }, [isProcessing, onboardingLoading, onboardingStatus, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}

