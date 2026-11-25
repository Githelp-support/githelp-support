import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import {
    TICKET_READ_HEARTBEAT_MS,
    useMarkTicketRead,
    useTicketUnreadFlags,
} from "../useTicketReadState";

const rpc = vi.mocked(supabase.rpc);

function makeWrapper(client: QueryClient) {
    function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client }, children);
    }
    return Wrapper;
}

function newClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
}

let visibility: DocumentVisibilityState = "visible";
function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    document.dispatchEvent(new Event("visibilitychange"));
}

const markCalls = () => rpc.mock.calls.filter(([name]) => name === "mark_ticket_read");

beforeEach(() => {
    rpc.mockReset();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

describe("useTicketUnreadFlags", () => {
    it("calls ticket_unread_flags with sorted, unique ids and returns a Map", async () => {
        rpc.mockResolvedValue({
            data: [
                { ticket_id: "a", has_unread: true },
                { ticket_id: "b", has_unread: false },
            ],
            error: null,
        } as never);
        const client = newClient();
        const { result } = renderHook(() => useTicketUnreadFlags(["b", "a", "b"]), {
            wrapper: makeWrapper(client),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(rpc).toHaveBeenCalledWith("ticket_unread_flags", { p_ticket_ids: ["a", "b"] });
        expect(result.current.data).toEqual(new Map([["a", true], ["b", false]]));
        expect(client.getQueryCache().find({ queryKey: ["ticket-unread", ["a", "b"]] })).toBeDefined();
    });

    it("does not query without ids", () => {
        renderHook(() => useTicketUnreadFlags([]), { wrapper: makeWrapper(newClient()) });
        expect(rpc).not.toHaveBeenCalled();
    });
});

describe("useMarkTicketRead", () => {
    beforeEach(() => {
        rpc.mockResolvedValue({ data: null, error: null } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("marks the latest message and invalidates unread, notifications and sidebar queries", async () => {
        const client = newClient();
        const invalidate = vi.spyOn(client, "invalidateQueries");
        renderHook(() => useMarkTicketRead("t1", "m1", { enabled: true }), {
            wrapper: makeWrapper(client),
        });

        await waitFor(() => expect(invalidate).toHaveBeenCalled());
        expect(rpc).toHaveBeenCalledWith("mark_ticket_read", { p_ticket_id: "t1", p_message_id: "m1" });
        const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
        expect(keys).toEqual(
            expect.arrayContaining([
                ["ticket-unread"],
                ["notifications"],
                ["helper-claimed-tickets-sidebar"],
                ["user-active-tickets-sidebar"],
            ]),
        );
    });

    it("dedupes the same message id and marks again when it changes", async () => {
        const client = newClient();
        const { rerender } = renderHook(
            ({ messageId }) => useMarkTicketRead("t1", messageId, { enabled: true }),
            { wrapper: makeWrapper(client), initialProps: { messageId: "m1" } },
        );
        await waitFor(() => expect(markCalls()).toHaveLength(1));

        rerender({ messageId: "m1" });
        rerender({ messageId: "m1" });
        expect(markCalls()).toHaveLength(1);

        rerender({ messageId: "m2" });
        await waitFor(() => expect(markCalls()).toHaveLength(2));
        expect(markCalls()[1][1]).toEqual({ p_ticket_id: "t1", p_message_id: "m2" });
    });

    it("retries a message id after a failed call", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
        const client = newClient();
        const { rerender } = renderHook(
            ({ enabled }) => useMarkTicketRead("t1", "m1", { enabled }),
            { wrapper: makeWrapper(client), initialProps: { enabled: true } },
        );
        await waitFor(() => expect(markCalls()).toHaveLength(1));

        rerender({ enabled: false });
        rerender({ enabled: true });
        await waitFor(() => expect(markCalls()).toHaveLength(2));
    });

    it("does nothing while disabled or without a message", () => {
        const client = newClient();
        renderHook(() => useMarkTicketRead("t1", "m1", { enabled: false }), { wrapper: makeWrapper(client) });
        renderHook(() => useMarkTicketRead("t1", null, { enabled: true }), { wrapper: makeWrapper(client) });
        expect(markCalls()).toHaveLength(0);
    });

    it("sends a heartbeat every 30 s while visible, pausing while hidden", async () => {
        vi.useFakeTimers();
        const client = newClient();
        renderHook(() => useMarkTicketRead("t1", "m1", { enabled: true }), {
            wrapper: makeWrapper(client),
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(markCalls()).toHaveLength(1);

        await act(async () => {
            vi.advanceTimersByTime(TICKET_READ_HEARTBEAT_MS);
        });
        expect(markCalls()).toHaveLength(2);
        expect(markCalls()[1][1]).toEqual({ p_ticket_id: "t1", p_message_id: "m1" });

        setVisibility("hidden");
        await act(async () => {
            vi.advanceTimersByTime(TICKET_READ_HEARTBEAT_MS * 2);
        });
        expect(markCalls()).toHaveLength(2);

        setVisibility("visible");
        expect(markCalls()).toHaveLength(3);
    });

    it("stops the heartbeat on unmount", async () => {
        vi.useFakeTimers();
        const { unmount } = renderHook(() => useMarkTicketRead("t1", "m1", { enabled: true }), {
            wrapper: makeWrapper(newClient()),
        });
        await act(async () => {
            await Promise.resolve();
        });
        const before = markCalls().length;
        unmount();
        vi.advanceTimersByTime(TICKET_READ_HEARTBEAT_MS * 3);
        expect(markCalls()).toHaveLength(before);
    });
});
