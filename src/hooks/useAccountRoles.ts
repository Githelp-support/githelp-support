import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { UserRole } from "@/contexts/user-context"

/**
 * Query options shared by `useAccountRoles` and imperative
 * `queryClient.fetchQuery` calls, so both hit the same cache entry.
 *
 * Mirrors `projectAvailableRolesQueryOptions` (src/hooks/useProjectRole.ts)
 * but account-wide: no `project_id` filter, so the result reflects every
 * role the signed-in user holds across all projects.
 */
export function accountRolesQueryOptions() {
    return {
        queryKey: ["account-roles"] as const,
        queryFn: async (): Promise<UserRole[]> => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const [
                { data: memberRows },
                { data: helperData },
                { data: ticketData },
            ] = await Promise.all([
                supabase
                    .from("projects_members")
                    .select("role")
                    .eq("user_id", user.id)
                    .is("deleted_at", null),
                supabase
                    .from("projects_helpers")
                    .select("helper_id")
                    .eq("user_id", user.id)
                    .is("deleted_at", null)
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from("tickets")
                    .select("id")
                    .eq("created_by", user.id)
                    .is("deleted_at", null)
                    .limit(1)
                    .maybeSingle(),
            ])

            const members: Array<{ role: string }> = memberRows ?? []

            // Ordered highest → lowest so callers can take roles[0] as the top role.
            const roles: UserRole[] = []
            if (members.some((m) => m.role === "admin")) roles.push("admin")
            if (helperData) roles.push("helper")
            // "user" only if the account has ever acted as a support user:
            // a non-admin membership in any project, or existing support
            // usage (a ticket they created).
            const hasActedAsUser =
                members.some((m) => m.role !== "admin") || !!ticketData
            if (hasActedAsUser) roles.push("user")
            return roles
        },
        staleTime: 1800000,
    }
}

/**
 * Gets the account-wide roles the signed-in user holds across all projects:
 * "admin" if they are an admin member of any project, "helper" if they are a
 * helper in any project, and "user" if the account has ever acted as a
 * support user (non-admin membership or existing support usage).
 *
 * Returns roles ordered admin > helper > user.
 */
export function useAccountRoles() {
    return useQuery({
        ...accountRolesQueryOptions(),
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })
}
