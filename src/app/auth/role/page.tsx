"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/brand/logo"
import { RoleOptionCards } from "@/components/auth/role-option-cards"
import { supabase } from "@/lib/supabase/client"
import { useAccountRoles } from "@/hooks/useAccountRoles"
import { homeRouteForRole } from "@/lib/roles"
import type { UserRole } from "@/contexts/user-context"
import { Loader2 } from "lucide-react"

/**
 * Per-login role chooser. Looks exactly like the onboarding role screen and
 * always offers Admin, Helper and User:
 *
 *  - a role the account already holds → act as it and continue;
 *  - User → always available (every account has a private user context);
 *  - Admin / Helper the account does not hold yet → start the "add a role"
 *    flow for it (project name search) instead of landing in an empty view.
 */
export default function RolePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: roles, isLoading } = useAccountRoles()
  const [busyRole, setBusyRole] = useState<UserRole | null>(null)

  const redirect = searchParams.get("redirect")

  // Persist the chosen role (same mechanism as switchRole in user-context)
  // and continue to the destination.
  const selectRole = (role: UserRole) => {
    setBusyRole(role)
    const held = roles ?? []
    if (role === "user" || held.includes(role)) {
      localStorage.setItem("userRole", role)
      router.push(redirect || homeRouteForRole(role))
      return
    }
    // Not set up for this role yet — pick (or create) a project for it.
    router.push(`/onboarding?new=1&role=${role}`)
  }

  useEffect(() => {
    if (isLoading || !roles || roles.length > 0) return

    // The hook returns [] both when unauthenticated and when the account
    // holds no roles — distinguish via the session. Accounts with no roles
    // at all are normally caught by onboarding before they get here.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        localStorage.setItem("userRole", "user")
        router.push(redirect || homeRouteForRole("user"))
      } else {
        router.push("/auth/signin")
      }
    })
  }, [isLoading, roles, redirect, router])

  // No roles → the effect above is redirecting; keep showing the spinner.
  if (isLoading || !roles || roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
        <Logo className="w-[50px] h-[50px]" />
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Githelp!</CardTitle>
            <CardDescription className="text-sm mt-2">
              Pick the role you want to use right now. You can switch at any time from the top bar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RoleOptionCards
              roles={["admin", "helper", "user"]}
              onSelect={selectRole}
              disabled={busyRole !== null}
              busyRole={busyRole}
              hint={(role) =>
                role !== "user" && !roles.includes(role)
                  ? "You're not set up as this yet — you'll be asked which project first."
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
