import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];
type ProjectResource =
    Database["public"]["Tables"]["projects_resources"]["Row"];
type ProjectResourceInsert =
    Database["public"]["Tables"]["projects_resources"]["Insert"];
type ProjectPaymentSettings =
    Database["public"]["Tables"]["projects_payment_settings"]["Row"];
type ProjectPaymentSettingsInsert =
    Database["public"]["Tables"]["projects_payment_settings"]["Insert"];
type ProjectPaymentSettingsUpdate =
    Database["public"]["Tables"]["projects_payment_settings"]["Update"];
type ProjectBrandingUpdate =
    Database["public"]["Tables"]["projects_branding"]["Update"];

export function useProjects() {
    return useQuery({
        queryKey: ["projects"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as Project[];
        },
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useUserProjects() {
    return useQuery({
        queryKey: ["user-projects"],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: memberData, error: memberError } = await supabase
                .from("projects_members")
                .select("project_id")
                .eq("user_id", user.id)
                .is("deleted_at", null);

            if (memberError) throw memberError;
            if (!memberData || memberData.length === 0) return [];

            const projectIds = memberData.map((m) => m.project_id);

            const { data: projectsData, error: projectsError } = await supabase
                .from("projects")
                .select("*")
                .in("project_id", projectIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectsError) throw projectsError;
            if (!projectsData || projectsData.length === 0) return [];

            return projectsData as Project[];
        },
        staleTime: 1800000,
        refetchOnWindowFocus: true,
    });
}

export function useProject(projectId: string) {
    return useQuery({
        queryKey: ["project", projectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .eq("project_id", projectId)
                .single();

            if (error) throw error;
            return data as Project;
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useProjectBySlug(slug: string) {
    return useQuery({
        queryKey: ["project-by-slug", slug],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .eq("slug", slug)
                .single();

            if (error) throw error;
            return data as Project;
        },
        enabled: !!slug,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useProjectResources(projectId: string) {
    return useQuery({
        queryKey: ["project-resources", projectId],
        queryFn: async () => {
            // First get the project's bigint id

            const { data, error } = await supabase
                .from("projects_resources")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useProjectBranding(projectId: string) {
    return useQuery({
        queryKey: ["project-branding", projectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects_branding")
                .select("*")
                .eq("project_id", projectId)
                .single();

            if (error && error.code !== "PGRST116") throw error; // PGRST116 is "not found"
            return data;
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (project: ProjectInsert) => {
            // Get current user
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                throw new Error(
                    "User must be authenticated to create a project",
                );
            }

            // Determine selected organization for this user, if any
            let selectedOrganizationId: string | null = null;
            const { data: configRow } = await supabase
                .from("organizations_members_config")
                .select("selected_organization_id")
                .eq("id", user.id)
                .maybeSingle();

            if (configRow?.selected_organization_id) {
                selectedOrganizationId = configRow.selected_organization_id;
            } else {
                const { data: memberships } = await supabase
                    .from("organizations_members")
                    .select("organization_id")
                    .eq("id", user.id)
                    .limit(1);

                if (memberships && memberships.length > 0) {
                    selectedOrganizationId = memberships[0]
                        .organization_id as string;
                }
            }

            // Create project with creator as created_by and default organization_id when not provided
            const projectToInsert = {
                ...project,
                organization_id:
                    project.organization_id ?? selectedOrganizationId ?? null,
                created_by: user.id,
            };

            const { data: projectData, error: projectError } = await supabase
                .from("projects")
                .insert(projectToInsert)
                .select()
                .single();

            if (projectError) throw projectError;

            return projectData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["user-projects"] });
            queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
        },
    });
}

export function useUpdateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            updates,
        }: {
            projectId: string;
            updates: ProjectUpdate;
        }) => {
            const { data, error } = await supabase
                .from("projects")
                .update(updates)
                .eq("project_id", projectId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["project", data.project_id],
            });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["user-projects"] });
        },
    });
}

export function useCreateProjectResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            resource,
        }: {
            projectId: string;
            resource: Omit<ProjectResourceInsert, "project_id">;
        }) => {
            const { data, error } = await supabase
                .from("projects_resources")
                .insert({
                    ...resource,
                    project_id: projectId,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-resources", variables.projectId],
            });
        },
    });
}

export function useDeleteProjectResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            resourceId,
        }: {
            projectId: string;
            resourceId: number;
        }) => {
            const { error } = await supabase
                .from("projects_resources")
                .delete()
                .eq("id", resourceId);

            if (error) throw error;
            return { id: resourceId };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-resources", variables.projectId],
            });
        },
    });
}

export function useProjectPaymentSettings(projectId: string) {
    return useQuery({
        queryKey: ["project-payment-settings", projectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects_payment_settings")
                .select("*")
                .eq("project_id", projectId)
                .single();

            if (error && error.code !== "PGRST116") throw error; // PGRST116 is "not found"
            return data;
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useUpdateProjectPaymentSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            updates,
        }: {
            projectId: string;
            updates: ProjectPaymentSettingsUpdate;
        }) => {
            const { data, error } = await supabase
                .from("projects_payment_settings")
                .update(updates)
                .eq("project_id", projectId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-payment-settings", variables.projectId],
            });
        },
    });
}

export function useUpdateProjectBranding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            updates,
        }: {
            projectId: string;
            updates: ProjectBrandingUpdate;
        }) => {
            // First check if branding exists
            const { data: existing } = await supabase
                .from("projects_branding")
                .select("*")
                .eq("project_id", projectId)
                .single();

            let data;
            if (existing) {
                // Update existing
                const { data: updated, error } = await supabase
                    .from("projects_branding")
                    .update(updates)
                    .eq("project_id", projectId)
                    .select()
                    .single();

                if (error) throw error;
                data = updated;
            } else {
                // Insert new
                const { data: inserted, error } = await supabase
                    .from("projects_branding")
                    .insert({
                        project_id: projectId,
                        ...updates,
                    })
                    .select()
                    .single();

                if (error) throw error;
                data = inserted;
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-branding", variables.projectId],
            });
        },
    });
}

