import { describe, it, expect } from "vitest";
import {
    buildCustomerThreadMessages,
    describeChargedLine,
    findPendingSca,
    guestSystemMessageCopy,
    helperSystemMessageCopy,
    isGuestAbandoned,
    isPaymentFailedCtaLive,
    GUEST_ABANDONED_HELPER_COPY,
    GUEST_RETURNED_HELPER_COPY,
    GUEST_SIGNED_IN_HELPER_COPY,
    HELPER_PAYMENT_AUTHORIZED_MESSAGE,
    HELPER_PAYMENT_REQUIRED_MESSAGE,
    storedWelcomeIntro,
    type CustomerThreadOptions,
    type PersistedTicketMessage,
} from "../customer-chat-messages";
import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";

describe("buildCustomerThreadMessages stored automatic messages", () => {
    const baseOpts = (overrides: Partial<CustomerThreadOptions> = {}): CustomerThreadOptions => ({
        projectName: "Acme",
        projectLogo: null,
        nowFormatted: "01/01/2026, 12:00",
        messagesData: undefined,
        currentUser: { id: "user-1", name: "Ada" },
        ...overrides,
    });

    const msg = (overrides: Partial<PersistedTicketMessage> = {}): PersistedTicketMessage => ({
        id: "msg-1",
        content: "My build is broken",
        created_at: "2026-01-01T12:00:05Z",
        sender_type: "user",
        ...overrides,
    });

    const welcome = msg({
        id: "w",
        sender_type: "system",
        content: "Welcome to Acme's support chat.",
        created_at: "2026-01-01T12:00:00Z",
        metadata: { kind: "welcome", is_free: false, rate_start_price: 1000, rate_first_60: 200, rate_after_60: 100 },
    });
    const disclaimer = msg({
        id: "d",
        sender_type: "system",
        content: "You are not charged anything before both you and the helper have confirmed the ticket.",
        created_at: "2026-01-01T12:00:00.001Z",
        metadata: { kind: "welcome_disclaimer", is_free: false },
    });
    const autoReply = msg({
        id: "a",
        sender_type: "system",
        content: "Thank you for reaching out!",
        created_at: "2026-01-01T12:00:05.001Z",
        metadata: { kind: "auto_reply" },
    });

    it("adds no synthetic welcome or auto-reply rows", () => {
        expect(buildCustomerThreadMessages(baseOpts())).toEqual([]);
        const list = buildCustomerThreadMessages(baseOpts({ pendingFirstMessage: "My build is broken" }));
        expect(list.map((m) => m.id)).toEqual(["pending-first"]);
    });

    it("adds no synthetic welcome or auto-reply once stored messages exist", () => {
        // Only the customer's message is stored (e.g. the welcome rows have not loaded): nothing is invented around it.
        const list = buildCustomerThreadMessages(
            baseOpts({ messagesData: [msg(), msg({ id: "msg-2", content: "Any update?", created_at: "2026-01-01T12:10:00Z" })] }),
        );
        expect(list.map((m) => m.id)).toEqual(["msg-1", "msg-2"]);
        expect(list.some((m) => m.id === "welcome" || m.id === "auto-reply")).toBe(false);

        // With the stored automatic rows: exactly one welcome, one disclaimer and one auto-reply.
        const stored = buildCustomerThreadMessages(
            baseOpts({ messagesData: [welcome, disclaimer, msg(), autoReply] }),
        );
        expect(stored.filter((m) => m.kind === "welcome")).toHaveLength(1);
        expect(stored.filter((m) => m.senderType === "system")).toHaveLength(3);
        expect(stored.every((m) => m.createdAt)).toBe(true);
    });

    it("follows created_at: the auto-reply sits after the first message and before later ones", () => {
        const later = msg({ id: "msg-2", content: "Any update?", created_at: "2026-01-01T12:10:00Z" });
        const helper = msg({ id: "h", sender_type: "helper", content: "On it", created_at: "2026-01-01T12:20:00Z" });
        const list = buildCustomerThreadMessages(
            baseOpts({ messagesData: [welcome, disclaimer, msg(), autoReply, later, helper] }),
        );
        expect(list.map((m) => m.id)).toEqual(["w", "d", "msg-1", "a", "msg-2", "h"]);
        const times = list.map((m) => Date.parse(m.createdAt!));
        expect([...times].sort((x, y) => x - y)).toEqual(times);
    });

    it("hides a free ticket's disclaimer: the intro already says it is free", () => {
        const freeWelcome = msg({ ...welcome, metadata: { kind: "welcome", is_free: true } });
        const freeDisclaimer = msg({
            ...disclaimer,
            content: "Acme offers support for free - no payment method needed.",
            metadata: { kind: "welcome_disclaimer", is_free: true },
        });
        const list = buildCustomerThreadMessages(baseOpts({ messagesData: [freeWelcome, freeDisclaimer, msg()] }));
        expect(list.map((m) => m.id)).toEqual(["w", "msg-1"]);
        expect(list[0].paymentMetadata).toMatchObject({ kind: "welcome", is_free: true });
        expect(list[0].paymentMetadata?.rate_start_price).toBeUndefined();
        expect(list.some((m) => /offers support for free/.test(m.content))).toBe(false);
        expect(list.some((m) => /not charged anything/.test(m.content))).toBe(false);
    });

    it("renders the stored rows in created_at order, the welcome as a welcome row", () => {
        const list = buildCustomerThreadMessages(baseOpts({ messagesData: [welcome, disclaimer, msg(), autoReply] }));
        expect(list.map((m) => m.id)).toEqual(["w", "d", "msg-1", "a"]);
        expect(list[0]).toMatchObject({ kind: "welcome", content: welcome.content, createdAt: welcome.created_at });
        expect(list[0].paymentMetadata?.rate_start_price).toBe(1000);
        expect(list[1]).toMatchObject({ senderType: "system", kind: undefined, content: disclaimer.content });
        expect(list[3]).toMatchObject({ senderType: "system", kind: undefined, content: autoReply.content });
    });

    it("keeps the claimed banner and pending first message after the welcome and disclaimer", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({
                messagesData: [welcome, disclaimer],
                pendingFirstMessage: "My build is broken",
                claimer: { id: "h1", name: "Hal", avatar_url: null },
            }),
        );
        expect(list.map((m) => m.id)).toEqual(["w", "d", "system-claimed", "pending-first"]);
    });

    it("sets the raw createdAt on persisted messages and the pending-first fallback only", () => {
        const persisted = buildCustomerThreadMessages(baseOpts({ messagesData: [msg()] }));
        expect(persisted.find((m) => m.id === "msg-1")?.createdAt).toBe("2026-01-01T12:00:05Z");

        const pending = buildCustomerThreadMessages(
            baseOpts({ fallbackDescription: "My build is broken", fallbackTimestamp: "2026-01-01T11:00:00Z" }),
        );
        expect(pending.find((m) => m.id === "pending-first")?.createdAt).toBe("2026-01-01T11:00:00Z");

        const noTimestamp = buildCustomerThreadMessages(baseOpts({ pendingFirstMessage: "My build is broken" }));
        expect(noTimestamp.find((m) => m.id === "pending-first")?.createdAt).toBeUndefined();
    });

    describe("storedWelcomeIntro", () => {
        const fallback = { rates: { startPrice: "99.00", first60Price: "9.00", after60Price: "9.00" }, isFree: false };

        it("is null before a ticket exists", () => {
            expect(storedWelcomeIntro({ messages: undefined, ticket: null, fallback })).toBeNull();
        });

        it("takes the rates and time from the stored welcome metadata", () => {
            const intro = storedWelcomeIntro({ messages: [welcome], ticket: null, fallback });
            expect(intro?.isFree).toBe(false);
            expect(intro?.rates).toEqual({ startPrice: "10.00", first60Price: "2.00", after60Price: "1.00" });
            expect(intro?.timestamp).toMatch(/^\d{2}:\d{2}$/);
        });

        it("reports a free welcome as free", () => {
            const free = { ...welcome, metadata: { kind: "welcome", is_free: true } };
            expect(storedWelcomeIntro({ messages: [free], ticket: null, fallback })).toMatchObject({ isFree: true, rates: null });
        });

        it("gives the free snapshot as free, with no rates", () => {
            const free = { ...welcome, metadata: { kind: "welcome", is_free: true } };
            const ticket = { created_at: "2026-01-01T12:00:00Z", rate_is_free: true, rate_start_price: 0, rate_first_60: 0, rate_after_60: 0 };
            expect(storedWelcomeIntro({ messages: [free], ticket, fallback })).toEqual({
                rates: null,
                isFree: true,
                timestamp: expect.stringMatching(/^\d{2}:\d{2}$/),
            });
            expect(storedWelcomeIntro({ messages: [], ticket, fallback })).toMatchObject({ isFree: true, rates: null });
        });

        it("keeps the snapshot after the project's rates change", () => {
            const ticket = { created_at: "2026-01-01T12:00:00Z", rate_is_free: false, rate_start_price: 1000, rate_first_60: 200, rate_after_60: 100 };
            // The project has since raised its prices…
            const raised = { rates: { startPrice: "50.00", first60Price: "5.00", after60Price: "4.00" }, isFree: false };
            expect(storedWelcomeIntro({ messages: [welcome], ticket, fallback: raised })?.rates).toEqual({
                startPrice: "10.00",
                first60Price: "2.00",
                after60Price: "1.00",
            });
            expect(storedWelcomeIntro({ messages: [], ticket, fallback: raised })?.rates?.startPrice).toBe("10.00");
            // …or gone free: the paid ticket still shows its paid rates.
            const nowFree = { rates: null, isFree: true };
            expect(storedWelcomeIntro({ messages: [welcome], ticket, fallback: nowFree })).toMatchObject({ isFree: false });
            // A free ticket stays free after the project starts charging.
            const free = { ...welcome, metadata: { kind: "welcome", is_free: true } };
            expect(storedWelcomeIntro({ messages: [free], ticket: null, fallback: raised })).toMatchObject({ isFree: true, rates: null });
        });

        it("falls back to the ticket snapshot, then the live settings", () => {
            const fromTicket = storedWelcomeIntro({
                messages: [],
                ticket: { created_at: "2026-01-01T12:00:00Z", rate_is_free: false, rate_start_price: 500, rate_first_60: 0, rate_after_60: 0 },
                fallback,
            });
            expect(fromTicket?.rates?.startPrice).toBe("5.00");
            const legacy = storedWelcomeIntro({ messages: [], ticket: { created_at: "2026-01-01T12:00:00Z" }, fallback });
            expect(legacy?.rates).toEqual(fallback.rates);
        });
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

describe("guest_abandoned / guest_returned", () => {
    const sys = (id: string, kind: string): PersistedTicketMessage => ({
        id,
        content: `stored ${kind}`,
        created_at: "2026-01-01T12:00:00Z",
        sender_type: "system",
        metadata: { kind },
    });

    it("gives the helper its own copy", () => {
        expect(guestSystemMessageCopy("guest_abandoned", "helper")).toBe(
            "The guest user has closed the chat window. You can decide to end the ticket, if you would like.",
        );
        expect(guestSystemMessageCopy("guest_returned", "helper")).toBe("The guest user has returned to the chat.");
        expect(helperSystemMessageCopy("guest_abandoned")).toBe(GUEST_ABANDONED_HELPER_COPY);
        expect(helperSystemMessageCopy("guest_returned")).toBe(GUEST_RETURNED_HELPER_COPY);
    });

    it("has no customer copy", () => {
        expect(guestSystemMessageCopy("guest_abandoned", "customer")).toBeNull();
        expect(guestSystemMessageCopy("guest_returned", "customer")).toBeNull();
    });

    it("hides both kinds from the customer thread, keeping the other messages", () => {
        const list = buildCustomerThreadMessages({
            projectName: "Acme",
            projectLogo: null,
            nowFormatted: "01.01.2026, 12:00",
            currentUser: { id: "user-1", name: "Ada" },
            ticketStatus: "unclaimed",
            messagesData: [
                { id: "u1", content: "Hi", created_at: "2026-01-01T12:00:00Z", sender_type: "user" },
                sys("s1", "guest_abandoned"),
                sys("s2", "guest_returned"),
                sys("s3", "guest_signed_in"),
            ],
        });
        const ids = list.map((m) => m.id);
        expect(ids).not.toContain("s1");
        expect(ids).not.toContain("s2");
        expect(ids).toContain("u1");
        expect(ids).toContain("s3");
        expect(list.some((m) => m.content === GUEST_ABANDONED_HELPER_COPY || m.content === "stored guest_abandoned")).toBe(false);
    });

    it("does not hide a user message that merely carries the kind", () => {
        const list = buildCustomerThreadMessages({
            projectName: "Acme",
            projectLogo: null,
            nowFormatted: "01.01.2026, 12:00",
            currentUser: { id: "user-1", name: "Ada" },
            messagesData: [
                { id: "u1", content: "Hi", created_at: "2026-01-01T12:00:00Z", sender_type: "user", metadata: { kind: "guest_abandoned" } },
            ],
        });
        expect(list.map((m) => m.id)).toContain("u1");
    });
});

describe("isGuestAbandoned", () => {
    const sys = (kind: string) => ({ sender_type: "system", metadata: { kind } });
    const user = { sender_type: "user", metadata: null };

    it("is true while the latest guest presence message is guest_abandoned on an open ticket", () => {
        expect(isGuestAbandoned([user, sys("guest_abandoned")], "unclaimed")).toBe(true);
        expect(isGuestAbandoned([sys("guest_returned"), sys("guest_abandoned")], "in_progress")).toBe(true);
        // Unrelated messages after it do not clear it.
        expect(isGuestAbandoned([sys("guest_abandoned"), sys("payment_required"), user], "claimed")).toBe(true);
    });

    it("is cleared by a later guest_returned or guest_signed_in", () => {
        expect(isGuestAbandoned([sys("guest_abandoned"), sys("guest_returned")], "unclaimed")).toBe(false);
        expect(isGuestAbandoned([sys("guest_abandoned"), sys("guest_signed_in")], "unclaimed")).toBe(false);
    });

    it.each(["completed", "cancelled"])("is false once the ticket is %s", (status) => {
        expect(isGuestAbandoned([sys("guest_abandoned")], status)).toBe(false);
    });

    it("is false without such a message, and ignores non-system senders", () => {
        expect(isGuestAbandoned(undefined, "unclaimed")).toBe(false);
        expect(isGuestAbandoned([], "unclaimed")).toBe(false);
        expect(isGuestAbandoned([user], "unclaimed")).toBe(false);
        expect(isGuestAbandoned([{ sender_type: "user", metadata: { kind: "guest_abandoned" } }], "unclaimed")).toBe(false);
    });
});
