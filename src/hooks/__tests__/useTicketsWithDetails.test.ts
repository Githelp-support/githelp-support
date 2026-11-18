import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useTicketsWithDetails, useTicketWithDetails, useUserTickets } from "../useTicketsWithDetails";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

type Chain = Record<string, ReturnType<typeof vi.fn>> & { then: unknown };

/** One recording, thenable query builder per table. */
function setupSupabase(rowsByTable: Record<string, unknown[]>) {
    const chains: Record<string, Chain> = {};
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        if (chains[table]) return chains[table];
        const rows = rowsByTable[table] ?? [];
        const chain = {} as Chain;
        for (const method of ["select", "is", "or", "eq", "in", "order"]) {
            chain[method] = vi.fn(() => chain);
        }
        chain.single = vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null }));
        chain.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: rows, error: null }).then(resolve);
        chains[table] = chain;
        return chain;
    }) as never);
    return chains;
}

describe("useTicketsWithDetails: abandoned guest tickets", () => {
    beforeEach(() => vi.clearAllMocks());

    it("the helper/admin project list excludes cancelled guest tickets", async () => {
        const chains = setupSupabase({
            tickets: [{ id: "t1", project_id: "p1", created_by: null, status: "available" }],
        });

        const { result } = renderHook(() => useTicketsWithDetails("p1"), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(chains.tickets.is).toHaveBeenCalledWith("deleted_at", null);
        expect(chains.tickets.or).toHaveBeenCalledWith("guest.eq.false,status.neq.cancelled");
        expect(result.current.data).toHaveLength(1);
    });

    it("the customer's own ticket list is not filtered", async () => {
        const chains = setupSupabase({
            tickets: [{ id: "t1", project_id: "p1", created_by: "u1", guest: true, status: "cancelled" }],
        });

        const { result } = renderHook(() => useUserTickets("u1"), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(chains.tickets.or).not.toHaveBeenCalled();
        expect(result.current.data).toHaveLength(1);
    });

    it("the single-ticket fetch shared with the support chat is not filtered", async () => {
        const chains = setupSupabase({
            tickets: [{ id: "t1", project_id: "p1", created_by: null, guest: true, status: "cancelled" }],
        });

        const { result } = renderHook(() => useTicketWithDetails("t1"), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(chains.tickets.or).not.toHaveBeenCalled();
        expect(result.current.data?.id).toBe("t1");
    });
});
