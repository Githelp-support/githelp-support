"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { useAcceptProjectInvite } from "@/hooks/useProject"
import { useEnterProject } from "@/hooks/useEnterProject"
import { homeRouteForRole } from "@/lib/roles"
import { ensureUserOrganization } from "@/lib/organizations"

export default function AuthConfirmedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(true)
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus()
  const queryClient = useQueryClient()
  // mutateAsync is referentially stable across renders (unlike the mutation object).
  const { mutateAsync: acceptInviteAsync } = useAcceptProjectInvite()
  const enterProject = useEnterProject()
  // The callback below accepts an invite, so it must run once per mount even
  // if a dependency changes identity while it is in flight.
  const hasHandledCallback = useRef(false)

  useEffect(() => {
    if (hasHandledCallback.current) return
    hasHandledCallback.current = true

    const handleAuthCallback = async () => {
      // Wait a bit for Supabase to process the OAuth callback
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push("/auth/signin")
        return
      }

      // If user signed in with GitHub and is NOT already a project member,
      // check for pending helper invite by github_username and auto-accept.
      // Skip this block entirely for existing members so a stale invite
      // doesn't hijack every subsequent login.
      const providers = (session.user.app_metadata?.providers as string[] | undefined) ?? []
      if (providers.includes("github")) {
        try {
          // Check if user is already an active member of any project
          const { data: existingMemberships } = await supabase
            .from("projects_members")
            .select("project_id")
            .eq("user_id", session.user.id)
            .is("deleted_at", null)
            .limit(1)

          const isAlreadyMember = existingMemberships && existingMemberships.length > 0

          if (!isAlreadyMember) {
            const { data } = await supabase.functions.invoke("get-pending-invite-by-github")
            if (data?.success && data?.invite?.token) {
              const inviteToken = data.invite.token as string

              // Accept through the mutation hook (not a raw invoke) so the
              // cached project list, onboarding status and role queries are
              // invalidated. ProjectProvider already fetched the (empty)
              // project list when this page mounted and would otherwise
              // keep serving it for 30 minutes.
              let joinedProjectId: string | null = null
              try {
                const acceptData = await acceptInviteAsync(inviteToken)
                joinedProjectId = acceptData?.project_id ?? null
              } catch {
                joinedProjectId = null
              }

              if (joinedProjectId) {
                // AuthGuard redirects completed-but-not-a-member users to
                // /onboarding/waiting, so make sure it sees fresh membership
                // before landing on a protected route.
                await queryClient.refetchQueries({ queryKey: ["onboarding-status"] })
                // Select the joined project and switch to the highest role
                // held there (helper for helper invites), same as the
                // /invite/[token] page.
                const role = await enterProject(joinedProjectId)
                router.push(homeRouteForRole(role))
                return
              }
              // If accept failed (e.g. needs profile), redirect to invite page
              router.push(`/invite/${inviteToken}`)
              return
            }
          }
        } catch {
          // Ignore - continue with normal flow
        }
      }

      setIsProcessing(false)
    }

    handleAuthCallback()
  }, [router, queryClient, acceptInviteAsync, enterProject])

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

