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
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            maybeSingle: selectMock,
                        })),
                    })),
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
            data: { status: "authorized" },
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
            data: { status: "requires_action" },
            error: null,
        });
        const { result } = renderHook(
            () => useTicketPaymentStatus("ticket-4", { slaId: null }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe("requires_action"));
        expect(result.current.isReady).toBe(false);
    });
});
