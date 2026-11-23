import { describe, it, expect } from "vitest";
import {
    buildAutoReply,
    buildCustomerThreadMessages,
    describeChargedLine,
    findPendingSca,
    helperSystemMessageCopy,
    isPaymentFailedCtaLive,
    TICKET_DISCLAIMER,
    TICKET_DISCLAIMER_FREE,
    GUEST_SIGNED_IN_HELPER_COPY,
    HELPER_PAYMENT_AUTHORIZED_MESSAGE,
    HELPER_PAYMENT_REQUIRED_MESSAGE,
    type CustomerThreadOptions,
    type PersistedTicketMessage,
} from "../customer-chat-messages";
import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";

describe("buildCustomerThreadMessages auto-reply", () => {
    const baseOpts = (overrides: Partial<CustomerThreadOptions> = {}): CustomerThreadOptions => ({
        projectName: "Acme",
        projectLogo: null,
        nowFormatted: "01/01/2026, 12:00",
        messagesData: undefined,
        currentUser: { id: "user-1", name: "Ada" },
        ...overrides,
    });

    const persistedUserMessage = (overrides: Partial<PersistedTicketMessage> = {}): PersistedTicketMessage => ({
        id: "msg-1",
        content: "My build is broken",
        created_at: "2026-01-01T12:00:00Z",
        sender_type: "user",
        ...overrides,
    });

    it("appears directly after the pending first message when nothing is persisted yet", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({ pendingFirstMessage: "My build is broken" }),
        );
        const pendingIndex = list.findIndex((m) => m.id === "pending-first");
        expect(pendingIndex).toBeGreaterThan(-1);
        expect(list[pendingIndex + 1]).toMatchObject({
            id: "auto-reply",
            senderType: "system",
            content: buildAutoReply(null),
        });
    });

    it("appears directly after the first persisted user message", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({
                messagesData: [
                    persistedUserMessage(),
                    persistedUserMessage({ id: "msg-2", content: "Any update?" }),
                ],
            }),
        );
        const firstUserIndex = list.findIndex((m) => m.id === "msg-1");
        expect(firstUserIndex).toBeGreaterThan(-1);
        expect(list[firstUserIndex + 1]).toMatchObject({
            id: "auto-reply",
            senderType: "system",
            content: buildAutoReply(null),
        });
        // Only one auto-reply, after the first user message — not the second.
        expect(list.filter((m) => m.id === "auto-reply")).toHaveLength(1);
    });

    it("is absent when there is no user message", () => {
        const list = buildCustomerThreadMessages(baseOpts());
        expect(list.some((m) => m.id === "auto-reply")).toBe(false);
    });

    it("uses the project's average response time", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({ pendingFirstMessage: "My build is broken", avgResponseSeconds: 90 * 60 }),
        );
        expect(list.find((m) => m.id === "auto-reply")?.content).toContain("**1h 30m**");
    });

    it("omits the average response time sentence while the project has none yet", () => {
        const base = "Thank you for reaching out! A helper will get in touch with you as soon as possible.";
        expect(buildAutoReply(null)).toBe(base);
        expect(buildAutoReply(undefined)).toBe(base);
        expect(buildAutoReply(null)).not.toContain("~");
        expect(buildAutoReply(null)).not.toContain("average response time");
    });

    it("includes the average response time sentence with a real value", () => {
        expect(buildAutoReply(90 * 60)).toBe(
            "Thank you for reaching out! A helper will get in touch with you as soon as possible. The average response time for this project is **1h 30m**.",
        );
    });

    it("sets the raw createdAt on persisted messages and the pending-first fallback only", () => {
        const persisted = buildCustomerThreadMessages(baseOpts({ messagesData: [persistedUserMessage()] }));
        expect(persisted.find((m) => m.id === "msg-1")?.createdAt).toBe("2026-01-01T12:00:00Z");
        expect(persisted.find((m) => m.id === "welcome")?.createdAt).toBeUndefined();
        expect(persisted.find((m) => m.id === "auto-reply")?.createdAt).toBeUndefined();

        const pending = buildCustomerThreadMessages(
            baseOpts({ fallbackDescription: "My build is broken", fallbackTimestamp: "2026-01-01T11:00:00Z" }),
        );
        expect(pending.find((m) => m.id === "pending-first")?.createdAt).toBe("2026-01-01T11:00:00Z");

        const noTimestamp = buildCustomerThreadMessages(baseOpts({ pendingFirstMessage: "My build is broken" }));
        expect(noTimestamp.find((m) => m.id === "pending-first")?.createdAt).toBeUndefined();
    });
});

