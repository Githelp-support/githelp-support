import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export type ChannelScope = "project" | "user";
export type ChannelType = "slack_webhook" | "discord_webhook" | "generic_webhook";

export interface NotificationChannel {
    id: string;
    type: ChannelType;
    name: string;
    webhook_url_masked: string;
    event_groups: string[];
    enabled: boolean;
    created_at: string;
}

async function invokeChannels<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke("notification-channels", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as T;
}

function scopeBody(scope: ChannelScope, projectId?: string | null) {
    return scope === "project" ? { scope, project_id: projectId } : { scope };
}

export function useNotificationChannels(scope: ChannelScope, projectId?: string | null) {
    return useQuery({
        queryKey: ["notification-channels", scope, projectId ?? null],
        queryFn: async () => {
            const data = await invokeChannels<{ channels: NotificationChannel[] }>({
                action: "list",
                ...scopeBody(scope, projectId),
            });
            return data.channels;
        },
        enabled: scope === "user" || Boolean(projectId),
        retry: false,
        staleTime: 60_000,
    });
}

export interface CreateChannelInput {
    type: ChannelType;
    name: string;
    webhook_url: string;
    event_groups: string[];
}

export function useCreateNotificationChannel(scope: ChannelScope, projectId?: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateChannelInput) =>
            invokeChannels<{ channel: NotificationChannel; signing_secret?: string }>({
                action: "create",
                ...scopeBody(scope, projectId),
                ...input,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-channels", scope, projectId ?? null] });
        },
    });
}

export function useUpdateNotificationChannel(scope: ChannelScope, projectId?: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { channel_id: string; enabled?: boolean; name?: string; event_groups?: string[] }) =>
            invokeChannels<{ channel: NotificationChannel }>({
                action: "update",
                ...scopeBody(scope, projectId),
                ...input,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-channels", scope, projectId ?? null] });
        },
    });
}

export function useDeleteNotificationChannel(scope: ChannelScope, projectId?: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (channelId: string) =>
            invokeChannels<{ success: boolean }>({
                action: "delete",
                ...scopeBody(scope, projectId),
                channel_id: channelId,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-channels", scope, projectId ?? null] });
        },
    });
}

export function useTestNotificationChannel(scope: ChannelScope, projectId?: string | null) {
    return useMutation({
        mutationFn: (channelId: string) =>
            invokeChannels<{ success: boolean; error?: string }>({
                action: "test",
                ...scopeBody(scope, projectId),
                channel_id: channelId,
            }),
    });
}
