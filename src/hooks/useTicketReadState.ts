import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Functions = Database["public"]["Functions"];
type MarkTicketReadArgs = Functions["mark_ticket_read"]["Args"];
type UnreadFlagRow = Functions["ticket_unread_flags"]["Returns"][number];

/** How often an open, visible chat re-reports itself as read/open. */
export const TICKET_READ_HEARTBEAT_MS = 30_000;

/** Query-key root for unread flags; invalidate this to refresh every list. */
export const TICKET_UNREAD_QUERY_KEY = ["ticket-unread"] as const;

/** Queries that show unread state and must refresh once a ticket is read. */
const INVALIDATE_ON_READ: readonly (readonly string[])[] = [
    TICKET_UNREAD_QUERY_KEY,
    // useNotifications
    ["notifications"],
    // Sidebar "Active tickets" (helper and customer) and recent interactions
    ["helper-claimed-tickets-sidebar"],
    ["user-active-tickets-sidebar"],
    ["helper-recent-ticket-interactions"],
];

async function callMarkTicketRead(args: MarkTicketReadArgs): Promise<void> {
    const { error } = await supabase.rpc("mark_ticket_read", args);
    if (error) throw error;
}

/**
 * Unread flag per ticket for the current user, via `ticket_unread_flags`.
 * Keyed on the sorted ids so the same set in any order shares a cache entry.
 * Tickets the RPC doesn't return are absent from the map (treat as read).
 */
export function useTicketUnreadFlags(ticketIds: readonly string[] | null | undefined) {
    const sortedIds = useMemo(
        () => Array.from(new Set(ticketIds ?? [])).sort(),
        [ticketIds],
    );

    return useQuery({
        queryKey: [...TICKET_UNREAD_QUERY_KEY, sortedIds],
        enabled: sortedIds.length > 0,
        queryFn: async (): Promise<Map<string, boolean>> => {
            const { data, error } = await supabase.rpc("ticket_unread_flags", {
                p_ticket_ids: sortedIds,
            });
            if (error) throw error;
            const flags = new Map<string, boolean>();
            for (const row of (data ?? []) as UnreadFlagRow[]) {
                flags.set(row.ticket_id, Boolean(row.has_unread));
            }
            return flags;
        },
    });
}

/**
 * Marks a ticket read up to `latestMessageId` while the chat is shown.
 *
 * - Calls `mark_ticket_read` whenever the ticket or latest message changes
 *   (and `enabled` is true). A message id that was already marked for the
 *   same ticket is not sent again.
 * - On success it invalidates the unread flags, notifications and sidebar
 *   ticket queries.
 * - Heartbeat: while enabled and the tab is visible, re-calls the RPC every
 *   `TICKET_READ_HEARTBEAT_MS` (and right away when the tab becomes visible
 *   again), so the backend knows the chat is open. Heartbeats don't
 *   invalidate anything; they only report presence. Failures are ignored.
 */
export function useMarkTicketRead(
    ticketId: string | null | undefined,
    latestMessageId: string | null | undefined,
    { enabled = true }: { enabled?: boolean } = {},
) {
    const queryClient = useQueryClient();
    /** `${ticketId}:${messageId}` last marked successfully, or in flight. */
    const markedKeyRef = useRef<string | null>(null);
    const latestMessageIdRef = useRef<string | null>(latestMessageId ?? null);
    useEffect(() => {
        latestMessageIdRef.current = latestMessageId ?? null;
    }, [latestMessageId]);

    const mutation = useMutation({
        mutationFn: callMarkTicketRead,
        onSuccess: () => {
            for (const queryKey of INVALIDATE_ON_READ) {
                void queryClient.invalidateQueries({ queryKey });
            }
        },
    });
    const { mutate } = mutation;

    const mark = useCallback(
        (tid: string, messageId: string) => {
            const key = `${tid}:${messageId}`;
            if (markedKeyRef.current === key) return;
            markedKeyRef.current = key;
            mutate(
                { p_ticket_id: tid, p_message_id: messageId },
                {
                    onError: () => {
                        // Allow a retry the next time the inputs settle.
                        if (markedKeyRef.current === key) markedKeyRef.current = null;
                    },
                },
            );
        },
        [mutate],
    );

    useEffect(() => {
        if (!enabled || !ticketId || !latestMessageId) return;
        mark(ticketId, latestMessageId);
    }, [enabled, ticketId, latestMessageId, mark]);

    useEffect(() => {
        if (!enabled || !ticketId) return;

        const beat = () => {
            if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
            void callMarkTicketRead({
                p_ticket_id: ticketId,
                p_message_id: latestMessageIdRef.current,
            }).catch(() => {
                // Heartbeat is best effort.
            });
        };
        const interval = setInterval(beat, TICKET_READ_HEARTBEAT_MS);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") beat();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [enabled, ticketId]);

    return mutation;
}

/** A sidebar list item before its unread dot is known. */
interface UnreadCandidate {
    id: string;
    /** The ticket open in the chat: it is being read, so never shows a dot. */
    current: boolean;
}

/**
 * Wraps a sidebar query whose items lack `hasNotification` and fills it from
 * `useTicketUnreadFlags`: `hasNotification = flag && !item.current`. The
 * server decides what counts as unread (automatic, system and own messages
 * never do), so there's no client-side message comparison.
 */
export function useQueryWithUnreadFlags<
    TData extends { items: UnreadCandidate[] },
    TQuery extends { data: TData | undefined },
>(query: TQuery & { data: TData | undefined }): Omit<TQuery, "data"> & {
    data:
        | (Omit<TData, "items"> & {
              items: (TData["items"][number] & { hasNotification: boolean })[];
          })
        | undefined;
} {
    const ticketIds = useMemo(() => query.data?.items.map((item) => item.id) ?? [], [query.data]);
    const { data: flags } = useTicketUnreadFlags(ticketIds);

    const data = useMemo(() => {
        if (!query.data) return undefined;
        return {
            ...query.data,
            items: query.data.items.map((item) => ({
                ...item,
                hasNotification: !!flags?.get(item.id) && !item.current,
            })),
        };
    }, [query.data, flags]);

    return { ...query, data };
}
