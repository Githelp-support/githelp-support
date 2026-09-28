import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

type Binding = {
    filter: { event: string; table: string; filter?: string };
    cb: (payload: unknown) => void | Promise<void>;
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

vi.mock("@/hooks/useTicketParticipants", () => ({
    refetchTicketParticipants: vi.fn(() => Promise.resolve()),
}));

import { supabase } from "@/lib/supabase/client";
import { refetchTicketParticipants } from "@/hooks/useTicketParticipants";
import { useRealtimeMessages, isTimeLoggedMessage, isTimeEntryMessage } from "../useRealtimeMessages";

const TICKET = "ticket-1";
const timeEntriesKey = (ticket: string) => ["time-entries", undefined, ticket, undefined, undefined, undefined];

function setup() {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
    const hook = renderHook(() => useRealtimeMessages(TICKET), { wrapper });
    return { queryClient, invalidate, hook };
}

async function fire(payload: unknown) {
    const b = bindings.find((x) => x.filter.table === "tickets_messages");
    if (!b) throw new Error("no binding for tickets_messages");
    await b.cb(payload);
}

const timeLoggedInsert = {
    eventType: "INSERT",
    new: { id: "m1", metadata: { kind: "time_logged", time_milliseconds: 1_800_000 } },
};

describe("isTimeLoggedMessage", () => {
    it("matches only an INSERT carrying metadata.kind = time_logged", () => {
        expect(isTimeLoggedMessage(timeLoggedInsert)).toBe(true);
        expect(isTimeLoggedMessage({ eventType: "INSERT", new: { metadata: { kind: "payment_authorized" } } })).toBe(false);
        expect(isTimeLoggedMessage({ eventType: "INSERT", new: { metadata: null } })).toBe(false);
        expect(isTimeLoggedMessage({ eventType: "UPDATE", new: { metadata: { kind: "time_logged" } } })).toBe(false);
        expect(isTimeLoggedMessage({ eventType: "DELETE", old: { id: "m1" } })).toBe(false);
        expect(isTimeLoggedMessage(undefined)).toBe(false);
        expect(isTimeLoggedMessage({})).toBe(false);
    });
});

describe("isTimeEntryMessage", () => {
    it("matches INSERTs of time_logged and the customer review kinds only", () => {
        expect(isTimeEntryMessage(timeLoggedInsert)).toBe(true);
        expect(isTimeEntryMessage({ eventType: "INSERT", new: { metadata: { kind: "time_entry_accepted" } } })).toBe(true);
        expect(isTimeEntryMessage({ eventType: "INSERT", new: { metadata: { kind: "time_entry_declined" } } })).toBe(true);
        expect(isTimeEntryMessage({ eventType: "INSERT", new: { metadata: { kind: "payment_authorized" } } })).toBe(false);
        expect(isTimeEntryMessage({ eventType: "UPDATE", new: { metadata: { kind: "time_entry_declined" } } })).toBe(false);
        expect(isTimeEntryMessage(undefined)).toBe(false);
    });
});

describe("useRealtimeMessages", () => {
    beforeEach(() => {
        bindings.length = 0;
        vi.clearAllMocks();
    });

    it("subscribes to this ticket's messages", () => {
        setup();

        expect(supabase.channel).toHaveBeenCalledWith(`ticket-messages-${TICKET}`);
        expect(bindings.map((b) => b.filter)).toEqual([
            { event: "*", schema: "public", table: "tickets_messages", filter: `ticket_id=eq.${TICKET}` },
        ]);
        expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
    });

    it("a plain message refreshes messages, ticket details and participants but not time entries", async () => {
        const { queryClient, invalidate } = setup();
        queryClient.setQueryData(timeEntriesKey(TICKET), []);

        await fire({ eventType: "INSERT", new: { id: "m2", metadata: null } });

        await waitFor(() => {
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-messages", TICKET] });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tickets-with-details"] });
        });
        expect(refetchTicketParticipants).toHaveBeenCalledWith(queryClient, TICKET);
        expect(queryClient.getQueryState(timeEntriesKey(TICKET))?.isInvalidated).toBe(false);
    });

    it("a time_logged system message also refreshes this ticket's time entries only", async () => {
        const { queryClient } = setup();
        queryClient.setQueryData(timeEntriesKey(TICKET), []);
        queryClient.setQueryData(timeEntriesKey("other"), []);

        await fire(timeLoggedInsert);

        await waitFor(() => {
            expect(queryClient.getQueryState(timeEntriesKey(TICKET))?.isInvalidated).toBe(true);
        });
        expect(queryClient.getQueryState(timeEntriesKey("other"))?.isInvalidated).toBe(false);
    });

    it("a time_entry_declined system message refreshes this ticket's time entries", async () => {
        const { queryClient } = setup();
        queryClient.setQueryData(timeEntriesKey(TICKET), []);

        await fire({ eventType: "INSERT", new: { id: "m3", metadata: { kind: "time_entry_declined", time_entry_id: "te1" } } });

        await waitFor(() => {
            expect(queryClient.getQueryState(timeEntriesKey(TICKET))?.isInvalidated).toBe(true);
        });
    });

    it("does nothing without a ticket id", () => {
        const queryClient = new QueryClient();
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(QueryClientProvider, { client: queryClient }, children);
        renderHook(() => useRealtimeMessages(undefined), { wrapper });

        expect(supabase.channel).not.toHaveBeenCalled();
    });

    it("removes the channel on unmount", () => {
        const { hook } = setup();
        hook.unmount();
        expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);
    });
});
