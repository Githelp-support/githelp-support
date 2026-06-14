"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { supabase } from "@/lib/supabase/client"

export type UserRole = "helper" | "user" | "admin"

interface User {
  name: string
  role: UserRole
  avatar: string
  avatarUrl: string | null
  id?: string
  email?: string
  projectRole?: UserRole | null // Highest role from project membership
}

interface UserContextType {
  user: User
  setUser: (user: User) => void
  switchRole: (role: UserRole) => void
  setProjectRole: (role: UserRole | null) => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Derive the safest default role from the user's actual highest project role.
// admin → admin, helper → helper, otherwise → user. Prevents users without
// admin access from getting stuck on an admin-only default.
function computeDefaultRoleFromProject(projectRole?: UserRole | null): UserRole {
  if (projectRole === "admin") return "admin"
  if (projectRole === "helper") return "helper"
  return "user"
}

// Resolve the initial role: prefer a saved `userRole` from localStorage, otherwise
// fall back to a projectRole-aware default.
function resolveInitialRole(projectRole?: UserRole | null): UserRole {
  if (typeof window === "undefined") return computeDefaultRoleFromProject(projectRole)
  const savedRole = localStorage.getItem("userRole") as UserRole | null
  if (savedRole && ["helper", "user", "admin"].includes(savedRole)) {
    return savedRole
  }
  return computeDefaultRoleFromProject(projectRole)
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    // Initialize with default values, will be updated in useEffect
    return {
      name: "Incognito",
      role: "user",
      avatar: "I",
      avatarUrl: null,
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  // Re-sync auth when user returns to tab (recovers from Supabase client corruption
  // after tab suspension/backgrounding). See: https://github.com/supabase/supabase/issues/36046
  useEffect(() => {
    const SYNC_TIMEOUT_MS = 5000

    const syncAuthOnVisibility = async () => {
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth sync timeout")), SYNC_TIMEOUT_MS)
        )
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise])

        if (session?.user) {
          const { data: profile } = await supabase
            .from("users_public")
            .select("*")
            .eq("id", session.user.id)
            .single()
          setUser(prev => ({
            ...prev,
            name: profile?.name || session.user.email?.split("@")[0] || "User",
            avatar: (profile?.name || session.user.email?.[0] || "U")[0].toUpperCase(),
            avatarUrl: profile?.avatar_url ?? null,
            id: session.user.id,
            email: session.user.email || undefined,
            role: prev.role || resolveInitialRole(prev.projectRole),
          }))
        } else {
          setUser({ name: "Incognito", role: "user", avatar: "I", avatarUrl: null })
        }
      } catch {
        // Client likely corrupted (getSession hung). Reload to recover.
        window.location.reload()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthOnVisibility()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          // User is already logged in, fetch profile
          const { data: profile } = await supabase
            .from('users_public')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            setUser(prev => ({
              name: profile.name || session.user.email?.split("@")[0] || "User",
              role: resolveInitialRole(prev.projectRole),
              avatar: (profile.name || session.user.email?.[0] || "U")[0].toUpperCase(),
              avatarUrl: profile?.avatar_url ?? null,
              id: session.user.id,
              email: session.user.email || undefined,
              projectRole: prev.projectRole,
            }))
          } else {
            setUser(prev => ({
              name: session.user.email?.split("@")[0] || "User",
              role: resolveInitialRole(prev.projectRole),
              avatar: (session.user.email?.[0] || "U")[0].toUpperCase(),
              avatarUrl: null,
              id: session.user.id,
              email: session.user.email || undefined,
              projectRole: prev.projectRole,
            }))
          }
        } else {
          // No session, set default guest user
          setUser({
            name: "Incognito",
            role: "user",
            avatar: "I",
            avatarUrl: null,
          })
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth state changes
    // IMPORTANT: Do NOT use async/await or call Supabase methods directly in the callback.
    // This causes deadlocks with the auth lock, especially with multiple tabs open.
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser({
          name: "Incognito",
          role: "user",
          avatar: "I",
          avatarUrl: null,
          projectRole: null,
        })
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Defer async work to avoid deadlock - callback must not await Supabase calls
        setTimeout(async () => {
          const { data: profile } = await supabase
            .from('users_public')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            setUser(prev => ({
              name: profile.name || session.user.email?.split("@")[0] || "User",
              role: prev.role || resolveInitialRole(prev.projectRole),
              avatar: (profile.name || session.user.email?.[0] || "U")[0].toUpperCase(),
              avatarUrl: profile?.avatar_url ?? null,
              id: session.user.id,
              email: session.user.email || undefined,
              projectRole: prev.projectRole,
            }))
          } else {
            setUser(prev => ({
              name: session.user.email?.split("@")[0] || "User",
              role: prev.role || resolveInitialRole(prev.projectRole),
              avatar: (session.user.email?.[0] || "U")[0].toUpperCase(),
              avatarUrl: null,
              id: session.user.id,
              email: session.user.email || undefined,
              projectRole: prev.projectRole,
            }))
          }
        }, 0)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const switchRole = (role: UserRole) => {
    // The role switcher in the top bar is responsible for offering only
    // the roles the profile is permitted to assume (computed from the user's
    // maximum role across ALL their projects). The previous per-current-project
    // validation here used `prev.projectRole`, which gets cleared/lowered when
    // navigating between pages (e.g. /support/* sets it to null for support
    // users) — that incorrectly blocked legitimate role switches back from
    // "user" to "helper"/"admin".
    setUser(prev => {
      localStorage.setItem("userRole", role)
      return { ...prev, role }
    })
  }

  const setProjectRole = useCallback((role: UserRole | null) => {
    setUser(prev => {
      if (prev.projectRole === role) return prev

      const newState = { ...prev, projectRole: role }

      if (role) {
        const roleHierarchy: Record<UserRole, number> = {
          admin: 2,
          helper: 1,
          user: 0,
        }
        const projectRoleLevel = roleHierarchy[role] || 0
        const currentRoleLevel = roleHierarchy[prev.role] || 0
        const savedRole = localStorage.getItem("userRole") as UserRole | null

        if (savedRole && ["helper", "user", "admin"].includes(savedRole)) {
          const savedRoleLevel = roleHierarchy[savedRole] || 0
          if (savedRoleLevel <= projectRoleLevel) {
            newState.role = savedRole
          } else {
            newState.role = role
            localStorage.removeItem("userRole")
          }
        } else if (currentRoleLevel > projectRoleLevel) {
          newState.role = role
          if (savedRole) localStorage.removeItem("userRole")
        } else if (!savedRole) {
          newState.role = role
        }
      } else {
        const savedRole = localStorage.getItem("userRole") as UserRole
        if (savedRole && ["helper", "user", "admin"].includes(savedRole)) {
          newState.role = savedRole
        } else {
          newState.role = "user"
        }
      }

      return newState
    })
  }, [])

  return <UserContext.Provider value={{ user, setUser, switchRole, setProjectRole, isLoading }}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
