import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useRealtimeTickets } from "../useRealtimeTickets";

type Handler = (payload: { eventType: string; old?: { id?: string }; new?: Record<string, unknown> }) => void;

const realtime = vi.hoisted(() => ({
    handler: null as Handler | null,
    filter: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase/client", () => {
    const channel = {
        on: vi.fn((_type: string, filter: Record<string, unknown>, handler: Handler) => {
            realtime.filter = filter;
            realtime.handler = handler;
            return channel;
        }),
        subscribe: vi.fn(() => channel),
    };
    return { supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() } };
});

function setup(projectId = "p1") {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtimeTickets(projectId), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            createElement(QueryClientProvider, { client: queryClient }, children),
    });
    return invalidate;
}

describe("useRealtimeTickets", () => {
    beforeEach(() => {
        realtime.handler = null;
        realtime.filter = null;
    });

    it("listens to every change on the project's tickets", () => {
        setup();
        expect(realtime.filter).toMatchObject({ event: "*", table: "tickets", filter: "project_id=eq.p1" });
    });

    it.each([
        ["the backend cancels an abandoned guest ticket", { status: "cancelled", guest: true }],
        ["deleted_at is set later", { status: "cancelled", guest: true, deleted_at: "2026-11-18T10:30:00Z" }],
    ])("refetches the ticket lists when %s", (_label, next) => {
        const invalidate = setup();

        realtime.handler!({ eventType: "UPDATE", old: { id: "t1" }, new: { id: "t1", ...next } });

        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tickets", "p1"] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tickets-with-details", "p1"] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket", "t1"] });
    });
});
