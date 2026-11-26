import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";
import { formatDateTime } from "./format";
import type { TicketPaymentStatus } from "@/hooks/useTicketPaymentStatus";
import { guestLabel } from "@/lib/guest-label";
import { formatChatTime } from "@/lib/chat-thread";
import {
    ticketRatesFromSnapshot,
    type TicketRates,
    type TicketRateSnapshotColumns,
    type WelcomeRateMetadata,
} from "@/lib/ticket-pricing";

/**
 * Message-thread building shared by the two customer-facing chat pages
 * (`/support` Get support tab and `/support/chat`) so they render the same
 * thread for the same ticket.
 */

/**
 * Automatic project messages the backend posts on every ticket
 * (20261123120000_ticket_rate_snapshot_and_welcome_message,
 * 20261123130000_auto_reply_system_message): `welcome` at the ticket's
 * created_at (its metadata carries the rate snapshot), `welcome_disclaimer`
 * 1 ms later, and `auto_reply` right after the customer's first message. The
 * threads render the stored rows; nothing is synthesised on the client.
 */
export const WELCOME_KIND = "welcome";

function isStoredWelcome(msg: { sender_type: string; metadata?: Record<string, unknown> | null }): boolean {
    return msg.sender_type === "system" && msg.metadata?.kind === WELCOME_KIND;
}

/** The disclaimer stored for a free ticket; the intro already carries its sentence. */
export function isFreeWelcomeDisclaimer(metadata: Record<string, unknown> | null | undefined): boolean {
    return metadata?.kind === "welcome_disclaimer" && metadata?.is_free === true;
}

/** The stored welcome message of a ticket, if it has loaded. */
export function findStoredWelcome<T extends { sender_type: string; metadata?: Record<string, unknown> | null }>(
    messages: T[] | undefined
): T | null {
    return messages?.find(isStoredWelcome) ?? null;
}

/** What `CustomerChatIntro` shows for an existing ticket. */
export interface StoredWelcomeIntro {
    rates: TicketRates | null;
    isFree: boolean;
    /** "HH:MM" of the welcome message (else the ticket's created_at). */
    timestamp: string;
}

/**
 * Rates, free flag and time for the intro once a ticket exists: from the
 * stored welcome message's metadata snapshot, else the ticket's rate snapshot
 * columns, so the intro keeps the prices the ticket was opened with. Only a
 * ticket with no snapshot at all (opened before snapshots existed) uses
 * `fallback`, the live settings. Returns null when there is no ticket yet:
 * callers keep the pre-creation intro.
 */
export function storedWelcomeIntro(opts: {
    messages: PersistedTicketMessage[] | undefined;
    ticket: (TicketRateSnapshotColumns & { created_at?: string | null }) | null | undefined;
    fallback: { rates: TicketRates | null; isFree: boolean };
}): StoredWelcomeIntro | null {
    const welcome = findStoredWelcome(opts.messages);
    if (!welcome && !opts.ticket) return null;
    const snapshot =
        ticketRatesFromSnapshot(welcome?.metadata as WelcomeRateMetadata | null | undefined) ??
        ticketRatesFromSnapshot(opts.ticket);
    const createdAt = welcome?.created_at ?? opts.ticket?.created_at ?? null;
    let rates: TicketRates | null;
    let isFree: boolean;
    if (snapshot?.isFree) {
        rates = null;
        isFree = true;
    } else if (snapshot) {
        rates = { startPrice: snapshot.startPrice, first60Price: snapshot.first60Price, after60Price: snapshot.after60Price };
        isFree = false;
    } else {
        ({ rates, isFree } = opts.fallback);
    }
    return { rates, isFree, timestamp: createdAt ? formatChatTime(createdAt) : "" };
}

/**
 * Guest-ticket system messages (migration 20261029150000_guest_tickets):
 * `visitor_left` is posted by the cron that closes a guest ticket nobody has
 * seen for 15 minutes; `guest_signed_in` by adopt-guest-tickets when the
 * visitor signs in. The stored text is generic, so each side gets its own copy.
 */
