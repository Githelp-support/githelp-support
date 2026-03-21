"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { supabase } from "@/lib/supabase/client"

export type UserRole = "helper" | "user" | "admin"

interface User {
  name: string
  role: UserRole
  avatar: string
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    // Initialize with default values, will be updated in useEffect
    return {
      name: "Incognito",
      role: "user",
      avatar: "I",
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
          const savedRole = localStorage.getItem("userRole") as UserRole
          const defaultRole = (savedRole && ["helper", "user", "admin"].includes(savedRole)) ? savedRole : "admin"
          setUser(prev => ({
            ...prev,
            name: profile?.name || session.user.email?.split("@")[0] || "User",
            avatar: (profile?.name || session.user.email?.[0] || "U")[0].toUpperCase(),
            id: session.user.id,
            email: session.user.email || undefined,
            role: prev.role || defaultRole,
          }))
        } else {
          setUser({ name: "Incognito", role: "user", avatar: "I" })
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

          // Check for saved role preference (e.g., "user" for support users)
          const savedRole = localStorage.getItem("userRole") as UserRole
          const defaultRole = (savedRole && ["helper", "user", "admin"].includes(savedRole)) ? savedRole : "admin"

          if (profile) {
            setUser({
              name: profile.name || session.user.email?.split("@")[0] || "User",
              role: defaultRole,
              avatar: (profile.name || session.user.email?.[0] || "U")[0].toUpperCase(),
              id: session.user.id,
              email: session.user.email || undefined,
            })
          } else {
            setUser({
              name: session.user.email?.split("@")[0] || "User",
              role: defaultRole,
              avatar: (session.user.email?.[0] || "U")[0].toUpperCase(),
              id: session.user.id,
              email: session.user.email || undefined,
            })
          }
        } else {
          // No session, set default guest user
          setUser({
            name: "Incognito",
            role: "user",
            avatar: "I",
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

          const savedRole = localStorage.getItem("userRole") as UserRole
          const defaultRole = (savedRole && ["helper", "user", "admin"].includes(savedRole)) ? savedRole : "admin"

          if (profile) {
            setUser(prev => ({
              name: profile.name || session.user.email?.split("@")[0] || "User",
              role: prev.role || defaultRole,
              avatar: (profile.name || session.user.email?.[0] || "U")[0].toUpperCase(),
              id: session.user.id,
              email: session.user.email || undefined,
            }))
          } else {
            setUser(prev => ({
              name: session.user.email?.split("@")[0] || "User",
              role: prev.role || defaultRole,
              avatar: (session.user.email?.[0] || "U")[0].toUpperCase(),
              id: session.user.id,
              email: session.user.email || undefined,
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
    setUser(prev => {
      // Only allow switching to roles that are valid based on project role
      const projectRole = prev.projectRole

      // If no project role, allow any switch (for non-project pages, including support users)
      if (!projectRole) {
        localStorage.setItem("userRole", role)
        return { ...prev, role }
      }

      // Define role hierarchy: admin > helper > user
      const roleHierarchy: Record<UserRole, number> = {
        admin: 2,
        helper: 1,
        user: 0
      }

      const projectRoleLevel = roleHierarchy[projectRole] || 0
      const targetRoleLevel = roleHierarchy[role] || 0

      // Only allow switching to roles at or below the project role level
      if (targetRoleLevel <= projectRoleLevel) {
        localStorage.setItem("userRole", role)
        return { ...prev, role }
      }

      return prev
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
