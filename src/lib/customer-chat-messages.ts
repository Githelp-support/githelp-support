import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";
import type { TicketPaymentStatus } from "@/hooks/useTicketPaymentStatus";

/**
 * Message-thread building shared by the two customer-facing chat pages
 * (`/support` Get support tab and `/support/chat`) so they render the same
 * thread for the same ticket.
 */

/** Grey system bubble at the top of every customer thread. */
export const TICKET_DISCLAIMER =
    "You are not charged anything before both you and the helper have confirmed the ticket. Feel free to chat and clarify details before you confirm.";

/** dd/mm/yyyy, hh:mm — the timestamp format used throughout the chat UI. */
export function formatChatTimestamp(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Row shape returned by `useTicketMessages` (only the fields we read). */
export interface PersistedTicketMessage {
    id: string;
    content: string;
    created_at: string;
    sender_type: string;
    sender_id?: string | null;
    metadata?: Record<string, unknown> | null;
    sender?: { id?: string; name?: string | null; avatar_url?: string | null } | null;
}

export interface CustomerThreadOptions {
    projectName: string;
    projectLogo: string | null;
    /** Timestamp for synthetic (non-persisted) messages. */
    nowFormatted: string;
    messagesData: PersistedTicketMessage[] | undefined;
    /** The helper who claimed the ticket, if any → "Ticket is claimed by …" banner. */
    claimer?: { id: string; name: string; avatar_url: string | null } | null;
    /**
     * The customer's first message when it isn't in the DB yet (race right
     * after creation) or was never persisted (anonymous creator). Shown until
     * a persisted user message exists.
     */
    pendingFirstMessage?: string | null;
    /** Fallback for the first message when reopening a ticket (its description). */
    fallbackDescription?: string | null;
    /** Timestamp for the fallback first message (ticket created_at). */
    fallbackTimestamp?: string | null;
    currentUser: { id?: string; name?: string | null; avatarUrl?: string | null };
}

/**
 * Disclaimer → claimed banner → (pending first message) → persisted messages.
 * Callers append page-specific trailing messages (e.g. the session summary).
 */
export function buildCustomerThreadMessages(opts: CustomerThreadOptions): TicketChatMessage[] {
    const {
        projectName,
        projectLogo,
        nowFormatted,
        messagesData,
        claimer,
        pendingFirstMessage,
        fallbackDescription,
        fallbackTimestamp,
        currentUser,
    } = opts;

    const userName = currentUser.name || "You";
    const userInitial = userName[0]?.toUpperCase() || "Y";

    const list: TicketChatMessage[] = [
        {
            id: "welcome",
            senderType: "system",
            content: TICKET_DISCLAIMER,
            senderName: `${projectName} Team`,
            senderAvatarUrl: projectLogo,
            timestamp: nowFormatted,
        },
    ];

    if (claimer) {
        list.push({
            id: "system-claimed",
            senderType: "system",
            content: `Ticket is claimed by ${claimer.name}`,
            senderName: claimer.name || "Helper",
            senderAvatarInitial: claimer.name?.[0]?.toUpperCase() || "H",
            senderAvatarUrl: claimer.avatar_url ?? null,
            senderId: claimer.id,
            timestamp: nowFormatted,
            // kind="claimed" switches TicketChat to the helper-avatar banner layout.
            kind: "claimed",
        });
    }

    const hasPersistedUserMessage = !!messagesData?.some((m) => m.sender_type === "user");
    const firstMessageFallback = pendingFirstMessage || fallbackDescription || null;
    if (!hasPersistedUserMessage && firstMessageFallback) {
        list.push({
            id: "pending-first",
            senderType: "user",
            content: firstMessageFallback,
            senderName: userName,
            senderAvatarInitial: userInitial,
            senderAvatarUrl: currentUser.avatarUrl ?? null,
            senderId: currentUser.id,
            timestamp: fallbackTimestamp ? formatChatTimestamp(fallbackTimestamp) : nowFormatted,
        });
    }

    messagesData?.forEach((msg) => {
        const senderType: TicketChatMessage["senderType"] =
            msg.sender_type === "user" ? "user" : msg.sender_type === "helper" ? "helper" : "system";
        list.push({
            id: msg.id,
            senderType,
            content: msg.content,
            senderName:
                msg.sender?.name ||
                (senderType === "user" ? userName : senderType === "helper" ? "Helper" : `${projectName} Team`),
            senderAvatarInitial:
                msg.sender?.name?.[0]?.toUpperCase() || (senderType === "user" ? userInitial : "H"),
            senderAvatarUrl: msg.sender?.avatar_url ?? null,
            senderId: msg.sender_id ?? msg.sender?.id ?? null,
            timestamp: formatChatTimestamp(msg.created_at),
            // Payment system messages (payment_required, payment_requires_action,
            // payment_authorized, …) carry their kind + ticket_id here; TicketChat
            // renders the "Add payment method" CTA from it.
            paymentMetadata: (msg.metadata as TicketChatMessage["paymentMetadata"]) ?? null,
        });
    });

    return list;
}

/** What the customer was charged, for the end-of-session summary. */
export function describeChargedLine(opts: {
    cancelled: boolean;
    slaCovered: boolean;
    paymentStatus: TicketPaymentStatus;
    capturedAmountSmallestUnit: number | null;
}): string {
    if (opts.cancelled) return "No charge";
    if (opts.slaCovered) return "Covered by your SLA";
    if (opts.paymentStatus === "distributing" || opts.paymentStatus === "completed") {
        return opts.capturedAmountSmallestUnit != null
            ? `$${(opts.capturedAmountSmallestUnit / 100).toFixed(2)}`
            : "Charged";
    }
    if (opts.paymentStatus === "failed") return "Payment could not be processed";
    return "Processing…";
}

/**
 * "Session ended" summary appended once the helper closes the ticket.
 * kind:undefined keeps it on the standard system-bubble render path.
 */
export function buildSessionEndedMessage(opts: {
    cancelled: boolean;
    totalLoggedFormatted: string;
    chargedLine: string;
}): TicketChatMessage {
    return {
        id: "session-summary",
        senderType: "system",
        senderName: null,
        senderAvatarInitial: null,
        senderId: null,
        timestamp: "",
        content: [
            "**Session ended**",
            "",
            `The helper has ended this session — ${opts.cancelled ? "they were not able to help" : "marked as resolved"}.`,
            "",
            `- **Outcome:** ${opts.cancelled ? "Not able to help" : "Resolved"}`,
            `- **Time logged:** ${opts.totalLoggedFormatted}`,
            `- **Amount charged:** ${opts.chargedLine}`,
        ].join("\n"),
        kind: undefined,
        paymentMetadata: null,
    };
}

/** The pending SCA prompt carried by a `payment_requires_action` system message, if any. */
export function findPendingSca(
    messages: TicketChatMessage[],
    handledMessageId: string | null
): { messageId: string; clientSecret: string; ticketId?: string } | null {
    const scaMsg = messages.find((m) => m.paymentMetadata?.kind === "payment_requires_action");
    if (!scaMsg || scaMsg.id === handledMessageId) return null;
    const clientSecret = scaMsg.paymentMetadata?.client_secret as string | undefined;
    if (!clientSecret) return null;
    return {
        messageId: scaMsg.id,
        clientSecret,
        ticketId: scaMsg.paymentMetadata?.ticket_id as string | undefined,
    };
}