type ProjectInvite = Database["public"]["Tables"]["projects_invites"]["Row"];

export function useCreateProjectInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            project_id: string;
            invite_type: "member" | "helper";
            category?: "core" | "extended" | "community";
            email?: string;
            github_username?: string;
            invitee_identifier?: string;
            expires_at?: string;
            max_uses?: number;
        }) => {
            const { data, error } = await supabase.functions.invoke(
                "create-project-invite",
                {
                    body: payload,
                },
            );

            if (error) throw error;

            if (!data?.success) {
                throw new Error(data?.error || "Failed to create invite");
            }

            return data.invite as ProjectInvite & { invite_url: string };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-invites", variables.project_id],
            });
        },
    });
}

export function useListProjectInvites(
    projectId?: string,
    inviteType?: "member" | "helper",
) {
    return useQuery({
        queryKey: ["project-invites", projectId, inviteType],
        queryFn: async () => {
            if (!projectId) return [];

            let query = supabase
                .from("projects_invites")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (inviteType) {
                query = query.eq("invite_type", inviteType);
            }

            const { data: invites, error } = await query;

            if (error) throw error;

            const baseUrl =
                (typeof window !== "undefined" && window.location?.origin) ||
                process.env.NEXT_PUBLIC_SITE_URL ||
                "https://githelp.app";

            return (invites || []).map((invite) => ({
                ...invite,
                invite_url: `${baseUrl}/invite/${invite.token}`,
            })) as Array<ProjectInvite & { invite_url: string }>;
        },
        enabled: !!projectId,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useRevokeProjectInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            invite_id: string;
            project_id: string;
        }) => {
            const { data, error } = await supabase.functions.invoke(
                "revoke-project-invite",
                {
                    body: payload,
                },
            );

            if (error) throw error;

            if (!data?.success) {
                throw new Error(data?.error || "Failed to revoke invite");
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["project-invites", variables.project_id],
            });
        },
    });
}

export type GitHubRepoItem = {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    owner: string;
    owner_type: string;
    private: boolean;
};

export type RepoContributor = {
    login: string;
    id: number;
    avatar_url: string;
    contributions: number;
    html_url: string;
};

export function useListRepoContributors(
    providerToken: string | null,
    fullName: string | null
) {
    return useQuery({
        queryKey: ["repo-contributors", fullName, providerToken],
        queryFn: async () => {
            if (!providerToken || !fullName) return [];
            const { data, error } = await supabase.functions.invoke(
                "list-repo-contributors",
                {
                    body: {
                        provider_token: providerToken,
                        full_name: fullName,
                    },
                }
            );
            if (error) throw error;
            return (data?.items ?? []) as RepoContributor[];
        },
        enabled: !!providerToken && !!fullName,
        staleTime: 60000,
    });
}

export function useGetProjectRepo(projectId: string | null) {
    return useQuery({
        queryKey: ["project-repo", projectId],
        queryFn: async () => {
            if (!projectId) return null;
            const { data, error } = await supabase.functions.invoke(
                "get-project-repo",
                { body: { project_id: projectId } }
            );
            if (error) throw error;
            return data?.full_name as string | null;
        },
        enabled: !!projectId,
        staleTime: 60000,
    });
}

export function useListUserGithubRepos(providerToken: string | null) {
    return useQuery({
        queryKey: ["user-github-repos", providerToken],
        queryFn: async () => {
            if (!providerToken) return [];
            const { data, error } = await supabase.functions.invoke(
                "list-user-github-repos",
                { body: { provider_token: providerToken } }
            );
            if (error) throw error;
            return (data?.items ?? []) as GitHubRepoItem[];
        },
        enabled: !!providerToken,
        staleTime: 60000,
    });
}

export type ContributedProjectItem = {
    project_id: string;
    name: string;
    slug: string;
    repo_full_name: string;
};

export function useListContributedProjects(providerToken: string | null) {
    return useQuery({
        queryKey: ["user-contributed-projects", providerToken],
        queryFn: async () => {
            if (!providerToken) return [];
            const { data, error } = await supabase.functions.invoke(
                "list-user-contributed-projects",
                { body: { provider_token: providerToken } }
            );
            if (error) throw error;
            return (data?.items ?? []) as ContributedProjectItem[];
        },
        enabled: !!providerToken,
        staleTime: 60000,
    });
}

export function useCreateProjectFromGitHub() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            github_repo_id: number;
            repo?: { id: number; name: string; full_name: string; html_url: string; owner: { login: string; type: string } };
        }) => {
            const { data, error } = await supabase.functions.invoke(
                "create-project-from-github",
                { body: payload }
            );
            if (error) throw error;
            if (!data?.success) {
                throw new Error(data?.error || "Failed to create project from GitHub");
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["user-projects"] });
            queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
        },
    });
}

export function useAcceptProjectInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (token: string) => {
            const { data, error } = await supabase.functions.invoke(
                "accept-project-invite",
                {
                    body: { token },
                },
            );

            if (error) throw error;

            if (!data?.success) {
                throw new Error(data?.error || "Failed to accept invite");
            }

            return data;
        },
        onSuccess: (data) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["user-projects"] });
            queryClient.invalidateQueries({
                queryKey: ["project", data.project_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["helpers", data.project_id],
            });
            queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
        },
    });
}
