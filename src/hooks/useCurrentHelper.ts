import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useCurrentHelper(projectId?: string) {
    return useQuery({
        queryKey: ["current-helper", projectId],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || !projectId) return null;

            const { data, error } = await supabase
                .from("projects_helpers")
                .select("helper_id")
                .eq("user_id", user.id)
                .eq("project_id", projectId)
                .limit(1)
                .single();

            if (error) {
                // Helper might not exist, return null
                if (error.code === "PGRST116") return null;
                throw error;
            }

            return data?.helper_id || null;
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}
