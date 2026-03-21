import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Helper = Database["public"]["Tables"]["projects_helpers"]["Row"];
type HelperInsert = Database["public"]["Tables"]["projects_helpers"]["Insert"];
type HelperUpdate = Database["public"]["Tables"]["projects_helpers"]["Update"];
type UserPublicUpdate = Database["public"]["Tables"]["users_public"]["Update"];

export function useHelpers(projectId?: string) {
    return useQuery({
        queryKey: ["helpers", projectId],
        queryFn: async () => {
            let query = supabase
                .from("projects_helpers")
                .select(
                    `
          *,
          user:users_public(*)
        `,
                )
                .order("created_at", { ascending: false });

            if (projectId) {
                query = query.eq("project_id", projectId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as (Helper & { user: any })[];
        },
        enabled: !!projectId,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useHelper(helperId: string) {
    return useQuery({
        queryKey: ["helper", helperId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projects_helpers")
                .select(
                    `
          *,
          user:users_public(*)
        `,
                )
                .eq("helper_id", helperId)
                .single();

            if (error) throw error;
            return data as Helper & { user: any };
        },
        enabled: !!helperId,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useCreateHelper() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            discord_username: string;
            github_username: string;
            name: string;
            email: string;
            category: string;
            project_id: string;
        }) => {
            // Call the invite-user edge function
            const { data, error } = await supabase.functions.invoke(
                "invite-user",
                {
                    body: payload,
                },
            );

            if (error) throw error;

            if (!data?.success) {
                throw new Error("Failed to invite user");
            }

            // Return the helper record from the response
            // The edge function returns: { success, user_id, user_exists, helper }
            return data.helper as Helper;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["helpers", data.project_id],
            });
        },
    });
}

export function useAddSelfAsHelper() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            project_id: string;
            user_id: string;
            category?: "core" | "extended" | "community";
        }) => {
            const { data, error } = await supabase
                .from("projects_helpers")
                .insert({
                    project_id: payload.project_id,
                    user_id: payload.user_id,
                    category: payload.category ?? "core",
                })
                .select()
                .single();

            if (error) throw error;
            return data as Helper;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["helpers", data.project_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["current-helper", data.project_id],
            });
        },
    });
}

export function useUpdateHelper() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            helperId,
            updates,
        }: {
            helperId: string;
            updates: HelperUpdate;
        }) => {
            const { data, error } = await supabase
                .from("projects_helpers")
                .update(updates)
                .eq("helper_id", helperId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["helper", data.helper_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["helpers", data.project_id],
            });
        },
    });
}

export function useUpdateUserProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            userId,
            updates,
        }: {
            userId: string;
            updates: UserPublicUpdate;
        }) => {
            const { data, error } = await supabase
                .from("users_public")
                .update(updates)
                .eq("id", userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["helper"],
            });
            queryClient.invalidateQueries({
                queryKey: ["helpers"],
            });
        },
    });
}
