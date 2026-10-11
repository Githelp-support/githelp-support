"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { supabase } from "@/lib/supabase/client"
import { useAccountRoles } from "@/hooks/useAccountRoles"
import { homeRouteForRole } from "@/lib/roles"
import type { UserRole } from "@/contexts/user-context"
import { Loader2 } from "lucide-react"

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  helper: "Helper",
  user: "User",
}

export default function RolePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: roles, isLoading } = useAccountRoles()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const redirect = searchParams.get("redirect")

  // Persist the chosen role (same mechanism as switchRole in user-context)
  // and continue to the destination.
  const selectRole = (role: UserRole) => {
    localStorage.setItem("userRole", role)
    router.push(redirect || homeRouteForRole(role))
  }

  useEffect(() => {
    if (isLoading || !roles || roles.length > 1) return

    setIsRedirecting(true)

    if (roles.length === 1) {
      // Only one role to act as — no need to show the chooser.
      localStorage.setItem("userRole", roles[0])
      router.push(redirect || homeRouteForRole(roles[0]))
      return
    }

    // The hook returns [] both when unauthenticated and when the account
    // holds no roles — distinguish via the session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push(redirect || homeRouteForRole("user"))
      } else {
        router.push("/auth/signin")
      }
    })
  }, [isLoading, roles, redirect, router])

  if (isLoading || isRedirecting || !roles) {
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
            <CardTitle className="text-2xl font-bold text-center">I am acting as:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {roles.map((role) => (
                <Button
                  key={role}
                  variant="outline"
                  size="lg"
                  className="w-full font-[550]"
                  onClick={() => selectRole(role)}
                >
                  {ROLE_LABELS[role]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
