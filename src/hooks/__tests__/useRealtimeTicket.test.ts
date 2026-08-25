import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

type Binding = {
    filter: { event: string; table: string; filter?: string };
    cb: (payload: unknown) => void;
};

const bindings: Binding[] = [];
const channelMock = {
    on: vi.fn((_type: string, filter: Binding["filter"], cb: Binding["cb"]) => {
        bindings.push({ filter, cb });
        return channelMock;
    }),
    subscribe: vi.fn(() => channelMock),
};

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        channel: vi.fn(() => channelMock),
        removeChannel: vi.fn(),
    },
}));

import { supabase } from "@/lib/supabase/client";
import { useRealtimeTicket } from "../useRealtimeTicket";

const TICKET = "ticket-1";

function setup() {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
    const hook = renderHook(() => useRealtimeTicket(TICKET), { wrapper });
    return { queryClient, invalidate, hook };
}

function fire(table: string) {
    const b = bindings.find((x) => x.filter.table === table);
    if (!b) throw new Error(`no binding for ${table}`);
    b.cb({});
}

describe("useRealtimeTicket", () => {
    beforeEach(() => {
        bindings.length = 0;
        vi.clearAllMocks();
    });

    it("subscribes to the ticket row plus its participants and time entries", () => {
        setup();

        expect(supabase.channel).toHaveBeenCalledWith(`ticket-row-${TICKET}`);
        expect(bindings.map((b) => b.filter)).toEqual([
            { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${TICKET}` },
            { event: "*", schema: "public", table: "tickets_participants", filter: `ticket_id=eq.${TICKET}` },
            { event: "*", schema: "public", table: "tickets_time_entries", filter: `ticket_id=eq.${TICKET}` },
        ]);
        expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
    });

    it("a ticket UPDATE (e.g. a claim) also refreshes participants and time entries", async () => {
        const { queryClient, invalidate } = setup();
        // Seed queries so the time-entries predicate has something to match.
        queryClient.setQueryData(["time-entries", undefined, TICKET, undefined, undefined, undefined], []);
        queryClient.setQueryData(["time-entries", undefined, "other", undefined, undefined, undefined], []);
        queryClient.setQueryData(["ticket-participants", TICKET], []);

        fire("tickets");

        // Participants are refreshed via cancel-then-invalidate (async).
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-participants", TICKET] })
        );
        const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
        expect(keys).toEqual(
            expect.arrayContaining([
                ["ticket", TICKET],
                ["ticket-with-details", TICKET],
                ["ticket-payment-status", TICKET],
                ["ticket-participants", TICKET],
            ])
        );
        // Predicate-based time-entries invalidation only touches this ticket's query.
        const mine = queryClient.getQueryState(["time-entries", undefined, TICKET, undefined, undefined, undefined]);
        const other = queryClient.getQueryState(["time-entries", undefined, "other", undefined, undefined, undefined]);
        expect(mine?.isInvalidated).toBe(true);
        expect(other?.isInvalidated).toBe(false);
    });

    it("participant and time-entry events refresh only their own query", async () => {
        const { queryClient, invalidate } = setup();
        queryClient.setQueryData(["time-entries", undefined, TICKET, undefined, undefined, undefined], []);

        fire("tickets_participants");
        await waitFor(() =>
            expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ["ticket-participants", TICKET] })
        );

        invalidate.mockClear();
        fire("tickets_time_entries");
        expect(invalidate).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryState(["time-entries", undefined, TICKET, undefined, undefined, undefined])?.isInvalidated).toBe(true);
    });

    it("removes the channel on unmount and does nothing without a ticket id", () => {
        const { hook } = setup();
        hook.unmount();
        expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);

        vi.clearAllMocks();
        const queryClient = new QueryClient();
        renderHook(() => useRealtimeTicket(null), {
            wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
        });
        expect(supabase.channel).not.toHaveBeenCalled();
    });
});