describe("buildCustomerThreadMessages welcome disclaimer", () => {
    const baseOpts = (overrides: Partial<CustomerThreadOptions> = {}): CustomerThreadOptions => ({
        projectName: "Acme",
        projectLogo: null,
        nowFormatted: "01/01/2026, 12:00",
        messagesData: undefined,
        currentUser: { id: "user-1", name: "Ada" },
        ...overrides,
    });

    it("uses the paid copy by default", () => {
        const welcome = buildCustomerThreadMessages(baseOpts()).find((m) => m.id === "welcome");
        expect(welcome?.content).toBe(TICKET_DISCLAIMER);
        expect(welcome?.content).toContain("not charged");
    });

    it("does not mention charging or confirming when the project offers free support", () => {
        const welcome = buildCustomerThreadMessages(baseOpts({ isFree: true })).find((m) => m.id === "welcome");
        expect(welcome?.content).toBe(TICKET_DISCLAIMER_FREE);
        expect(welcome?.content).not.toContain("charged");
        expect(welcome?.content).not.toContain("confirm");
    });
});

describe("describeChargedLine", () => {
    it("shows Stripe's reason when the payment failed", () => {
        expect(
            describeChargedLine({
                cancelled: false,
                slaCovered: false,
                paymentStatus: "failed",
                capturedAmountSmallestUnit: null,
                failureReason: "Your card was declined.",
            }),
        ).toBe("Payment could not be processed (Your card was declined)");
    });

    it("falls back to the generic text when no reason is recorded", () => {
        expect(
            describeChargedLine({
                cancelled: false,
                slaCovered: false,
                paymentStatus: "failed",
                capturedAmountSmallestUnit: null,
                failureReason: "  ",
            }),
        ).toBe("Payment could not be processed");
    });

    it("prefers the captured amount once the retry goes through", () => {
        expect(
            describeChargedLine({
                cancelled: false,
                slaCovered: false,
                paymentStatus: "completed",
                capturedAmountSmallestUnit: 4000,
                failureReason: null,
            }),
        ).toBe("$40.00");
    });

    it("reports free support instead of a never-ending Processing", () => {
        expect(
            describeChargedLine({
                cancelled: false,
                slaCovered: false,
                paymentStatus: "free",
                capturedAmountSmallestUnit: null,
            }),
        ).toBe("Free support — no charge");
    });
});

describe("findPendingSca", () => {
    const msg = (id: string, kind: string, extra: Record<string, unknown> = {}) =>
        ({ id, senderType: "system", content: "", paymentMetadata: { kind, ...extra } }) as unknown as TicketChatMessage;

    it("returns the confirmation a bank asked for", () => {
        const messages = [msg("m1", "payment_required"), msg("m2", "payment_requires_action", { client_secret: "pi_secret" })];
        expect(findPendingSca(messages, null)).toEqual({ messageId: "m2", clientSecret: "pi_secret", ticketId: undefined });
    });

    it("stays closed once handled in this visit", () => {
        const messages = [msg("m2", "payment_requires_action", { client_secret: "pi_secret" })];
        expect(findPendingSca(messages, "m2")).toBeNull();
    });

    it("uses the latest prompt, not one for a hold a newer card replaced", () => {
        const messages = [
            msg("m2", "payment_requires_action", { client_secret: "pi_old_secret" }),
            msg("m4", "payment_requires_action", { client_secret: "pi_new_secret" }),
        ];
        expect(findPendingSca(messages, null)?.clientSecret).toBe("pi_new_secret");
        expect(findPendingSca(messages, "m4")).toBeNull();
    });

    it("stays closed after the hold was confirmed, e.g. on a later visit", () => {
        const messages = [
            msg("m2", "payment_requires_action", { client_secret: "pi_secret" }),
            msg("m3", "payment_authorized"),
        ];
        expect(findPendingSca(messages, null)).toBeNull();
    });
});

