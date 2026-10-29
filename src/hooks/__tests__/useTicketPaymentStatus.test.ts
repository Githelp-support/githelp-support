import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { selectMock, channelMock } = vi.hoisted(() => ({
    selectMock: vi.fn(),
    channelMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: selectMock,
                })),
            })),
        })),
        channel: channelMock,
        removeChannel: vi.fn(),
    },
}));

import { derivePaymentStatus, useTicketPaymentStatus } from "../useTicketPaymentStatus";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

beforeEach(() => {
    selectMock.mockReset();
    channelMock.mockReset();
    channelMock.mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
    });
});

describe("useTicketPaymentStatus", () => {
    it("returns isReady=true immediately when slaId is provided", async () => {
        selectMock.mockResolvedValue({ data: null, error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-1", { slaId: "sla-1" }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.status).toBe("sla_covered");
    });

    it("returns isReady=true when a payments row has status=authorized", async () => {
        selectMock.mockResolvedValue({
            data: [{ status: "authorized" }],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-2", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.status).toBe("authorized");
    });

    it("returns isReady=false when no payments row exists yet", async () => {
        selectMock.mockResolvedValue({ data: null, error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-3", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("none"));
        expect(result.current.isReady).toBe(false);
    });

    it("returns isReady=false when payments row is in a non-authorized state", async () => {
        selectMock.mockResolvedValue({
            data: [{ status: "requires_action" }],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-4", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("requires_action"));
        expect(result.current.isReady).toBe(false);
    });

    it("sums captured amounts across hold capture and overage rows", async () => {
        selectMock.mockResolvedValue({
            data: [
                { status: "distributing", captured_amount_smallest_unit: 3000 },
                { status: "failed", captured_amount_smallest_unit: null },
                { status: "completed", captured_amount_smallest_unit: 10000 },
            ],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-5", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("distributing"));
        expect(result.current.capturedAmountSmallestUnit).toBe(13000);
    });

    it("sums the helper/project/Stripe-fee split across captured rows only", async () => {
        selectMock.mockResolvedValue({
            data: [
                {
                    status: "distributing",
                    captured_amount_smallest_unit: 3000,
                    amount_platform_smallest_unit: 117,
                    amount_project_smallest_unit: 0,
                    amount_helper_smallest_unit: 2883,
                },
                {
                    status: "failed",
                    captured_amount_smallest_unit: null,
                    amount_platform_smallest_unit: 999,
                    amount_project_smallest_unit: 999,
                    amount_helper_smallest_unit: 999,
                },
                {
                    status: "completed",
                    captured_amount_smallest_unit: 10000,
                    amount_platform_smallest_unit: 320,
                    amount_project_smallest_unit: 968,
                    amount_helper_smallest_unit: null,
                },
            ],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-splits", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("distributing"));
        expect(result.current.capturedSplits).toEqual({
            helperSmallestUnit: 2883,
            projectSmallestUnit: 968,
            stripeFeeSmallestUnit: 437,
        });
    });

    it("has no split before anything is captured", async () => {
        selectMock.mockResolvedValue({ data: [{ status: "authorized" }], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-uncaptured", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("authorized"));
        expect(result.current.capturedSplits).toBeNull();
    });
});

describe("useTicketPaymentStatus failure reason", () => {
    it("exposes failure_reason from the latest row when it is failed", async () => {
        selectMock.mockResolvedValue({
            data: [
                { status: "failed", captured_amount_smallest_unit: null, failure_reason: " Your card was declined. " },
                { status: "completed", captured_amount_smallest_unit: 2500, failure_reason: null },
            ],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-fail", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("failed"));
        expect(result.current.failureReason).toBe("Your card was declined.");
        // Earlier captured segments still count toward what was charged.
        expect(result.current.capturedAmountSmallestUnit).toBe(2500);
    });

    it("clears the reason once a later row succeeds", async () => {
        selectMock.mockResolvedValue({
            data: [
                { status: "distributing", captured_amount_smallest_unit: 4000, failure_reason: null },
                { status: "failed", captured_amount_smallest_unit: null, failure_reason: "declined" },
            ],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-recovered", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("distributing"));
        expect(result.current.failureReason).toBeNull();
    });

    it("opens the gate for a free-support ticket with no payments row", async () => {
        selectMock.mockResolvedValue({ data: [], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-free", { slaId: null, isFree: true }),
            { wrapper: makeWrapper() },
        );
        // Closed while the payments rows are still loading…
        expect(result.current.status).toBe("none");
        expect(result.current.isReady).toBe(false);
        // …and open once we know there is no payments row.
        await waitFor(() => expect(result.current.status).toBe("free"));
        expect(result.current.isReady).toBe(true);
    });

    it("keeps the gate closed without a payments row when the project is not free", async () => {
        selectMock.mockResolvedValue({ data: [], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-paid", { slaId: null, isFree: false }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(selectMock).toHaveBeenCalled());
        expect(result.current.status).toBe("none");
        expect(result.current.isReady).toBe(false);
    });

    it("lets an existing payments row take precedence over isFree", async () => {
        selectMock.mockResolvedValue({
            data: [{ status: "failed", captured_amount_smallest_unit: null, failure_reason: "declined" }],
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-was-paid", { slaId: null, isFree: true }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("failed"));
        expect(result.current.isReady).toBe(false);
    });
});

type Row = Parameters<typeof derivePaymentStatus>[0][number];
const HOLD_EXPIRES = "2026-11-05T00:00:00Z";
const captured = (amount: number, extra: Partial<Row> = {}): Row => ({
    status: "distributing",
    captured_amount_smallest_unit: amount,
    hold_expires_at: HOLD_EXPIRES,
    failure_reason: null,
    ...extra,
});
const waived: Row = {
    status: "cancelled",
    captured_amount_smallest_unit: null,
    hold_expires_at: HOLD_EXPIRES,
    failure_reason: "below_minimum_waived: hold released, amount below the minimum charge",
};
// A weekly renewal hold the bank refused (no card_declined: marker on a hold row).
const renewalDeclined: Row = {
    status: "failed",
    captured_amount_smallest_unit: null,
    hold_expires_at: HOLD_EXPIRES,
    failure_reason: "Your card was declined.",
};
// A declined remainder charge (no hold window): money is still owed.
const remainderDeclined: Row = {
    status: "failed",
    captured_amount_smallest_unit: null,
    hold_expires_at: null,
    failure_reason: "card_declined: Your card has insufficient funds.",
};

describe("derivePaymentStatus", () => {
    it("keeps the newest row's status while the ticket is open", () => {
        expect(derivePaymentStatus([renewalDeclined, captured(2500)], "in-progress")).toEqual({
            status: "failed",
            failureReason: "Your card was declined.",
        });
        expect(derivePaymentStatus([waived, captured(2500)], null).status).toBe("cancelled");
    });

    it("shows a completed ticket whose final hold was waived as paid when segments were captured", () => {
        expect(derivePaymentStatus([waived, captured(2500), captured(4000)], "completed").status).toBe("distributing");
        expect(
            derivePaymentStatus([waived, captured(2500, { status: "completed" })], "completed").status,
        ).toBe("completed");
    });

    it("reports waived when only below-minimum releases happened", () => {
        expect(derivePaymentStatus([waived], "completed")).toEqual({ status: "waived", failureReason: null });
    });

    it("treats a declined renewal hold as paid once the ticket completed with captured segments", () => {
        expect(derivePaymentStatus([renewalDeclined, captured(2500)], "completed").status).toBe("distributing");
    });

    it("stays failed while a declined charge leaves money owed", () => {
        expect(derivePaymentStatus([remainderDeclined, captured(2500)], "completed")).toEqual({
            status: "failed",
            failureReason: "Your card has insufficient funds.",
        });
        // A declined capture of an authorized hold (card_declined: marker on a hold row).
        expect(
            derivePaymentStatus(
                [{ ...renewalDeclined, failure_reason: "card_declined: Do not honor" }, captured(2500)],
                "completed",
            ).status,
        ).toBe("failed");
        // Rows without hold_expires_at (older shape) count as owed.
        expect(
            derivePaymentStatus([{ status: "failed", captured_amount_smallest_unit: null }], "completed").status,
        ).toBe("failed");
    });

    it("ignores cancelled rows when finding the latest attempt, but a later waiver settles it", () => {
        const superseded: Row = { ...waived, failure_reason: "superseded by a newer hold" };
        expect(derivePaymentStatus([superseded, remainderDeclined, captured(2500)], "completed").status).toBe("failed");
        expect(derivePaymentStatus([waived, remainderDeclined, captured(2500)], "completed").status).toBe("distributing");
        expect(derivePaymentStatus([waived, remainderDeclined], "completed").status).toBe("waived");
    });

    it("keeps an in-flight capture or charge in flight", () => {
        expect(derivePaymentStatus([{ ...captured(0), status: "authorized", captured_amount_smallest_unit: null }, captured(2500)], "completed").status).toBe("authorized");
        expect(derivePaymentStatus([{ status: "processing", captured_amount_smallest_unit: null, hold_expires_at: null }, captured(2500)], "completed").status).toBe("processing");
    });

    it("marks captured money on a cancelled ticket as refund pending", () => {
        expect(
            derivePaymentStatus(
                [
                    { ...waived, failure_reason: "hold released" },
                    captured(2500, { failure_reason: "cancelled_after_capture: refund needed" }),
                ],
                "cancelled",
            ).status,
        ).toBe("refund_pending");
        expect(derivePaymentStatus([{ ...waived, failure_reason: "hold released" }], "cancelled").status).toBe("cancelled");
    });
});

describe("useTicketPaymentStatus aggregation and flat fee", () => {
    it("derives from every row once the ticket is closed and sums the captured total", async () => {
        selectMock.mockResolvedValue({ data: [waived, captured(2500), captured(1500)], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-closed", { slaId: null, ticketStatus: "completed" }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("distributing"));
        expect(result.current.capturedAmountSmallestUnit).toBe(4000);
        expect(result.current.failureReason).toBeNull();
    });

    it("keeps the gate open on a flat-fee ticket once the start price was collected", async () => {
        selectMock.mockResolvedValue({ data: [captured(5000, { hold_expires_at: null })], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-flat", { slaId: null, isFlatFee: true }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));
    });

    it("keeps the gate closed after a capture when the ticket is billed per minute", async () => {
        selectMock.mockResolvedValue({ data: [captured(5000)], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-per-minute", { slaId: null, isFlatFee: false }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("distributing"));
        expect(result.current.isReady).toBe(false);
    });

    it("keeps a flat-fee gate closed until something was collected", async () => {
        selectMock.mockResolvedValue({ data: [renewalDeclined], error: null });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-flat-unpaid", { slaId: null, isFlatFee: true }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("failed"));
        expect(result.current.isReady).toBe(false);
    });
});
