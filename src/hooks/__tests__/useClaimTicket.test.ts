import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({ data: { id: "row-1" }, error: null })),
                    })),
                })),
            })),
            update: vi.fn(() => ({
                eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({ data: { id: "row-1", claimed: true }, error: null })),
                    })),
                })),
            })),
        })),
        functions: { invoke },
        rpc,
    },
}));

import { useClaimTicket } from "../useTicketParticipants";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

describe("useClaimTicket", () => {
    beforeEach(() => {
        invoke.mockReset();
        rpc.mockReset();
        rpc.mockResolvedValue({ data: { ticket_id: "t", already_claimed: false }, error: null });
    });

    it("invokes payments-authorize-on-claim after the claim row commits", async () => {
        invoke.mockResolvedValueOnce({ data: { status: "authorized" }, error: null });
        const { result } = renderHook(() => useClaimTicket(), { wrapper: makeWrapper() });
        await result.current.mutateAsync({ ticketId: "ticket-1", participantId: "helper-1" });
        await waitFor(() =>
            expect(invoke).toHaveBeenCalledWith(
                "payments-authorize-on-claim",
                { body: { ticket_id: "ticket-1" } },
            ),
        );
    });

    it("claims atomically on the server", async () => {
        invoke.mockResolvedValueOnce({ data: { status: "authorized" }, error: null });
        const { result } = renderHook(() => useClaimTicket(), { wrapper: makeWrapper() });
        await result.current.mutateAsync({ ticketId: "ticket-3", participantId: "helper-1" });
        expect(rpc).toHaveBeenCalledWith("claim_ticket_as_helper", { p_ticket: "ticket-3" });
    });

    it("explains a lost race and doesn't authorize payment", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: "ticket_not_available" } });
        const { result } = renderHook(() => useClaimTicket(), { wrapper: makeWrapper() });
        await expect(result.current.mutateAsync({ ticketId: "ticket-4", participantId: "helper-1" }))
            .rejects.toThrow("Someone else just claimed this ticket.");
        expect(invoke).not.toHaveBeenCalled();
    });

    it("does not throw when authorize-on-claim fails (claim still succeeds)", async () => {
        invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
        const { result } = renderHook(() => useClaimTicket(), { wrapper: makeWrapper() });
        await result.current.mutateAsync({ ticketId: "ticket-2", participantId: "helper-1" });
    });
});
