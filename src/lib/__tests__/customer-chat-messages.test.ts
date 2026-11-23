import { describe, it, expect } from "vitest";
import {
    buildCustomerThreadMessages,
    describeChargedLine,
    findPendingSca,
    helperSystemMessageCopy,
    isPaymentFailedCtaLive,
    GUEST_SIGNED_IN_HELPER_COPY,
    HELPER_PAYMENT_AUTHORIZED_MESSAGE,
    HELPER_PAYMENT_REQUIRED_MESSAGE,
    FALLBACK_AUTO_REPLY_ID,
    FALLBACK_START_NOTE_ID,
    FALLBACK_WELCOME_ID,
    START_NOTE,
    START_NOTE_FREE,
    type CustomerThreadOptions,
    type ThreadFallback,
    type PersistedTicketMessage,
} from "../customer-chat-messages";
import type { TicketChatMessage } from "@/components/ticket-chat/ticket-chat";
import { parseWelcomeRates } from "../ticket-pricing";

describe("buildCustomerThreadMessages stored automatic rows", () => {
    const baseOpts = (overrides: Partial<CustomerThreadOptions> = {}): CustomerThreadOptions => ({
        projectName: "Acme",
        projectLogo: "https://example.com/logo.png",
        nowFormatted: "01.01.2026, 12:00",
        messagesData: undefined,
        currentUser: { id: "user-1", name: "Ada" },
        ...overrides,
    });

    const userMessage = (overrides: Partial<PersistedTicketMessage> = {}): PersistedTicketMessage => ({
        id: "msg-1",
        content: "My build is broken",
        created_at: "2026-01-01T12:00:05.000Z",
        sender_type: "user",
        sender_id: "user-1",
        ...overrides,
    });

    const automatic = (
        id: string,
        metadata: Record<string, unknown>,
        overrides: Partial<PersistedTicketMessage> = {},
    ): PersistedTicketMessage => ({
        id,
        content: `${id} text`,
        created_at: "2026-01-01T12:00:00.000Z",
        sender_type: "system",
        sender_id: null,
        is_automatic: true,
        metadata,
        ...overrides,
    });

    const paidRates = {
        ticket_start_price: 2500,
        ticket_price_minute_first_60: 150,
        ticket_price_minute_after_60: 100,
        currency: "usd",
        is_free: false,
    };
    const welcomeRow = (metadata: Record<string, unknown> = {}) =>
        automatic(
            "w1",
            { kind: "welcome", project_name: "Acme Inc", rates: paidRates, rates_source: "ticket_snapshot", ...metadata },
            { content: "Welcome to Acme Inc's support chat." },
        );
    const startNoteRow = () =>
        automatic(
            "n1",
            { kind: "start_note", is_free: false },
            { content: "You are not charged anything before both you and the helper have confirmed the ticket.", created_at: "2026-01-01T12:00:00.001Z" },
        );
    const autoReplyRow = () =>
        automatic(
            "r1",
            { kind: "auto_reply", avg_response_seconds: 5400 },
            {
                content: "Thank you for reaching out! The average response time for this project is **1h 30m**.",
                created_at: "2026-01-01T12:00:05.001Z",
            },
        );

    it("adds no welcome, note or auto-reply when no fallback is given", () => {
        expect(buildCustomerThreadMessages(baseOpts())).toEqual([]);
        const list = buildCustomerThreadMessages(baseOpts({ messagesData: [userMessage()] }));
        expect(list.map((m) => m.id)).toEqual(["msg-1"]);
    });

    it("maps the stored welcome row to the welcome kind with its stored rates and project name", () => {
        const [welcome] = buildCustomerThreadMessages(baseOpts({ messagesData: [welcomeRow()] }));
        expect(welcome).toMatchObject({
            id: "w1",
            senderType: "system",
            kind: "welcome",
            isAutomatic: true,
            content: "Welcome to Acme Inc's support chat.",
            createdAt: "2026-01-01T12:00:00.000Z",
            senderAvatarUrl: "https://example.com/logo.png",
            paymentMetadata: null,
            welcome: {
                projectName: "Acme Inc",
                rates: { startPrice: "25.00", first60Price: "1.50", after60Price: "1.00" },
                isFree: false,
                freeText: null,
            },
        });
    });

    it("carries the free state instead of rates for a free ticket", () => {
        const [welcome] = buildCustomerThreadMessages(
            baseOpts({
                messagesData: [
                    welcomeRow({
                        rates: { ...paidRates, ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0, is_free: true },
                        free_text: "Acme Inc offers support for free - no payment method needed.",
                    }),
                ],
            }),
        );
        expect(welcome.welcome).toEqual({
            projectName: "Acme Inc",
            rates: null,
            isFree: true,
            freeText: "Acme Inc offers support for free - no payment method needed.",
        });
    });

    it("leaves the rates empty when the welcome row stored none", () => {
        const [welcome] = buildCustomerThreadMessages(
            baseOpts({ messagesData: [welcomeRow({ rates: null, rates_source: null, project_name: null })] }),
        );
        expect(welcome.welcome).toEqual({ projectName: null, rates: null, isFree: false, freeText: null });
    });

    it("maps the stored start note and auto-reply to ordinary system notes with their stored text", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({ messagesData: [welcomeRow(), startNoteRow(), userMessage(), autoReplyRow()] }),
        );
        expect(list.map((m) => m.id)).toEqual(["w1", "n1", "msg-1", "r1"]);
        const note = list[1];
        const reply = list[3];
        for (const m of [note, reply]) {
            expect(m.senderType).toBe("system");
            expect(m.kind).toBeUndefined();
            expect(m.isAutomatic).toBe(true);
            expect(m.paymentMetadata).toBeNull();
            expect(m.welcome).toBeUndefined();
        }
        expect(note.content).toContain("not charged");
        expect(reply.content).toContain("**1h 30m**");
        expect(reply.createdAt).toBe("2026-01-01T12:00:05.001Z");
    });

    it("places the pending first message after the stored welcome and note", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({ messagesData: [welcomeRow(), startNoteRow()], pendingFirstMessage: "My build is broken" }),
        );
        expect(list.map((m) => m.id)).toEqual(["w1", "n1", "pending-first"]);
        expect(list[2]).toMatchObject({ senderType: "user", content: "My build is broken" });
    });

    it("keeps the claimed banner between the stored note and the first message", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({
                messagesData: [welcomeRow(), startNoteRow()],
                claimer: { id: "h1", name: "Grace", avatar_url: null },
                fallbackDescription: "My build is broken",
            }),
        );
        expect(list.map((m) => m.id)).toEqual(["w1", "n1", "system-claimed", "pending-first"]);
    });

    it("drops the pending first message once a user message is stored", () => {
        const list = buildCustomerThreadMessages(
            baseOpts({
                messagesData: [welcomeRow(), startNoteRow(), userMessage(), autoReplyRow()],
                pendingFirstMessage: "My build is broken",
            }),
        );
        expect(list.some((m) => m.id === "pending-first")).toBe(false);
    });

    it("shows the pending first message alone while nothing is stored yet", () => {
        const list = buildCustomerThreadMessages(baseOpts({ pendingFirstMessage: "My build is broken" }));
        expect(list.map((m) => m.id)).toEqual(["pending-first"]);
    });

    it("sets the raw createdAt on persisted messages and the dated pending-first fallback", () => {
        const persisted = buildCustomerThreadMessages(baseOpts({ messagesData: [userMessage()] }));
        expect(persisted.find((m) => m.id === "msg-1")?.createdAt).toBe("2026-01-01T12:00:05.000Z");
        expect(persisted.find((m) => m.id === "msg-1")?.isAutomatic).toBe(false);

        const pending = buildCustomerThreadMessages(
            baseOpts({ fallbackDescription: "My build is broken", fallbackTimestamp: "2026-01-01T11:00:00Z" }),
        );
        expect(pending.find((m) => m.id === "pending-first")?.createdAt).toBe("2026-01-01T11:00:00Z");

        const noTimestamp = buildCustomerThreadMessages(baseOpts({ pendingFirstMessage: "My build is broken" }));
        expect(noTimestamp.find((m) => m.id === "pending-first")?.createdAt).toBeUndefined();
    });

    describe("fallback while no stored row exists", () => {
        const fallback = (overrides: Partial<ThreadFallback> = {}): ThreadFallback => ({
            welcome: true,
            welcomeText: "Welcome to Acme's support chat.",
            rates: { startPrice: "25.00", first60Price: "1.50", after60Price: "1.00" },
            isFree: false,
            avgResponseSeconds: null,
            whileLoading: true,
            ...overrides,
        });

        it("shows only the start note before a ticket exists (the intro is the welcome)", () => {
            const list = buildCustomerThreadMessages(baseOpts({ fallback: fallback({ welcome: false }) }));
            expect(list).toHaveLength(1);
            expect(list[0]).toMatchObject({
                id: FALLBACK_START_NOTE_ID,
                senderType: "system",
                isAutomatic: true,
                content: START_NOTE,
            });
        });

        it("keeps the welcome with rates, the note and the auto-reply for a ticket without stored rows", () => {
            const list = buildCustomerThreadMessages(
                baseOpts({
                    messagesData: [userMessage()],
                    fallbackTimestamp: "2026-01-01T12:00:00.000Z",
                    claimer: { id: "h1", name: "Helper", avatar_url: null },
                    fallback: fallback({ avgResponseSeconds: 5400 }),
                }),
            );
            expect(list.map((m) => m.id)).toEqual([
                FALLBACK_WELCOME_ID,
                FALLBACK_START_NOTE_ID,
                "system-claimed",
                "msg-1",
                FALLBACK_AUTO_REPLY_ID,
            ]);
            expect(list[0]).toMatchObject({
                kind: "welcome",
                isAutomatic: true,
                createdAt: "2026-01-01T12:00:00.000Z",
                content: "Welcome to Acme's support chat.",
                welcome: { projectName: "Acme", isFree: false, rates: { startPrice: "25.00" } },
            });
            expect(list[4]).toMatchObject({ autoReply: true, createdAt: "2026-01-01T12:00:05.000Z" });
            expect(list[4].content).toContain("The average response time for this project is **1h 30m**.");
        });

        it("leaves the response-time sentence out when there is no value", () => {
            const list = buildCustomerThreadMessages(
                baseOpts({ pendingFirstMessage: "My build is broken", fallback: fallback() }),
            );
            const reply = list.find((m) => m.id === FALLBACK_AUTO_REPLY_ID);
            expect(reply?.content).toBe(
                "Thank you for reaching out! A helper will get in touch with you as soon as possible.",
            );
        });

        it("uses the free wording and lists no rates for free support", () => {
            const list = buildCustomerThreadMessages(baseOpts({ messagesData: [], fallback: fallback({ isFree: true }) }));
            expect(list[0].welcome).toMatchObject({ isFree: true, rates: null });
            expect(list[1].content).toBe(START_NOTE_FREE);
        });

        it("lets every stored row win over its fallback", () => {
            const list = buildCustomerThreadMessages(
                baseOpts({
                    messagesData: [welcomeRow(), startNoteRow(), userMessage(), autoReplyRow()],
                    fallback: fallback(),
                }),
            );
            expect(list.map((m) => m.id)).toEqual(["w1", "n1", "msg-1", "r1"]);
            expect(list[3].autoReply).toBe(true);
        });

        it("waits for an existing ticket's messages unless the conversation started here", () => {
            expect(buildCustomerThreadMessages(baseOpts({ fallback: fallback({ whileLoading: false }) }))).toEqual([]);
            const loaded = buildCustomerThreadMessages(
                baseOpts({ messagesData: [], fallback: fallback({ whileLoading: false }) }),
            );
            expect(loaded.map((m) => m.id)).toEqual([FALLBACK_WELCOME_ID, FALLBACK_START_NOTE_ID]);
        });
    });
});

