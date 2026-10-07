"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useAccountRoles } from "@/hooks/useAccountRoles"
import { homeRouteForRole } from "@/lib/roles"
import type { UserRole } from "@/contexts/user-context"
import { Loader2 } from "lucide-react"

/**
 * Post sign-in hand-off. Sign-in used to show an "I am acting as" chooser
 * here; roles are now only picked during first-time onboarding or added from
 * the top bar ("+ New role" / "Add new"), so an onboarded account goes
 * straight into the app. We resume the role they last acted as when the
 * account still holds it, otherwise the highest role it holds.
 */
export default function RolePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: roles, isLoading } = useAccountRoles()

  const redirect = searchParams.get("redirect")

  useEffect(() => {
    if (isLoading || !roles) return

    if (roles.length > 0) {
      const stored = localStorage.getItem("userRole") as UserRole | null
      const role = stored && roles.includes(stored) ? stored : roles[0]
      localStorage.setItem("userRole", role)
      router.replace(redirect || homeRouteForRole(role))
      return
    }

    // The hook returns [] both when unauthenticated and when the account
    // holds no roles — distinguish via the session. Accounts with no roles
    // at all are normally caught by onboarding before they get here.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        localStorage.setItem("userRole", "user")
        router.replace(redirect || homeRouteForRole("user"))
      } else {
        router.replace("/auth/signin")
      }
    })
  }, [isLoading, roles, redirect, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  )
}