describe("describeChargedLine aggregate outcomes", () => {
    const base = { cancelled: false, slaCovered: false, failureReason: null };

    it("shows the refund pending with the collected amount, even though the ticket was cancelled", () => {
        expect(
            describeChargedLine({ ...base, cancelled: true, paymentStatus: "refund_pending", capturedAmountSmallestUnit: 2500 }),
        ).toBe("Refund pending ($25.00 collected)");
    });

    it("explains a below-minimum waiver instead of Processing", () => {
        expect(describeChargedLine({ ...base, paymentStatus: "waived", capturedAmountSmallestUnit: null })).toBe(
            "No charge (amount below the card minimum)",
        );
    });

    it("keeps No charge for a cancelled ticket with nothing captured", () => {
        expect(
            describeChargedLine({ ...base, cancelled: true, paymentStatus: "cancelled", capturedAmountSmallestUnit: null }),
        ).toBe("No charge");
    });
});

describe("isPaymentFailedCtaLive", () => {
    const msg = (id: string, kind: string) =>
        ({ id, senderType: "system", content: "", paymentMetadata: { kind } }) as unknown as TicketChatMessage;

    it("is live for an unresolved payment_failed on an open ticket", () => {
        const messages = [msg("m1", "payment_completed"), msg("m2", "payment_failed")];
        expect(isPaymentFailedCtaLive(messages, 1, { ticketClosed: false, paymentStatus: "failed" })).toBe(true);
    });

    it.each(["payment_completed", "payment_remainder_waived", "payment_refund_needed"])(
        "is resolved by a later %s message",
        (kind) => {
            const messages = [msg("m1", "payment_failed"), msg("m2", kind)];
            expect(isPaymentFailedCtaLive(messages, 0)).toBe(false);
        },
    );

    it("is resolved once the ticket is closed and the payment is no longer failed", () => {
        const messages = [msg("m1", "payment_failed")];
        expect(isPaymentFailedCtaLive(messages, 0, { ticketClosed: true, paymentStatus: "distributing" })).toBe(false);
        expect(isPaymentFailedCtaLive(messages, 0, { ticketClosed: true, paymentStatus: "failed" })).toBe(true);
        // Status not loaded yet: don't hide on a guess.
        expect(isPaymentFailedCtaLive(messages, 0, { ticketClosed: true, paymentStatus: "none" })).toBe(true);
    });

    it("is false for anything but a payment_failed system message", () => {
        expect(isPaymentFailedCtaLive([msg("m1", "payment_required")], 0)).toBe(false);
    });
});

describe("helperSystemMessageCopy", () => {
    it("replaces the customer-worded payment_required text with the helper copy", () => {
        expect(helperSystemMessageCopy("payment_required")).toBe(HELPER_PAYMENT_REQUIRED_MESSAGE);
        expect(HELPER_PAYMENT_REQUIRED_MESSAGE).not.toContain("Your helper has claimed this ticket");
        expect(HELPER_PAYMENT_REQUIRED_MESSAGE).toBe(
            "You've claimed the ticket. The user has now been asked to add a payment method. You can start tracking time once the payment is authorized.",
        );
    });

    it("replaces the customer-worded payment_authorized text with the helper copy", () => {
        expect(helperSystemMessageCopy("payment_authorized")).toBe(HELPER_PAYMENT_AUTHORIZED_MESSAGE);
        expect(HELPER_PAYMENT_AUTHORIZED_MESSAGE).toBe("The ticket is claimed. You can now start tracking time.");
    });

    it("falls back to the helper-side guest copy", () => {
        expect(helperSystemMessageCopy("guest_signed_in")).toBe(GUEST_SIGNED_IN_HELPER_COPY);
    });

    it("returns null for any other kind so the stored text is shown", () => {
        expect(helperSystemMessageCopy("payment_completed")).toBeNull();
        expect(helperSystemMessageCopy(undefined)).toBeNull();
    });
});
