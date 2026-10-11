import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface Notification {
    id: string;
    title: string;
    content: string;
    route: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    metadata: {
        type?: string;
        [key: string]: any;
    } | null;
}

export const NOTIFICATION_TYPES = [
    "HELPER_REQUEST",
    "NEW_PAYOUT",
    "SUPPORT_TICKET",
    "TICKET_MESSAGE",
    "PAYMENT_REQUIRED",
    "INFO",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// metadata.type is the canonical discriminator (see
// docs/superpowers/specs/2026-07-02-notifications-design.md); unknown or
// missing values render as INFO.
export function notificationType(notification: Notification): NotificationType {
    const type = notification.metadata?.type;
    return NOTIFICATION_TYPES.includes(type as NotificationType)
        ? (type as NotificationType)
        : "INFO";
}

export function useNotifications() {
    return useQuery({
        queryKey: ["notifications"],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as Notification[];
        },
        retry: false,
        staleTime: 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: string) => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", notificationId)
                .eq("user_id", user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", user.id)
                .eq("is_read", false);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}