export const VISITOR_LEFT_CUSTOMER_COPY = "This conversation was closed because you left before signing in.";
export const VISITOR_LEFT_HELPER_COPY = "The visitor left before signing in.";
export const GUEST_SIGNED_IN_CUSTOMER_COPY = "You signed in - this conversation is now linked to your account.";
export const GUEST_SIGNED_IN_HELPER_COPY = "The visitor signed in - you can claim this ticket now.";
/**
 * `guest_abandoned` (the guest closed the chat window) and `guest_returned`
 * (they came back) are notes for the helper only: the customer thread hides
 * them, see `isHelperOnlySystemKind`.
 */
export const GUEST_ABANDONED_HELPER_COPY =
    "The guest user has closed the chat window. You can decide to end the ticket, if you would like.";
export const GUEST_RETURNED_HELPER_COPY = "The guest user has returned to the chat.";

/**
 * Side-specific copy for a guest system message, or null for any other kind.
 * Also null for the customer on the helper-only kinds, which the customer
 * thread never renders.
 */
export function guestSystemMessageCopy(kind: unknown, audience: "customer" | "helper"): string | null {
    if (kind === "visitor_left") return audience === "customer" ? VISITOR_LEFT_CUSTOMER_COPY : VISITOR_LEFT_HELPER_COPY;
    if (kind === "guest_signed_in") return audience === "customer" ? GUEST_SIGNED_IN_CUSTOMER_COPY : GUEST_SIGNED_IN_HELPER_COPY;
    if (kind === "guest_abandoned") return audience === "helper" ? GUEST_ABANDONED_HELPER_COPY : null;
    if (kind === "guest_returned") return audience === "helper" ? GUEST_RETURNED_HELPER_COPY : null;
    return null;
}

/** System message kinds addressed to the helper, hidden from the customer thread. */
export function isHelperOnlySystemKind(kind: unknown): boolean {
    return kind === "guest_abandoned" || kind === "guest_returned";
}

/**
 * System message kinds addressed to the customer, hidden from the helper
 * thread: `auto_reply`, the "Thank you for reaching out! A helper will get in
 * touch with you as soon as possible." note posted right after the customer's
 * first message (20261123130000_auto_reply_system_message).
 */
export function isCustomerOnlySystemKind(kind: unknown): boolean {
    return kind === "auto_reply";
}

/** Text around the user's name in the helper-side welcome line (the page renders the name in semibold). */
export const HELPER_WELCOME_PREFIX = "A new ticket was generated by ";
export const HELPER_WELCOME_SUFFIX = ". Claim the ticket if you think you can help.";

/** Helper-side replacement for the stored `welcome` message. */
export function helperWelcomeMessageCopy(userName: string): string {
    return `${HELPER_WELCOME_PREFIX}${userName}${HELPER_WELCOME_SUFFIX}`;
}

/** Helper-side copy for the stored `welcome_disclaimer` message. */
export const HELPER_WELCOME_DISCLAIMER_MESSAGE =
    "The user is not charged anything before both you and the user have confirmed the ticket. Feel free to chat and clarify details before you confirm.";

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
 * should be shown as is. Covers `welcome_disclaimer`, the payment kinds above
 * and the guest kinds from `guestSystemMessageCopy(kind, "helper")`.
 */
