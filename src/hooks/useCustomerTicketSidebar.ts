import { useMemo } from "react";
import { useTicketParticipants, type ParticipantWithUser } from "@/hooks/useTicketParticipants";
import {
    useTimeEntries,
    timeMillisecondsToHoursMinutes,
    getTimeEntryReviewStatus,
    isBillableTimeEntry,
    type TimeEntryReviewStatus,
} from "@/hooks/useTimeEntries";
import type { TicketChatTimeEntryReview } from "@/components/ticket-chat/ticket-chat";
import { useUserActiveTicketsSidebar } from "@/hooks/useTicketsWithDetails";
import type { TicketChatParticipant } from "@/components/ticket-chat/ticket-chat";

export interface CustomerTimeEntryDisplay {
    id: string;
    type: string;
    date: string;
    hours: number;
    minutes: number;
    note?: string;
    reviewStatus: TimeEntryReviewStatus;
    declineReason?: string | null;
    autoAccepted?: boolean;
}

/**
 * Everything the customer-facing ticket chat needs for its right sidebar
 * ("People in this chat", "Logged time", "Active tickets"). Shared by
 * `/support` (Get support tab) and `/support/chat` so both entry points show
 * the same thing.
 *
 * Signed-in vs. anonymous:
 *  - `userId` is undefined for a visitor who opened a ticket without signing
 *    in. Their ticket has `created_by = null` and no participant row, so they
 *    never appear in the participant list themselves; the helper still does
 *    once they claim. Active tickets are only fetched for signed-in users
 *    (there is nothing to look up without a user id), and time entries are
 *    RLS-restricted to authenticated users so an anonymous visitor simply gets
 *    an empty list.
 *  - Callers should still gate the *rendering* of the Logged time / Active
 *    tickets footer on being signed in; this hook only fetches.
 */
export function useCustomerTicketSidebar(
    ticketId: string | undefined,
    userId: string | undefined,
    activeTicketsLimit = 3
) {
    const { data: participants, isLoading: participantsLoading } = useTicketParticipants(
        ticketId ?? ""
    );

    const { data: timeEntriesFromDb = [] } = useTimeEntries(
        ticketId ? { ticketId } : undefined,
        { enabled: !!ticketId && !!userId }
    );

    const { data: activeTicketsSidebarData } = useUserActiveTicketsSidebar(
        userId,
        ticketId || undefined,
        activeTicketsLimit
    );

    const claimer = useMemo(
        () => participants?.find((p) => p.claimed)?.user,
        [participants]
    );

    const { timeEntriesDisplay, totalLoggedFormatted, timeEntryReviews, pendingReviewCount } = useMemo(() => {
        const reviews: Record<string, TicketChatTimeEntryReview> = {};
        const entries: CustomerTimeEntryDisplay[] = timeEntriesFromDb.map((entry) => {
            const { hours, minutes } = timeMillisecondsToHoursMinutes(entry.time_milliseconds);
            const reviewStatus = getTimeEntryReviewStatus(entry);
            reviews[entry.id] = {
                status: reviewStatus,
                declineReason: entry.decline_reason ?? null,
                reviewRequestedAt: entry.review_requested_at ?? null,
                autoAccepted: entry.auto_accepted ?? false,
            };
            return {
                id: entry.id,
                type: entry.type,
                date: entry.date,
                hours,
                minutes,
                note: entry.note ?? undefined,
                reviewStatus,
                declineReason: entry.decline_reason ?? null,
                autoAccepted: entry.auto_accepted ?? false,
            };
        });
        // Declined entries stay listed (with their status) but don't count.
        const totalMs = timeEntriesFromDb
            .filter(isBillableTimeEntry)
            .reduce((sum, e) => sum + e.time_milliseconds, 0);
        const totalMins = Math.floor(totalMs / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return {
            timeEntriesDisplay: entries,
            totalLoggedFormatted: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`,
            timeEntryReviews: reviews,
            pendingReviewCount: entries.filter((e) => e.reviewStatus === "pending").length,
        };
    }, [timeEntriesFromDb]);

    return {
        participants,
        participantsLoading,
        claimer,
        timeEntriesDisplay,
        totalLoggedFormatted,
        /** Review state per entry id, for the Accept / Decline actions in the chat. */
        timeEntryReviews,
        pendingReviewCount,
        activeTicketsSidebar: activeTicketsSidebarData?.items ?? [],
        activeTicketsCount: activeTicketsSidebarData?.activeCount ?? 0,
    };
}

/**
 * Participant rows → the shape `TicketChat` renders under "People in this chat".
 * If the ticket creator has no participant row (older tickets, or a creator
 * profile we know from the ticket itself) pass `creator` so they're still listed.
 */
export function toChatParticipants(
    participants: ParticipantWithUser[] | undefined,
    currentUserId: string | undefined,
    creator?: { id: string; name?: string | null; avatar_url?: string | null } | null
): TicketChatParticipant[] {
    const list: ParticipantWithUser[] = [...(participants ?? [])];
    if (creator?.id && !list.some((p) => p.participant_id === creator.id)) {
        list.push({
            id: `creator-${creator.id}`,
            participant_id: creator.id,
            claimed: false,
            created_at: "",
            user: {
                id: creator.id,
                name: creator.name ?? "Unknown",
                avatar_url: creator.avatar_url ?? null,
            },
        });
    }
    return list.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        avatarInitial: p.user.name?.[0]?.toUpperCase() ?? "U",
        avatarUrl: p.user.avatar_url ?? null,
        isCurrentUser: !!currentUserId && p.participant_id === currentUserId,
    }));
}
