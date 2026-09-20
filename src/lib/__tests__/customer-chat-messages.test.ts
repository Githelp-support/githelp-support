import { describe, it, expect } from "vitest";
import {
    AUTO_REPLY,
    buildCustomerThreadMessages,
    describeChargedLine,
    type CustomerThreadOptions,
    type PersistedTicketMessage,
} from "../customer-chat-messages";

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
            content: AUTO_REPLY,
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
            content: AUTO_REPLY,
        });
        // Only one auto-reply, after the first user message — not the second.
        expect(list.filter((m) => m.id === "auto-reply")).toHaveLength(1);
    });

    it("is absent when there is no user message", () => {
        const list = buildCustomerThreadMessages(baseOpts());
        expect(list.some((m) => m.id === "auto-reply")).toBe(false);
    });

    it("keeps the bold markdown around the response time", () => {
        expect(AUTO_REPLY).toContain("**18 minutes**");
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
