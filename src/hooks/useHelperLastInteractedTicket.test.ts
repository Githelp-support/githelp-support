import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import { useHelperLastInteractedTicket } from "./useHelperLastInteractedTicket";

/** The helper's AUTH user id (what the hook receives). */
const HELPER_USER = "helper-user-1";

type Row = Record<string, unknown>;
type Fixture = { tickets?: Row[]; messages?: Row[]; participants?: Row[] };

function ticket(id: string, overrides: Row = {}): Row {
    return {
        id,
        title: `Ticket ${id}`,
        project_id: "proj-1",
        status: "available",
        created_by: "customer-1",
        completed_at: null,
        cancelled_at: null,
        end_requested_at: null,
        end_requested_by: null,
        time_review_requested_at: null,
        time_review_requested_by: null,
        deleted_at: null,
        ...overrides,
    };
}

function participant(ticket_id: string, created_at: string): Row {
    return { ticket_id, participant_id: HELPER_USER, created_at, claimed: true, last_read_message_id: null };
}

function message(id: string, ticket_id: string, created_at: string): Row {
    return { id, ticket_id, sender_id: HELPER_USER, created_at, deleted_at: null };
}

/** Chainable supabase mock that applies eq / is / in filters to the fixture. */
function setupSupabase(fx: Fixture) {
    const tables: Record<string, Row[]> = {
        tickets: fx.tickets ?? [],
        tickets_messages: fx.messages ?? [],
        tickets_participants: fx.participants ?? [],
        tickets_time_entries: [],
    };

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        const filters: Array<{ op: string; col: string; val: unknown }> = [];
        const resolveRows = () =>
            (tables[table] ?? []).filter((row) =>
                filters.every((f) => {
                    const value = row[f.col];
                    if (f.op === "or") {
                        // Only the abandoned-guest-ticket filter is modelled here.
                        if (f.col !== "guest.eq.false,status.neq.cancelled") throw new Error(`unexpected or(): ${f.col}`);
                        return !(row.guest === true) || row.status !== "cancelled";
                    }
                    if (f.op === "in") return (f.val as unknown[]).includes(value);
                    return value === f.val;
                })
            );

        const builder: Record<string, unknown> = {};
        const chain = (op: string) => (col: string, val?: unknown) => {
            filters.push({ op, col, val });
            return builder;
        };
        builder.select = () => builder;
        builder.eq = chain("eq");
        builder.is = chain("is");
        builder.in = chain("in");
        builder.or = chain("or");
        builder.then = (
            onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
            onRejected?: (e: unknown) => unknown
        ) => Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected);
        return builder;
    }) as never);
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

async function renderLast(userId: string | undefined = HELPER_USER) {
    const { result } = renderHook(() => useHelperLastInteractedTicket(userId), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data;
}

describe("useHelperLastInteractedTicket", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns null when the helper has no tickets", async () => {
        setupSupabase({});
        expect(await renderLast()).toBeNull();
    });

    it("returns the most recently interacted ticket with isEnded false while it is active", async () => {
        setupSupabase({
            tickets: [
                ticket("t-old", { status: "completed", completed_at: "2026-01-05T00:00:00.000Z" }),
                ticket("t-active", { status: "in_progress", project_id: "proj-2" }),
            ],
            participants: [
                participant("t-old", "2026-01-01T00:00:00.000Z"),
                participant("t-active", "2026-01-02T00:00:00.000Z"),
            ],
            messages: [message("m1", "t-active", "2026-01-10T00:00:00.000Z")],
        });

        expect(await renderLast()).toEqual({
            id: "t-active",
            project_id: "proj-2",
            status: "in_progress",
            isEnded: false,
        });
    });

    it("returns isEnded true when the last ticket is completed", async () => {
        setupSupabase({
            tickets: [
                ticket("t-active", { status: "in_progress" }),
                ticket("t-done", { status: "completed", completed_at: "2026-01-20T00:00:00.000Z" }),
            ],
            participants: [
                participant("t-active", "2026-01-02T00:00:00.000Z"),
                participant("t-done", "2026-01-01T00:00:00.000Z"),
            ],
            messages: [message("m1", "t-active", "2026-01-10T00:00:00.000Z")],
        });

        expect(await renderLast()).toEqual({
            id: "t-done",
            project_id: "proj-1",
            status: "completed",
            isEnded: true,
        });
    });

    it("returns isEnded true when the last ticket is cancelled", async () => {
        setupSupabase({
            tickets: [ticket("t-cancel", { status: "cancelled", cancelled_at: "2026-01-20T00:00:00.000Z" })],
            participants: [participant("t-cancel", "2026-01-01T00:00:00.000Z")],
        });

        expect(await renderLast()).toMatchObject({ id: "t-cancel", status: "cancelled", isEnded: true });
    });
});
