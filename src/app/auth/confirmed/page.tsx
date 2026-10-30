"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { useAcceptProjectInvite } from "@/hooks/useProject"
import { useEnterProject } from "@/hooks/useEnterProject"
import { homeRouteForRole } from "@/lib/roles"
import { ensureUserOrganization } from "@/lib/organizations"
import { safeInternalPathOrNull, storePendingRedirect } from "@/lib/safe-redirect"
import { hasSignedInSession } from "@/lib/supabase/auth-state"
import { adoptionLandingForRedirect, runGuestAdoptionFlow } from "@/lib/guest-adoption"
import {
  AUTH_CALLBACK_FAILURE_COPY,
  authCallbackFailure,
  handlesOwnOnboarding,
  signInRetryHref,
  type AuthCallbackFailure,
} from "@/lib/sign-in-href"
import { notifyGuestAdoptionResult } from "@/lib/guest-adoption-toast"
import { useGuestSignInPresence } from "@/hooks/useGuestPresence"


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
  // Until the real session lands, keep the guest's open tickets alive.
  useGuestSignInPresence()

  // Open-redirect guard: only same-origin paths are ever navigated to.
  const requestedRedirect = safeInternalPathOrNull(searchParams.get("redirect"))
  // After linking a guest conversation (or discarding one), land on the
  // right chat instead of the requested page (see landingAfterGuestAdoption).
  const [adoptionLanding, setAdoptionLanding] = useState<string | null>(null)
  // The sign-in link couldn't complete in this browser (PKCE) or expired.
  const [linkFailed, setLinkFailed] = useState<Exclude<AuthCallbackFailure, "cancelled"> | null>(null)
  const redirectTo = adoptionLanding ?? requestedRedirect

  useEffect(() => {
    if (hasHandledCallback.current) return
    hasHandledCallback.current = true

    const handleAuthCallback = async () => {
      // getSession() awaits the client's start-up, which exchanges the PKCE
      // ?code= of this callback.
      const { data: { session } } = await supabase.auth.getSession()

      // A still-anonymous guest session (or none) means the real sign-in
      // didn't land. A link that can't complete here (other browser, expired)
      // gets an explanation; a cancelled sign-in goes back to sign-in —
      // both keep where they were heading and the support-customer flag.
      if (!session?.user || !hasSignedInSession(session)) {
        // initialize() returns the (cached) start-up result, incl. a failed
        // PKCE exchange's error code.
        const { error: initError } = await supabase.auth.initialize()
        const failure =
          typeof window !== "undefined"
            ? authCallbackFailure(
                window.location.search,
                window.location.hash,
                initError ? ((initError as { code?: string }).code ?? "unknown") : null,
              )
            : null
        if (failure && failure !== "cancelled") {
          setLinkFailed(failure)
          return
        }
        router.push(signInRetryHref(requestedRedirect, searchParams.get("skipOnboarding") === "true"))
        return
      }

      // Shared post-sign-in step (OAuth and e-mail links both land here):
      // after the user confirms the preview, move tickets opened as a guest
      // to this account. Network steps are capped at ~10 s; a transient
      // failure keeps the key for a later retry. Never blocks sign-in.
      const adoption = await runGuestAdoptionFlow({ timeoutMs: 10_000 })
      notifyGuestAdoptionResult(adoption)
      if (adoption.status === "adopted" || adoption.status === "elsewhere") {
        void queryClient.invalidateQueries()
      }
      // Linked: land on the open conversation; discarded while heading to
      // that conversation: a fresh composer instead of "Ticket not found".
      // Invite / project-join destinations win (adoption still happened).
      const landing = adoptionLandingForRedirect(adoption, requestedRedirect)
      if (landing) setAdoptionLanding(landing)

      // If user signed in with GitHub and is NOT already a project member,
      // check for pending helper invite by github_username and auto-accept.
      // Skip this block entirely for existing members so a stale invite
      // doesn't hijack every subsequent login, and when the user arrived
      // from a specific invite link — that page accepts its own token.
      const providers = (session.user.app_metadata?.providers as string[] | undefined) ?? []
      const cameFromInviteLink = !!requestedRedirect && requestedRedirect.startsWith("/invite/")
      if (providers.includes("github") && !cameFromInviteLink) {
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
                // A linked guest conversation's landing beats the role home.
                router.push(landing ?? homeRouteForRole(role))
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
  }, [router, queryClient, acceptInviteAsync, enterProject, requestedRedirect, searchParams])

  // Handle redirect after onboarding status is loaded
  useEffect(() => {
    if (isProcessing || onboardingLoading || !onboardingStatus) return

    const skipOnboarding = searchParams.get("skipOnboarding") === "true"
    const selfOnboarding = handlesOwnOnboarding(redirectTo)

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
    if (!skipOnboarding && !selfOnboarding) {
      void ensureUserOrganization("admin")
    }

    // If there's a specific redirect and user doesn't need onboarding,
    // let /auth/role resolve the role to act as and forward to it
    if (redirectTo && !onboardingStatus.needsOnboarding && onboardingStatus.isMember) {
      router.push(`/auth/role?redirect=${encodeURIComponent(redirectTo)}`)
      return
    }

    // Invite links and project landing pages handle onboarding themselves
    // (accepting / requesting marks the account as onboarded), so go there
    // directly even for brand-new accounts instead of dropping the target.
    if (redirectTo && selfOnboarding) {
      router.push(redirectTo)
      return
    }

    // Otherwise, check onboarding status
    if (onboardingStatus.needsOnboarding) {
      // Remember where they were heading; the wizard honours it once it
      // completes (see /onboarding).
      storePendingRedirect(redirectTo)
      router.push("/onboarding")
      return
    }

    if (onboardingStatus.needsWaiting) {
      router.push("/onboarding/waiting")
      return
    }

    // Default: /auth/role resolves the role to act as (last used, else
    // highest held) and lands in the app, forwarding any redirect URL
    router.push(redirectTo ? `/auth/role?redirect=${encodeURIComponent(redirectTo)}` : "/auth/role")
  }, [isProcessing, onboardingLoading, onboardingStatus, router, searchParams, redirectTo])

  if (linkFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="max-w-md rounded-lg border border-border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground mb-2">Sign-in didn&rsquo;t complete</h1>
          <p className="text-[14px] text-muted-foreground">
            {AUTH_CALLBACK_FAILURE_COPY[linkFailed].message}{" "}
            <Link
              href={signInRetryHref(requestedRedirect, searchParams.get("skipOnboarding") === "true")}
              className="text-brand-primary font-medium hover:underline"
            >
              {AUTH_CALLBACK_FAILURE_COPY[linkFailed].action}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
        <p className="text-[14px] text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}

