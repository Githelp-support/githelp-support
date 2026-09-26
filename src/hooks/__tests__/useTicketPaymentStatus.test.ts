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
    },
}));

import { useTicketPaymentStatus } from "../useTicketPaymentStatus";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
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
