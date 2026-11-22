"use client"

import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logoutUser } from "@/lib/supabase/auth"
import { useUser, type UserRole } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { useUserProjects, useProjectBranding } from "@/hooks/useProject"
import {
  useProjectAvailableRoles,
  projectAvailableRolesQueryOptions,
  roleProjectIdsQueryOptions,
  useUserRoles,
} from "@/hooks/useProjectRole"
import {
  homeRouteForRole,
  getLastProjectForRole,
  pickProjectForRole,
  clearAccountUiState,
} from "@/lib/roles"
import type { Database } from "@/types/database"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export const getRoleDisplayName = (role: UserRole) => {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Role / project / sign-out logic shared by the TopBar and the Sidebar.
 *
 * Deliberately free of side-effects (no `useEffect`): the Sidebar mounts twice
 * (desktop + mobile sheet), so anything that must run once per page — remembering
 * the last project per role, auto-switching to the first available role — lives
 * in TopBar, which mounts exactly once.
 */
export function useWorkspaceSwitcher() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, switchRole } = useUser()
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection()
  const { confirmNavigation } = useUnsavedChanges()
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjects()
  const { data: userRoles, isSuccess: userRolesLoaded } = useUserRoles()

  const selectedProject = userProjects.find((p) => p.project_id === selectedProjectId) || userProjects[0]
  const { data: projectAvailableRoles, isSuccess: projectRolesLoaded } = useProjectAvailableRoles(
    selectedProject?.project_id,
  )
  const { data: selectedProjectBranding } = useProjectBranding(selectedProject?.project_id || "")

  const isSignedIn = Boolean(user.id)

  const routeForRole = (role: UserRole) => {
    router.push(homeRouteForRole(role))
  }

  const handleProjectSelect = async (project: Project) => {
    const isDifferentProject = project.project_id !== selectedProjectId
    setSelectedProjectId(project.project_id)
    if (!isDifferentProject) return

    // Always land in the HIGHEST role the user holds in the newly selected
    // project (e.g. helper in A → admin in B switches to admin; admin in A →
    // helper-only in B switches to helper). Roles come back ordered
    // admin > helper > user, and fetchQuery shares the switcher's cache.
    let nextRole: UserRole = "user"
    try {
      const roles = await queryClient.fetchQuery(projectAvailableRolesQueryOptions(project.project_id))
      nextRole = roles[0] ?? "user"
    } catch (error) {
      console.error("Failed to resolve roles for project:", error)
    }
    if (nextRole !== user.role) switchRole(nextRole)
    routeForRole(nextRole)
  }

  // Both the role change and the redirect run inside the unsaved-changes
  // guard so choosing "Stay" leaves the current role and page untouched.
  const handleSwitchRole = (role: UserRole) => {
    confirmNavigation(() => {
      // Leaving the private User context for admin/helper: open the project
      // last used in that role (see pickProjectForRole for the fallbacks).
      if (user.role === "user" && role !== "user") {
        void enterRoleFromPrivate(role)
        return
      }
      switchRole(role)
      routeForRole(role)
    })
  }

  const enterRoleFromPrivate = async (role: "admin" | "helper") => {
    try {
      const ids = await queryClient.fetchQuery(roleProjectIdsQueryOptions())
      // Keep the project list's order and drop projects it doesn't contain
      // (deleted ones) — ProjectProvider rejects selections outside the list.
      const candidates = userProjects
        .map((p) => p.project_id)
        .filter((id) => ids[role].includes(id))
      const projectId = pickProjectForRole(candidates, getLastProjectForRole(role), selectedProjectId)
      if (!projectId) {
        toast.error(`You don't have the ${getRoleDisplayName(role)} role in any project.`)
        return
      }
      setSelectedProjectId(projectId)
      switchRole(role)
      routeForRole(role)
    } catch (error) {
      console.error("Failed to resolve project for role:", error)
      toast.error("Couldn't switch role. Please try again.")
    }
  }

  const performSignOut = async () => {
    try {
      await logoutUser()
      // Drop per-account UI state (role, selected project, last project per
      // role, pending redirect) so the next account on this browser starts
      // clean instead of flashing the previous user's navigation.
      clearAccountUiState()
      // Force a clean reload to /auth/signin so no partially-viewable
      // portal remains, regardless of the user's role. The hard redirect is
      // covered by the guard's beforeunload handler.
      if (typeof window !== "undefined") {
        window.location.href = "/auth/signin"
      } else {
        router.push("/auth/signin")
      }
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  // Guarded so an unsaved page prompts before the session is torn down or
  // the user is sent to the sign-in page.
  const signOut = () => {
    confirmNavigation(() => {
      void performSignOut()
    })
  }

  // Admin/helper are scoped to the SELECTED project (keyed by the persisted
  // selected project id — not the per-page projectRole, which gets
  // cleared/lowered on /support pages), and limited to the role categories
  // the profile is ACTUALLY registered for. "User" is always offered: every
  // account has a private user context to act in. Ordered admin → helper → user.
  const availableRoles: UserRole[] = useMemo(() => {
    const registered = userRolesLoaded && userRoles && userRoles.length > 0 ? userRoles : null
    let roles: UserRole[]
    if (!projectAvailableRoles) {
      // No projects at all (support-only users) or queries still loading:
      // fall back to the global registrations, then to the active role so
      // the dropdown is never empty.
      roles = registered ?? [user.role]
    } else if (!registered) {
      roles = projectAvailableRoles
    } else {
      const scoped = projectAvailableRoles.filter((role) => registered.includes(role))
      roles = scoped.length > 0 ? scoped : projectAvailableRoles
    }
    return roles.includes("user") ? roles : [...roles, "user"]
  }, [userRolesLoaded, userRoles, projectAvailableRoles, user.role])

  const rolesResolved =
    userRolesLoaded && !projectsLoading && (!selectedProject || projectRolesLoaded)

  // Acting as User = acting in the private user context, whatever projects the
  // account belongs to. Users get a context dropdown ("Private" today; later
  // also employers they are verified to operate under) instead of the project
  // dropdown, and it lists no projects. The role dropdown is therefore the
  // way back to a project: it keeps offering the admin/helper roles held in
  // the remembered project, plus "+ New role" (User role only).
  const isPrivateContext = user.role === "user"

  // Role dropdown contents. In a project (admin/helper) it lists the roles
  // held in that project. In the private User context there is no project, so
  // it lists every role the account holds in ANY project; picking one opens
  // the project last used in that role.
  const visibleRoles: UserRole[] = useMemo(() => {
    if (!isPrivateContext) return availableRoles
    const held = userRolesLoaded && userRoles ? userRoles : []
    return [...(["admin", "helper"] as const).filter((r) => held.includes(r)), "user"]
  }, [isPrivateContext, availableRoles, userRolesLoaded, userRoles])

  const goToAddRole = () => {
    if (typeof window !== "undefined") window.location.href = "/onboarding?new=1"
  }

  return {
    user,
    isSignedIn,
    userProjects,
    projectsLoading,
    selectedProjectId,
    selectedProject,
    selectedProjectBranding,
    projectAvailableRoles,
    projectRolesLoaded,
    availableRoles,
    visibleRoles,
    rolesResolved,
    isPrivateContext,
    getRoleDisplayName,
    handleSwitchRole,
    handleProjectSelect,
    goToAddRole,
    signOut,
  }
}
