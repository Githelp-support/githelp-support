import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";
import { formatDateTime } from "./format";
import type { TicketPaymentStatus } from "@/hooks/useTicketPaymentStatus";
import { parseWelcomeRates, type TicketRates } from "@/lib/ticket-pricing";
import { guestLabel } from "@/lib/guest-label";

/**
 * Message-thread building shared by the two customer-facing chat pages
 * (`/support` Get support tab and `/support/chat`) so they render the same
 * thread for the same ticket.
 */

/**
 * Guest-ticket system messages (migration 20261029150000_guest_tickets):
 * `visitor_left` is posted by the cron that closes a guest ticket nobody has
 * seen for 15 minutes; `guest_signed_in` by adopt-guest-tickets when the
 * visitor signs in. The stored text is generic, so each side gets its own copy.
 */
export const VISITOR_LEFT_CUSTOMER_COPY = "This conversation was closed because you left before signing in.";
export const VISITOR_LEFT_HELPER_COPY = "The visitor left before signing in.";
export const GUEST_SIGNED_IN_CUSTOMER_COPY = "You signed in — this conversation is now linked to your account.";
export const GUEST_SIGNED_IN_HELPER_COPY = "The visitor signed in — you can claim this ticket now.";

/** Side-specific copy for a guest system message, or null for any other kind. */
export function guestSystemMessageCopy(kind: unknown, audience: "customer" | "helper"): string | null {
    if (kind === "visitor_left") return audience === "customer" ? VISITOR_LEFT_CUSTOMER_COPY : VISITOR_LEFT_HELPER_COPY;
    if (kind === "guest_signed_in") return audience === "customer" ? GUEST_SIGNED_IN_CUSTOMER_COPY : GUEST_SIGNED_IN_HELPER_COPY;
    return null;
}

/**
 * The stored `payment_authorized` / `payment_required` texts are worded for
 * the customer ("Your helper has claimed this ticket…"); the helper thread
 * substitutes its own wording.
 */
export const HELPER_PAYMENT_AUTHORIZED_MESSAGE = "The ticket is claimed. You can now start tracking time.";
export const HELPER_PAYMENT_REQUIRED_MESSAGE =
    "You've claimed the ticket. The user has now been asked to add a payment method. You can start tracking time once the payment is authorized.";

/**
 * Helper-side copy for a system message kind, or null when the stored text
 * should be shown as is. Covers the payment kinds above and the guest kinds
 * from `guestSystemMessageCopy(kind, "helper")`.
 */
export function helperSystemMessageCopy(kind: unknown): string | null {
    if (kind === "payment_authorized") return HELPER_PAYMENT_AUTHORIZED_MESSAGE;
    if (kind === "payment_required") return HELPER_PAYMENT_REQUIRED_MESSAGE;
    return guestSystemMessageCopy(kind, "helper");
}

type KindMessage = { id?: string; sender_type: string; metadata?: Record<string, unknown> | null };

/**
 * The `visitor_left` message that explains the ticket's CURRENT closure, if
 * any. Adoption can reopen such a ticket (posting `guest_signed_in`), so it
 * only counts while the ticket is cancelled and no `guest_signed_in` came
 * after it.
 */
function activeVisitorLeft<T extends KindMessage>(messages: T[] | undefined, ticketStatus: string | null | undefined): T | null {
    if (ticketStatus !== "cancelled" || !messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.sender_type !== "system") continue;
        if (m.metadata?.kind === "guest_signed_in") return null;
        if (m.metadata?.kind === "visitor_left") return m;
    }
    return null;
}

/**
 * The ticket is currently closed because the guest left (no helper "session
 * ended" summary applies). Keys on the ticket's status, not just on the
 * message being there.
 */
export function hasVisitorLeft(messages: KindMessage[] | undefined, ticketStatus: string | null | undefined): boolean {
    return activeVisitorLeft(messages, ticketStatus) !== null;
}

/** dd.mm.yyyy, HH:MM — the timestamp format used throughout the chat UI. */
export function formatChatTimestamp(date: Date | string): string {
    return formatDateTime(date);
}

/** Row shape returned by `useTicketMessages` (only the fields we read). */
export interface PersistedTicketMessage {
    id: string;
    content: string;
    created_at: string;
    sender_type: string;
    sender_id?: string | null;
    metadata?: Record<string, unknown> | null;
    /** Written by the server: the welcome, start note and auto-reply rows (and every other system message). */
    is_automatic?: boolean | null;
    sender?: { id?: string; name?: string | null; avatar_url?: string | null } | null;
}

/**
 * The stored rows written when a ticket is created (migration
 * 20261123120000_ticket_welcome_messages): `welcome` then `start_note`.
 * They open the thread, ahead of the claimed banner and the first message
 * (in the customer chat and on the helper/admin ticket page alike).
 */
