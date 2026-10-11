import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import { useUserRecentTicketInteractions } from "./useUserRecentTicketInteractions";

const USER = "user-1";
const HELPER = "helper-1";

type Filter = { op: string; col: string; val: unknown };

type Fixture = {
    tickets?: Array<Record<string, unknown>>;
    messages?: Array<Record<string, unknown>>;
    payments?: Array<Record<string, unknown>>;
    participants?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    brandings?: Array<Record<string, unknown>>;
    users?: Array<Record<string, unknown>>;
};

function ticket(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Ticket ${id}`,
        project_id: "proj-1",
        status: "available",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: USER,
        completed_at: null,
        cancelled_at: null,
        end_requested_at: null,
        end_requested_by: null,
        deleted_at: null,
        ...overrides,
    };
}

/**
 * Chainable supabase mock. Resolves rows for each table by applying the
 * recorded eq / is / in filters to the fixture, so the hook's queries behave
 * like a tiny in-memory database.
 */
function setupSupabase(fx: Fixture) {
    const tables: Record<string, Array<Record<string, unknown>>> = {
        tickets: fx.tickets ?? [],
        tickets_messages: fx.messages ?? [],
        payments: fx.payments ?? [],
        tickets_participants: fx.participants ?? [],
        projects: fx.projects ?? [{ project_id: "proj-1", name: "Project One", logo_url: "p.png" }],
        projects_branding: fx.brandings ?? [],
        users_public: fx.users ?? [{ id: HELPER, name: "Helpful Helper", avatar_url: "h.png" }],
    };

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        const filters: Filter[] = [];
        const rows = tables[table] ?? [];

        const resolveRows = () =>
            rows.filter((row) =>
                filters.every((f) => {
                    if (f.col === "ticket.created_by") {
                        // payments!inner join on the ticket owner
                        const t = tables.tickets.find((tk) => tk.id === row.ticket_id);
                        return !!t && t.created_by === f.val;
                    }
                    const value = row[f.col];
                    if (f.op === "eq") return value === f.val;
                    if (f.op === "is") return value === f.val || (f.val === null && value === undefined);
                    if (f.op === "in") return (f.val as unknown[]).includes(value);
                    return true;
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
        builder.order = () => builder;
        builder.limit = () => builder;
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

async function renderRecent(userId: string | undefined = USER, limit?: number) {
    const { result } = renderHook(() => useUserRecentTicketInteractions(userId, limit), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
}

describe("useUserRecentTicketInteractions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("takes the max interaction timestamp across all sources per ticket", async () => {
        setupSupabase({
            tickets: [
                // created early, but a later payment is the latest interaction
                ticket("t-pay", { created_at: "2026-01-01T00:00:00.000Z" }),
                // created early, completed later
                ticket("t-done", {
                    created_at: "2026-01-02T00:00:00.000Z",
                    completed_at: "2026-01-20T00:00:00.000Z",
                    status: "completed",
                }),
                // created early, cancelled later
                ticket("t-cancel", {
                    created_at: "2026-01-03T00:00:00.000Z",
                    cancelled_at: "2026-01-15T00:00:00.000Z",
                }),
                // created early, end requested later BY the user
                ticket("t-end", {
                    created_at: "2026-01-04T00:00:00.000Z",
                    end_requested_at: "2026-01-12T00:00:00.000Z",
                    end_requested_by: USER,
                }),
                // created by someone else; user only wrote a message
                ticket("t-other", { created_by: "someone-else", created_at: "2026-01-05T00:00:00.000Z" }),
                // end requested by someone else must NOT count
                ticket("t-end-other", {
                    created_at: "2026-01-06T00:00:00.000Z",
                    end_requested_at: "2026-02-01T00:00:00.000Z",
                    end_requested_by: HELPER,
                }),
            ],
            messages: [
                { ticket_id: "t-other", sender_id: USER, created_at: "2026-01-10T00:00:00.000Z", deleted_at: null },
                // deleted message must be ignored
                { ticket_id: "t-other", sender_id: USER, created_at: "2026-03-01T00:00:00.000Z", deleted_at: "2026-03-02T00:00:00.000Z" },
                // older message on the paid ticket is dominated by the payment
                { ticket_id: "t-pay", sender_id: USER, created_at: "2026-01-08T00:00:00.000Z", deleted_at: null },
            ],
            payments: [
                { ticket_id: "t-pay", created_at: "2026-01-20T00:00:00.000Z", completed_at: "2026-01-25T00:00:00.000Z" },
            ],
        });

        const data = await renderRecent(USER, 10);
        const byId = new Map(data.map((d) => [d.id, d.last_interaction_at]));

        expect(byId.get("t-pay")).toBe("2026-01-25T00:00:00.000Z");
        expect(byId.get("t-done")).toBe("2026-01-20T00:00:00.000Z");
        expect(byId.get("t-cancel")).toBe("2026-01-15T00:00:00.000Z");
        expect(byId.get("t-end")).toBe("2026-01-12T00:00:00.000Z");
        expect(byId.get("t-other")).toBe("2026-01-10T00:00:00.000Z");
        expect(byId.get("t-end-other")).toBe("2026-01-06T00:00:00.000Z");
    });

    it("returns tickets sorted by last interaction descending", async () => {
        setupSupabase({
            tickets: [
                ticket("a", { created_at: "2026-01-01T00:00:00.000Z" }),
                ticket("b", { created_at: "2026-01-03T00:00:00.000Z" }),
                ticket("c", { created_at: "2026-01-02T00:00:00.000Z" }),
            ],
            messages: [
                // bumps "a" to the top
                { ticket_id: "a", sender_id: USER, created_at: "2026-01-09T00:00:00.000Z", deleted_at: null },
            ],
        });

        const data = await renderRecent();
        expect(data.map((d) => d.id)).toEqual(["a", "b", "c"]);
    });

    it("limits the result to 5 tickets by default", async () => {
        setupSupabase({
            tickets: Array.from({ length: 8 }, (_, i) =>
                ticket(`t-${i}`, { created_at: `2026-01-0${i + 1}T00:00:00.000Z` })
            ),
        });

        const data = await renderRecent();
        expect(data).toHaveLength(5);
        // the five most recent, newest first
        expect(data.map((d) => d.id)).toEqual(["t-7", "t-6", "t-5", "t-4", "t-3"]);
    });

    it("respects a custom limit", async () => {
        setupSupabase({
            tickets: Array.from({ length: 4 }, (_, i) =>
                ticket(`t-${i}`, { created_at: `2026-01-0${i + 1}T00:00:00.000Z` })
            ),
        });

        const data = await renderRecent(USER, 2);
        expect(data.map((d) => d.id)).toEqual(["t-3", "t-2"]);
    });

    it("derives status, helper, project details and message_count like the Tickets page", async () => {
        setupSupabase({
            tickets: [
                ticket("done", { status: "completed", created_at: "2026-01-03T00:00:00.000Z" }),
                ticket("claimed", { created_at: "2026-01-02T00:00:00.000Z", project_id: "proj-2" }),
                ticket("open", { created_at: "2026-01-01T00:00:00.000Z" }),
            ],
            participants: [
                { ticket_id: "claimed", participant_id: HELPER, claimed: true },
                // the user themself being a claimed participant does not count as a helper
                { ticket_id: "open", participant_id: USER, claimed: true },
            ],
            messages: [
                { ticket_id: "claimed", sender_id: HELPER, created_at: "2025-12-01T00:00:00.000Z", deleted_at: null },
                { ticket_id: "claimed", sender_id: HELPER, created_at: "2025-12-02T00:00:00.000Z", deleted_at: null },
                { ticket_id: "claimed", sender_id: HELPER, created_at: "2025-12-03T00:00:00.000Z", deleted_at: "2025-12-04T00:00:00.000Z" },
            ],
            projects: [
                { project_id: "proj-1", name: "Project One", logo_url: "p1.png" },
                { project_id: "proj-2", name: "Project Two", logo_url: "p2-fallback.png" },
            ],
            brandings: [{ project_id: "proj-2", logo_url: "p2-brand.png" }],
        });

        const data = await renderRecent();
        const byId = new Map(data.map((d) => [d.id, d]));

        expect(byId.get("done")).toMatchObject({
            status: "Completed",
            helper: null,
            project_name: "Project One",
            project_logo_url: "p1.png",
            message_count: 0,
        });
        expect(byId.get("claimed")).toMatchObject({
            status: "Claimed",
            helper: { id: HELPER, name: "Helpful Helper", avatar_url: "h.png" },
            project_name: "Project Two",
            project_logo_url: "p2-brand.png",
            message_count: 2,
        });
        expect(byId.get("open")).toMatchObject({ status: "Unclaimed", helper: null });
    });

    it("does not run when userId is undefined", () => {
        setupSupabase({});
        const { result } = renderHook(() => useUserRecentTicketInteractions(undefined), {
            wrapper: makeWrapper(),
        });
        expect(result.current.fetchStatus).toBe("idle");
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
