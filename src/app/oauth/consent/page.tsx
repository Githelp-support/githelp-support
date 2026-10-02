"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase/client"
import { isSafeClientRedirect } from "@/lib/safe-redirect"

type State =
  | { kind: "loading" }
  | { kind: "consent"; details: OAuthAuthorizationDetails }
  | { kind: "redirecting" }
  | { kind: "error"; message: string }

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Consent page for GitHelp's OAuth 2.1 server (Supabase Auth). MCP clients
 * such as Claude Code or Cursor send the user here to connect to GitHelp
 * without an API key. Configured as the authorization path in Supabase Auth.
 */
function ConsentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const authorizationId = searchParams.get("authorization_id")
  const [state, setState] = useState<State>({ kind: "loading" })
  const [deciding, setDeciding] = useState<"approve" | "deny" | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!authorizationId) {
        setState({ kind: "error", message: "This link is missing its authorization request. Start the connection again from your app." })
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
        router.replace(`/auth/signin?redirect=${encodeURIComponent(back)}`)
        return
      }
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (cancelled) return
      if (error || !data) {
        setState({ kind: "error", message: error?.message ?? "This authorization request is no longer valid. Start the connection again from your app." })
        return
      }
      if ("redirect_url" in data && !("authorization_id" in data)) {
        // Already approved earlier — straight back to the app.
        if (!isSafeClientRedirect(data.redirect_url)) {
          setState({ kind: "error", message: "The app's return address isn't allowed." })
          return
        }
        setState({ kind: "redirecting" })
        window.location.href = data.redirect_url
        return
      }
      setState({ kind: "consent", details: data as OAuthAuthorizationDetails })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authorizationId, router])

  const decide = async (approve: boolean) => {
    if (!authorizationId) return
    setDeciding(approve ? "approve" : "deny")
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (error || !data?.redirect_url) {
      setDeciding(null)
      setState({ kind: "error", message: error?.message ?? "Could not complete the request. Try connecting again." })
      return
    }
    if (!isSafeClientRedirect(data.redirect_url)) {
      setDeciding(null)
      setState({ kind: "error", message: "The app's return address isn't allowed." })
      return
    }
    setState({ kind: "redirecting" })
    window.location.href = data.redirect_url
  }

  const signOutAndRetry = async () => {
    await supabase.auth.signOut()
    const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId ?? "")}`
    router.replace(`/auth/signin?redirect=${encodeURIComponent(back)}`)
  }

  if (state.kind === "loading" || state.kind === "redirecting") {
    return (
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        {state.kind === "redirecting" && <p>Returning you to your app…</p>}
      </div>
    )
  }

  if (state.kind === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Couldn&apos;t connect</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { details } = state
  const clientName = details.client?.name || "An application"

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          {details.client?.logo_uri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={details.client.logo_uri} alt="" className="w-10 h-10 rounded-md border border-border object-contain" />
          ) : (
            <ShieldCheck className="w-10 h-10 text-brand-primary" />
          )}
          <div className="min-w-0">
            <CardTitle className="text-xl truncate">Connect {clientName}</CardTitle>
            <CardDescription className="truncate">
              {details.client?.uri ? hostOf(details.client.uri) : hostOf(details.redirect_uri)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">{clientName}</span> wants to use GitHelp as{" "}
          <span className="font-medium">{details.user?.email}</span>.{" "}
          <button
            type="button"
            onClick={() => void signOutAndRetry()}
            className="text-brand-primary underline-offset-2 hover:underline cursor-pointer"
          >
            Not you? Sign out
          </button>
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>It can open support tickets with projects and follow them on your behalf.</li>
          <li>It can read and send messages on tickets you opened.</li>
          <li>
            It can&apos;t add or use a card by itself — payments still need your approval in GitHelp above your
            auto-approve limit.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          You&apos;ll be sent back to <span className="font-mono">{hostOf(details.redirect_uri)}</span>. You can
          disconnect it any time under Settings → API &amp; AI.
        </p>
        <div className="flex gap-2 pt-1">
          <Button variant="lavender" onClick={() => decide(true)} disabled={deciding !== null} className="flex-1">
            {deciding === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Allow"}
          </Button>
          <Button variant="outline" onClick={() => decide(false)} disabled={deciding !== null} className="flex-1">
            {deciding === "deny" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deny"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function OAuthConsentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <Logo className="w-[50px] h-[50px]" />
        <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-brand-primary" />}>
          <ConsentContent />
        </Suspense>
      </div>
    </div>
  )
}
