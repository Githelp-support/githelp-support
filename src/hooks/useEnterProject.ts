import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUser, type UserRole } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { projectAvailableRolesQueryOptions } from "@/hooks/useProjectRole"

/**
 * Make a project the user just created or joined the active one, and switch
 * them into the highest role they hold there (admin > helper > user). The
 * active role is sticky (saved in localStorage), so without this a user who
 * was last acting as helper stays a helper in a project they just created.
 *
 * Returns that role so the caller can route to its home page.
 * `fallbackRole` is used when the roles lookup fails — pass "admin" for
 * projects the user created (the creator is always added as admin member).
 */
export function useEnterProject() {
  const queryClient = useQueryClient()
  const { switchRole } = useUser()
  const { setSelectedProjectId } = useProjectSelection()

  return useCallback(
    async (projectId: string, fallbackRole: UserRole = "user"): Promise<UserRole> => {
      // ProjectProvider drops any selection that isn't in the loaded project
      // list, so wait for the list to include the new project before
      // selecting it.
      try {
        await queryClient.refetchQueries({ queryKey: ["user-projects"] })
      } catch (err) {
        console.error("Failed to refresh user projects:", err)
      }
      setSelectedProjectId(projectId)

      // Roles come back ordered admin > helper > user. staleTime 0 forces a
      // fresh read since membership just changed.
      let nextRole: UserRole = fallbackRole
      try {
        const roles = await queryClient.fetchQuery({
          ...projectAvailableRolesQueryOptions(projectId),
          staleTime: 0,
        })
        nextRole = roles[0] ?? fallbackRole
      } catch (err) {
        console.error("Failed to resolve roles for project:", err)
      }
      // Always persist, even if it matches the in-memory role: a stale saved
      // role in localStorage would otherwise win on the next project-role sync.
      switchRole(nextRole)
      return nextRole
    },
    [queryClient, switchRole, setSelectedProjectId]
  )
}