export function isThreadOpener(msg: KindMessage): boolean {
    if (msg.sender_type !== "system") return false;
    return msg.metadata?.kind === "welcome" || msg.metadata?.kind === "start_note";
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** What a stored welcome row (`metadata.kind = 'welcome'`) saved when the ticket was opened. */
export interface StoredWelcome {
    projectName: string | null;
    rates: TicketRates | null;
    isFree: boolean;
    freeText: string | null;
}

/**
 * Reads the snapshot of a stored welcome row from its `metadata`. Shared by
 * the customer chat and the helper/admin ticket page, so both show the same
 * welcome; never the project's live rates or name.
 */
export function parseStoredWelcome(metadata: Record<string, unknown> | null | undefined): StoredWelcome {
    const { rates, isFree } = parseWelcomeRates(metadata?.rates);
    return {
        projectName: textOrNull(metadata?.project_name),
        rates,
        isFree,
        freeText: isFree ? textOrNull(metadata?.free_text) : null,
    };
}

export interface CustomerThreadOptions {
    projectName: string;
    projectLogo: string | null;
    /** Timestamp for synthetic (non-persisted) messages: the claimed banner and an undated pending first message. */
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
    /** `isGuest`: the viewer is not signed in, so their own messages get the guest avatar and guest label. */
    currentUser: { id?: string; name?: string | null; avatarUrl?: string | null; isGuest?: boolean };
    /**
     * The ticket's current status. A `visitor_left` notice (and its "Start a
     * new conversation" action) only shows while the ticket is cancelled; a
     * ticket reopened by adoption hides it.
     */
    ticketStatus?: string | null;
}

/**
 * Stored welcome → stored start note → claimed banner → (pending first
 * message) → the other persisted messages, in stored order (the auto-reply is
 * a stored row right after the first user message). Nothing here is made up
 * from the project's current settings: a ticket without stored welcome rows
 * simply has none. Callers append page-specific trailing messages (e.g. the
 * session summary).
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
        ticketStatus,
    } = opts;

    // A guest's own messages carry the same label helpers see ("Guest · a1b2").
    const guest = currentUser.isGuest ? guestLabel({ id: currentUser.id }) : null;
    const userName = guest?.label ?? (currentUser.name || "You");
    const userInitial = userName[0]?.toUpperCase() || "Y";

    // Only the visitor_left notice explaining the current closure is shown
    // (with its "Start a new conversation" action); a reopened ticket hides it.
    const visitorLeftNow = activeVisitorLeft(messagesData, ticketStatus);

    const toChatMessage = (msg: PersistedTicketMessage): TicketChatMessage => {
        const senderType: TicketChatMessage["senderType"] =
            msg.sender_type === "user" ? "user" : msg.sender_type === "helper" ? "helper" : "system";
        const metadataKind = senderType === "system" ? msg.metadata?.kind : undefined;
        const isOwnGuestMessage =
            !!guest && senderType === "user" && (msg.sender_id ?? msg.sender?.id) === currentUser.id;
        const base: TicketChatMessage = {
            id: msg.id,
            senderType,
            content: (senderType === "system" ? guestSystemMessageCopy(metadataKind, "customer") : null) ?? msg.content,
            senderName:
                (isOwnGuestMessage ? guest?.label : null) ||
                msg.sender?.name ||
                (senderType === "user" ? userName : senderType === "helper" ? "Helper" : `${projectName} Team`),
            senderAvatarInitial:
                msg.sender?.name?.[0]?.toUpperCase() || (senderType === "user" ? userInitial : "H"),
            senderAvatarUrl: msg.sender?.avatar_url ?? null,
            senderId: msg.sender_id ?? msg.sender?.id ?? null,
            senderIsGuest: isOwnGuestMessage,
            senderGuestFull: isOwnGuestMessage ? guest?.full ?? null : null,
            timestamp: formatChatTimestamp(msg.created_at),
            createdAt: msg.created_at,
            isAutomatic: !!msg.is_automatic,
            // Payment system messages (payment_required, payment_requires_action,
            // payment_authorized, …) carry their kind + ticket_id here; TicketChat
            // renders the "Add payment method" CTA from it.
            paymentMetadata: (msg.metadata as TicketChatMessage["paymentMetadata"]) ?? null,
        };

        // The stored welcome: its own row kind, carrying what the row saved
        // when the ticket was opened (never the project's live rates or name).
        if (metadataKind === "welcome") {
            return {
                ...base,
                kind: "welcome",
                senderAvatarUrl: projectLogo,
                paymentMetadata: null,
                welcome: parseStoredWelcome(msg.metadata),
            };
        }
        // The stored start note and auto-reply are ordinary system notes.
        if (metadataKind === "start_note" || metadataKind === "auto_reply") {
            return { ...base, paymentMetadata: null };
        }
        return base;
    };

    const persisted = (messagesData ?? []).filter(
        (msg) => !(msg.sender_type === "system" && msg.metadata?.kind === "visitor_left" && msg !== visitorLeftNow),
    );

    const list: TicketChatMessage[] = persisted.filter(isThreadOpener).map(toChatMessage);

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

    // The customer's first message while it isn't stored yet: after the stored
    // welcome and note, before everything else.
    const hasPersistedUserMessage = persisted.some((m) => m.sender_type === "user");
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
            senderIsGuest: !!guest,
            senderGuestFull: guest?.full ?? null,
            timestamp: fallbackTimestamp ? formatChatTimestamp(fallbackTimestamp) : nowFormatted,
            createdAt: fallbackTimestamp ?? undefined,
        });
    }

    persisted.forEach((msg) => {
        if (!isThreadOpener(msg)) list.push(toChatMessage(msg));
    });

    return list;
}

/**
 * What the customer was charged, for the end-of-session summary.
 * `slaCovered` must come from the loaded ticket row (`tickets.sla_id`), never
 * from a URL parameter: the backend bills by that column alone.
 */
export function describeChargedLine(opts: {
    cancelled: boolean;
    slaCovered: boolean;
    paymentStatus: TicketPaymentStatus;
    capturedAmountSmallestUnit: number | null;
    /** Stripe's reason when `paymentStatus` is "failed". */
    failureReason?: string | null;
}): string {
    const amount = opts.capturedAmountSmallestUnit != null ? `$${(opts.capturedAmountSmallestUnit / 100).toFixed(2)}` : null;
    // Cancelled after money was already captured (a weekly segment): it is
    // flagged for a refund, which the `payment_refund_needed` message explains.
    if (opts.paymentStatus === "refund_pending") {
        return amount ? `Refund pending (${amount} collected)` : "Refund pending";
    }
    if (opts.cancelled) return "No charge";
    if (opts.slaCovered) return "Covered by your SLA";
    if (opts.paymentStatus === "free") return "Free support — no charge";
    if (opts.paymentStatus === "distributing" || opts.paymentStatus === "completed") {
        return amount ?? "Charged";
    }
    if (opts.paymentStatus === "waived") return amount ?? "No charge (amount below the card minimum)";
    if (opts.paymentStatus === "failed") {
        const reason = opts.failureReason?.trim();
        return reason
            ? `Payment could not be processed (${reason.replace(/\.$/, "")})`
            : "Payment could not be processed";
    }
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

/** System messages that settle a ticket's payment after a `payment_failed` prompt. */
const PAYMENT_SETTLED_KINDS = new Set(["payment_completed", "payment_remainder_waived", "payment_refund_needed"]);

/**
 * Whether the "Update payment method" CTA on the `payment_failed` message at
 * `index` is still live. It is resolved by any later settling system message
 * (`payment_completed`, `payment_remainder_waived`, `payment_refund_needed`),
 * or once the ticket is closed and its payment status is known and no longer
 * `failed` (e.g. a capture settled it without a message). Otherwise the
 * backend would answer "This ticket has no failed payment to retry".
 */
export function isPaymentFailedCtaLive(
    messages: TicketChatMessage[],
    index: number,
    opts: { ticketClosed?: boolean; paymentStatus?: TicketPaymentStatus } = {}
): boolean {
    const msg = messages[index];
    if (!msg || msg.senderType !== "system" || msg.paymentMetadata?.kind !== "payment_failed") return false;
    const settledLater = messages
        .slice(index + 1)
        .some((m) => m.senderType === "system" && PAYMENT_SETTLED_KINDS.has(String(m.paymentMetadata?.kind ?? "")));
    if (settledLater) return false;
    // "none" = not loaded yet (or unreadable): don't hide on a guess.
    if (opts.ticketClosed && opts.paymentStatus && opts.paymentStatus !== "none" && opts.paymentStatus !== "failed") {
        return false;
    }
    return true;
}

/**
 * The pending SCA prompt carried by the latest `payment_requires_action` system
 * message, if any. Only the latest counts: an earlier prompt belongs to a hold
 * that a newer card replaced (and that was cancelled). A prompt followed by
 * `payment_authorized` (confirmed, possibly in an earlier visit) is resolved,
 * so it never reopens the modal after a reload.
 */
export function findPendingSca(
    messages: TicketChatMessage[],
    handledMessageId: string | null
): { messageId: string; clientSecret: string; ticketId?: string } | null {
    let scaIndex = -1;
    messages.forEach((m, index) => {
        // Only server-written system messages may open the payment modal.
        if (m.senderType === "system" && m.paymentMetadata?.kind === "payment_requires_action") scaIndex = index;
    });
    const scaMsg = scaIndex === -1 ? undefined : messages[scaIndex];
    if (!scaMsg || scaMsg.id === handledMessageId) return null;
    if (messages.slice(scaIndex + 1).some((m) => m.senderType === "system" && m.paymentMetadata?.kind === "payment_authorized")) return null;
    const clientSecret = scaMsg.paymentMetadata?.client_secret as string | undefined;
    if (!clientSecret) return null;
    return {
        messageId: scaMsg.id,
        clientSecret,
        ticketId: scaMsg.paymentMetadata?.ticket_id as string | undefined,
    };
}
