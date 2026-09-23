import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/**
 * Average response time for a project, in seconds: the gap between a ticket
 * being created and a helper first claiming it or replying to it, whichever
 * came first, averaged over the project's responded-to tickets.
 *
 * Backed by the `get_project_avg_response_time` RPC, which is SECURITY
 * DEFINER so it also works for anonymous visitors on the public support
 * landing page. Resolves to `null` when no ticket in the project has had a
 * response yet.
 */
export function useProjectAverageResponseTime(projectId: string) {
    return useQuery({
        queryKey: ["project-avg-response-time", projectId],
        queryFn: async (): Promise<number | null> => {
            const { data, error } = await supabase.rpc(
                "get_project_avg_response_time",
                { p_project_id: projectId },
            );

            if (error) throw error;
            return typeof data === "number" ? data : null;
        },
        enabled: !!projectId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
