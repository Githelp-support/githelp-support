"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/brand/logo"
import { SignInOptions } from "@/components/auth/sign-in-options"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

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
        <CardContent>
          <SignInOptions confirmPath={"/auth/confirmed?redirect=" + encodeURIComponent(redirectTo)} />
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