export function helperSystemMessageCopy(kind: unknown): string | null {
    if (kind === "welcome_disclaimer") return HELPER_WELCOME_DISCLAIMER_MESSAGE;
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

/**
 * The guest has closed the chat window and not come back: the ticket is still
 * open (not completed/cancelled) and the latest of the `guest_abandoned` /
 * `guest_returned` / `guest_signed_in` system messages is `guest_abandoned`.
 */
export function isGuestAbandoned(messages: KindMessage[] | undefined, ticketStatus: string | null | undefined): boolean {
    if (ticketStatus === "completed" || ticketStatus === "cancelled" || !messages) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.sender_type !== "system") continue;
        const kind = m.metadata?.kind;
        if (kind === "guest_abandoned") return true;
        if (kind === "guest_returned" || kind === "guest_signed_in") return false;
    }
    return false;
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
    sender?: { id?: string; name?: string | null; avatar_url?: string | null } | null;
}

export interface CustomerThreadOptions {
    projectName: string;
    projectLogo: string | null;
    /** Timestamp for the synthetic claimed banner and the pending first message. */
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
 * Stored welcome + disclaimer → claimed banner → (pending first message) →
 * the other persisted messages (auto-reply included), in created_at order.
 * The stored `welcome` row becomes a `kind: "welcome"` row carrying its
 * metadata (rate snapshot), which TicketChat renders as the page's intro;
 * `welcome_disclaimer` and `auto_reply` are plain system notes (a free ticket's
 * disclaimer is hidden: the intro already says it is free). Callers append
 * page-specific trailing messages (e.g. the session summary).
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

    // Persisted rows in their stored (created_at) order. The welcome and its
    // disclaimer lead the thread; synthetic rows are inserted after them.
    const head: TicketChatMessage[] = [];
    const tail: TicketChatMessage[] = [];
    const list: TicketChatMessage[] = [];

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
            senderIsGuest: !!guest,
            senderGuestFull: guest?.full ?? null,
            timestamp: fallbackTimestamp ? formatChatTimestamp(fallbackTimestamp) : nowFormatted,
            createdAt: fallbackTimestamp ?? undefined,
        });
    }

    // Only the visitor_left notice explaining the current closure is shown
    // (with its "Start a new conversation" action); a reopened ticket hides it.
    const visitorLeftNow = activeVisitorLeft(messagesData, ticketStatus);
    messagesData?.forEach((msg) => {
        if (msg.sender_type === "system" && msg.metadata?.kind === "visitor_left" && msg !== visitorLeftNow) return;
        // Notes addressed to the helper (the guest closed the window / came back).
        if (msg.sender_type === "system" && isHelperOnlySystemKind(msg.metadata?.kind)) return;
        // A free ticket's intro already says it is free (CustomerChatIntro), so its
        // disclaimer would repeat the sentence; the paid disclaimer stays.
        if (msg.sender_type === "system" && isFreeWelcomeDisclaimer(msg.metadata)) return;
        const senderType: TicketChatMessage["senderType"] =
            msg.sender_type === "user" ? "user" : msg.sender_type === "helper" ? "helper" : "system";
        const isOwnGuestMessage =
            !!guest && senderType === "user" && (msg.sender_id ?? msg.sender?.id) === currentUser.id;
        const systemKind = senderType === "system" ? msg.metadata?.kind : undefined;
        const leading =
            (systemKind === WELCOME_KIND || systemKind === "welcome_disclaimer") && tail.length === 0;
        (leading ? head : tail).push({
            id: msg.id,
            senderType,
            content:
                (senderType === "system" ? guestSystemMessageCopy(msg.metadata?.kind, "customer") : null) ?? msg.content,
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
            // Payment system messages (payment_required, payment_requires_action,
            // payment_authorized, …) carry their kind + ticket_id here; TicketChat
            // renders the "Add payment method" CTA from it.
            paymentMetadata: (msg.metadata as TicketChatMessage["paymentMetadata"]) ?? null,
            // The stored welcome: TicketChat renders the page's intro in its place.
            kind: systemKind === WELCOME_KIND ? "welcome" : undefined,
        });
    });

    return [...head, ...list, ...tail];
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
    if (opts.paymentStatus === "free") return "Free support - no charge";
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
            `The helper has ended this session - ${opts.cancelled ? "they were not able to help" : "marked as resolved"}.`,
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
