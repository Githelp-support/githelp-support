"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/brand/logo"
import { SignInOptions } from "@/components/auth/sign-in-options"
import { supabase } from "@/lib/supabase/client"
import { safeInternalPath } from "@/lib/safe-redirect"
import { hasGuestSession, hasSignedInSession } from "@/lib/supabase/auth-state"
import { adoptionLandingForRedirect, prepareGuestAdoption, runGuestAdoptionFlow } from "@/lib/guest-adoption"
import { isOwnGuestId, readSavedGuestSession } from "@/lib/guest-adoption-storage"
import { useQueryClient } from "@tanstack/react-query"
import { notifyGuestAdoptionResult } from "@/lib/guest-adoption-toast"
import { isSupportRoute, signInSubtitle } from "@/lib/sign-in-href"
import { useGuestSignInPresence } from "@/hooks/useGuestPresence"
import { Loader2 } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const queryClient = useQueryClient()
  // A guest signing in keeps their open guest ticket alive meanwhile.
  useGuestSignInPresence()

  // Only same-origin paths may be used as a post-sign-in destination.
  const redirectTo = safeInternalPath(searchParams.get("redirect"), "/")
  const skipOnboarding = searchParams.get("skipOnboarding") === "true"
  // Heading back to a support page: a customer continuing support.
  const fromSupport = isSupportRoute(redirectTo.split("?")[0])

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // An anonymous guest (public support chat) is NOT signed in: show the
      // options. This browser's own guest gets their guest session saved for
      // adoption below (a foreign / planted guest never does); linking still
      // needs the signed-in user's confirmation afterwards.
      if (hasSignedInSession(session)) {
        // Signed in elsewhere (another tab) while a guest session was saved.
        const adoption = await runGuestAdoptionFlow({ timeoutMs: 10_000 })
        notifyGuestAdoptionResult(adoption)
        if (adoption.status === "adopted" || adoption.status === "elsewhere") void queryClient.invalidateQueries()
        router.push(adoptionLandingForRedirect(adoption, redirectTo) ?? redirectTo)
      } else {
        // This browser's own guest continuing a support conversation (the
        // redirect is a support route): keep their guest session so the
        // conversation can be linked after sign-in — confirmed by the user,
        // naming the account. Not for other redirects (e.g. an AuthGuard
        // bounce on a shared computer: the next person must not inherit
        // it). An existing key keeps its 60-minute window.
        const guestId = hasGuestSession(session) ? session?.user?.id : undefined
        const ownGuest = isOwnGuestId(guestId)
        if (ownGuest && fromSupport && readSavedGuestSession()?.user_id !== guestId) await prepareGuestAdoption()
        const saved = readSavedGuestSession()
        // "Continue your conversation" only with a valid key for this guest.
        setIsGuest(ownGuest && !!saved && saved.user_id === guestId)
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router, redirectTo, queryClient, fromSupport])

  // A guest coming back from a support chat is continuing that conversation.
  const continuingConversation = isGuest && fromSupport

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-muted">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-muted p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <Logo className="w-[50px] h-[50px]" />
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-center">
            {continuingConversation ? "Sign in to continue your conversation" : "Sign in"}
          </CardTitle>
          <CardDescription className="text-center">
            {continuingConversation
              ? "Your conversation stays where it is. Sign in to get notified when a helper replies and to get help."
              : signInSubtitle(fromSupport)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInOptions
            confirmPath={
              "/auth/confirmed?redirect=" +
              encodeURIComponent(redirectTo) +
              (skipOnboarding ? "&skipOnboarding=true" : "")
            }
          />
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
