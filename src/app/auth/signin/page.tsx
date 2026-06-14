"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/brand/logo"
import { loginUserGoogle, signInWithEmail, signInWithGitHub } from "@/lib/supabase/auth"
import { supabase } from "@/lib/supabase/client"
import { Loader2, Mail } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [email, setEmail] = useState("")
  const [isSendingEmailLink, setIsSendingEmailLink] = useState(false)
  const [emailLinkSentTo, setEmailLinkSentTo] = useState<string | null>(null)
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null)

  const redirectTo = searchParams.get("redirect") || "/"

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        router.push(redirectTo)
      } else {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router, redirectTo])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await loginUserGoogle("/auth/confirmed?redirect=" + encodeURIComponent(redirectTo))
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    try {
      setIsLoading(true)
      await signInWithGitHub("/auth/confirmed?redirect=" + encodeURIComponent(redirectTo))
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  const handleEmailLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setEmailLinkError(null)
    setIsSendingEmailLink(true)
    try {
      await signInWithEmail(
        trimmed,
        window.location.origin + "/auth/confirmed?redirect=" + encodeURIComponent(redirectTo),
      )
      setEmailLinkSentTo(trimmed)
    } catch (error) {
      console.error("Email link sign in error:", error)
      const message =
        error instanceof Error ? error.message : "Could not send sign-in link. Please try again."
      setEmailLinkError(message)
    } finally {
      setIsSendingEmailLink(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <Logo className="w-[50px] h-[50px]" />
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign in</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your admin and helper dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGitHubSignIn}
            disabled={isLoading}
            className="w-full bg-[#24292e] hover:bg-[#1b1f23] text-white"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </>
            )}
          </Button>
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {emailLinkSentTo ? (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
              <p className="font-medium">Check your inbox</p>
              <p className="text-muted-foreground mt-1">
                We sent a sign-in link to <span className="font-medium text-foreground">{emailLinkSentTo}</span>.
                Click it to finish signing in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmailLinkSentTo(null)
                  setEmail("")
                }}
                className="mt-2 text-xs text-brand-primary hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLinkSubmit} className="space-y-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isSendingEmailLink}
              />
              {emailLinkError && (
                <p className="text-xs text-destructive">{emailLinkError}</p>
              )}
              <Button
                type="submit"
                disabled={isLoading || isSendingEmailLink || !email.trim()}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {isSendingEmailLink ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Email me a sign-in link
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

