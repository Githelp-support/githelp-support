import { describe, it, expect } from "vitest";
import {
    buildAutoReply,
    buildComposerPlaceholder,
    buildCustomerThreadMessages,
    describeChargedLine,
    findPendingSca,
    helperSystemMessageCopy,
    isPaymentFailedCtaLive,
    shortTicketId,
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

    it("is only the thank-you while the project has no real average response time", () => {
        const thanks = "Thank you for reaching out! A helper will get in touch with you as soon as possible.";
        for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -30]) {
            expect(buildAutoReply(value)).toBe(thanks);
        }
        expect(buildAutoReply(null)).not.toContain("~");
        expect(buildAutoReply(null)).not.toContain("average response time");
    });

    it("appends the average response time only with a real value", () => {
        expect(buildAutoReply(90 * 60)).toBe(
            "Thank you for reaching out! A helper will get in touch with you as soon as possible. The average response time for this project is **1h 30m**.",
        );
    });
});

describe("buildCustomerThreadMessages createdAt", () => {
    const opts = (overrides: Partial<CustomerThreadOptions> = {}): CustomerThreadOptions => ({
        projectName: "Acme",
        projectLogo: null,
        nowFormatted: "01/01/2026, 12:00",
        messagesData: undefined,
        currentUser: { id: "user-1", name: "Ada" },
        ...overrides,
    });
    const byId = (list: ReturnType<typeof buildCustomerThreadMessages>, id: string) => list.find((m) => m.id === id);

    it("carries the raw created_at on persisted messages and on the auto-reply after the first one", () => {
        const list = buildCustomerThreadMessages(
            opts({
                claimer: { id: "helper-1", name: "Grace", avatar_url: null },
                messagesData: [
                    { id: "m1", content: "Hi", created_at: "2026-01-01T12:00:00Z", sender_type: "user", sender_id: "user-1" },
                    { id: "m2", content: "Hello", created_at: "2026-01-02T08:30:00Z", sender_type: "helper", sender_id: "helper-1" },
                ],
            })
        );
        expect(byId(list, "m1")?.createdAt).toBe("2026-01-01T12:00:00Z");
        expect(byId(list, "m2")?.createdAt).toBe("2026-01-02T08:30:00Z");
        expect(byId(list, "auto-reply")?.createdAt).toBe("2026-01-01T12:00:00Z");
        // Synthetic messages have no time of their own.
        expect(byId(list, "welcome")?.createdAt).toBeUndefined();
        expect(byId(list, "system-claimed")?.createdAt).toBeUndefined();
    });

    it("dates the pending first message from the ticket, or not at all", () => {
        const dated = buildCustomerThreadMessages(
            opts({ pendingFirstMessage: "Help", fallbackTimestamp: "2026-01-03T09:00:00Z" })
        );
        expect(byId(dated, "pending-first")?.createdAt).toBe("2026-01-03T09:00:00Z");
        expect(byId(dated, "auto-reply")?.createdAt).toBe("2026-01-03T09:00:00Z");

        const undated = buildCustomerThreadMessages(opts({ pendingFirstMessage: "Help" }));
        expect(byId(undated, "pending-first")?.createdAt).toBeNull();
        expect(byId(undated, "pending-first")?.timestamp).toBe("01/01/2026, 12:00");
    });
});

describe("shortTicketId", () => {
    it("returns the first 8 characters", () => {
        expect(shortTicketId("b435097a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe("b435097a");
    });

    it("returns a shorter id unchanged", () => {
        expect(shortTicketId("abc")).toBe("abc");
        expect(shortTicketId("")).toBe("");
    });
});

describe("buildComposerPlaceholder", () => {
    it("uses the slug when there is one", () => {
        expect(buildComposerPlaceholder({ slug: "githelp-crm", name: "Githelp CRM" })).toBe("Ask #githelp-crm");
    });

    it("falls back to the display name when the slug is missing or empty", () => {
        expect(buildComposerPlaceholder({ slug: "", name: "Githelp sandbox" })).toBe("Ask #Githelp sandbox");
        expect(buildComposerPlaceholder({ slug: null, name: "Githelp sandbox" })).toBe("Ask #Githelp sandbox");
        expect(buildComposerPlaceholder({ slug: "   ", name: "Githelp sandbox" })).toBe("Ask #Githelp sandbox");
    });

    it("truncates a long name with a single ellipsis", () => {
        const result = buildComposerPlaceholder({ slug: "a".repeat(60) });
        expect(result).toBe(`Ask #${"a".repeat(32)}…`);
        expect(result.match(/…/g)).toHaveLength(1);
    });

    it("leaves a name at the limit untouched", () => {
        expect(buildComposerPlaceholder({ slug: "a".repeat(32) })).toBe(`Ask #${"a".repeat(32)}`);
    });

    it("falls back to a generic placeholder when both are missing", () => {
        expect(buildComposerPlaceholder({})).toBe("Ask a question");
        expect(buildComposerPlaceholder({ slug: null, name: "  " })).toBe("Ask a question");
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
