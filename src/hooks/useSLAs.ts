import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type SLA = Database["public"]["Tables"]["slas"]["Row"];
type SLAInsert = Database["public"]["Tables"]["slas"]["Insert"];
type SLAUpdate = Database["public"]["Tables"]["slas"]["Update"];

export function useSLAs(projectId?: string) {
    return useQuery({
        queryKey: ["slas", projectId],
        queryFn: async () => {
            let query = supabase
                .from("slas")
                .select("*")
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectId) {
                query = query.eq("project_id", projectId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as SLA[];
        },
        enabled: !!projectId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useSLA(slaId: string) {
    return useQuery({
        queryKey: ["sla", slaId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("slas")
                .select("*")
                .eq("id", slaId)
                .single();

            if (error) throw error;
            return data as SLA;
        },
        enabled: !!slaId,
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

export function useCreateSLA() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sla: SLAInsert) => {
            const { data, error } = await supabase
                .from("slas")
                .insert(sla)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["slas", data.project_id],
            });
        },
    });
}

export function useUpdateSLA() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: SLAUpdate;
        }) => {
            const { data, error } = await supabase
                .from("slas")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["sla", data.id] });
            queryClient.invalidateQueries({
                queryKey: ["slas", data.project_id],
            });
        },
    });
}