describe("parseWelcomeRates", () => {
    it("formats the stored cents as dollar strings", () => {
        expect(
            parseWelcomeRates({ ticket_start_price: 2500, ticket_price_minute_first_60: 150, ticket_price_minute_after_60: 0 }),
        ).toEqual({ rates: { startPrice: "25.00", first60Price: "1.50", after60Price: "0.00" }, isFree: false });
    });

    it("returns the free state when the row says so", () => {
        expect(
            parseWelcomeRates({ ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0, is_free: true }),
        ).toEqual({ rates: null, isFree: true });
    });

    it("counts a missing price as 0 once another one is stored", () => {
        expect(parseWelcomeRates({ ticket_start_price: 500, ticket_price_minute_first_60: null }).rates).toEqual({
            startPrice: "5.00",
            first60Price: "0.00",
            after60Price: "0.00",
        });
    });

    it("returns no rates for a ticket without a snapshot (all prices null) or malformed metadata", () => {
        const none = { rates: null, isFree: false };
        expect(
            parseWelcomeRates({
                ticket_start_price: null,
                ticket_price_minute_first_60: null,
                ticket_price_minute_after_60: null,
                currency: "usd",
                is_free: false,
            }),
        ).toEqual(none);
        expect(parseWelcomeRates(null)).toEqual(none);
        expect(parseWelcomeRates(undefined)).toEqual(none);
        expect(parseWelcomeRates("25.00")).toEqual(none);
        expect(parseWelcomeRates([2500])).toEqual(none);
        expect(parseWelcomeRates({ ticket_start_price: "2500" })).toEqual(none);
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
