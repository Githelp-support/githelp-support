import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export type PreferenceChannel = "in_app" | "email" | "slack" | "discord" | "webhook";
export type PreferenceEventGroup = "tickets" | "messages" | "payments" | "membership" | "digest";

export interface NotificationPreference {
    id: string;
    user_id: string;
    project_id: string | null;
    channel: PreferenceChannel;
    event_group: PreferenceEventGroup;
    enabled: boolean;
    digest_frequency: "daily" | "weekly" | null;
}

export function useNotificationPreferences() {
    return useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from("notification_preferences")
                .select("*")
                .eq("user_id", user.id);

            if (error) throw error;
            return (data || []) as NotificationPreference[];
        },
        retry: false,
        staleTime: 60_000,
    });
}

export interface PreferenceToggle {
    channel: PreferenceChannel;
    event_group: PreferenceEventGroup;
    enabled: boolean;
}

/**
 * Persist a set of GLOBAL (project_id null) preference toggles. Existing rows
 * are updated in place, missing ones inserted — no upsert, so we don't depend
 * on on_conflict inference against the nulls-not-distinct index.
 */
export function useSaveNotificationPreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (toggles: PreferenceToggle[]) => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: existingRows, error: fetchError } = await supabase
                .from("notification_preferences")
                .select("id, channel, event_group")
                .eq("user_id", user.id)
                .is("project_id", null);
            if (fetchError) throw fetchError;

            const existing = new Map(
                (existingRows || []).map((row) => [`${row.channel}:${row.event_group}`, row.id]),
            );

            for (const toggle of toggles) {
                const id = existing.get(`${toggle.channel}:${toggle.event_group}`);
                if (id) {
                    const { error } = await supabase
                        .from("notification_preferences")
                        .update({ enabled: toggle.enabled, updated_at: new Date().toISOString() })
                        .eq("id", id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from("notification_preferences").insert({
                        user_id: user.id,
                        project_id: null,
                        channel: toggle.channel,
                        event_group: toggle.event_group,
                        enabled: toggle.enabled,
                    });
                    if (error) throw error;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
        },
    });
}
