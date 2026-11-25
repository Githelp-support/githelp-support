import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import { useUserActiveTicketsSidebar } from "./useTicketsWithDetails";

const USER = "user-1";

type Filter = { op: string; col: string; val: unknown; extra?: unknown };
type QueryLog = { table: string; filters: Filter[] };

function ticket(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Ticket ${id}`,
        description: null,
        project_id: "proj-1",
        status: "available",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        created_by: USER,
        deleted_at: null,
        ...overrides,
    };
}

/**
 * Chainable supabase mock. Applies the recorded eq / is / in / not filters to
 * the fixture rows and logs every query so tests can assert on the filters.
 */
function setupSupabase(fx: { tickets: Array<Record<string, unknown>> }) {
    const tables: Record<string, Array<Record<string, unknown>>> = {
        tickets: fx.tickets,
        projects: [{ project_id: "proj-1", name: "Project One" }],
        projects_branding: [],
        tickets_participants: [],
        tickets_messages: [],
    };
    const log: QueryLog[] = [];

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        const filters: Filter[] = [];
        log.push({ table, filters });
        const rows = tables[table] ?? [];

        const resolveRows = () =>
            rows.filter((row) =>
                filters.every((f) => {
                    const value = row[f.col];
                    if (f.op === "eq") return value === f.val;
                    if (f.op === "is") return value === f.val || (f.val === null && value === undefined);
                    if (f.op === "in") return (f.val as unknown[]).includes(value);
                    if (f.op === "not" && f.val === "in") {
                        const list = String(f.extra).replace(/^\(|\)$/g, "").split(",");
                        return !list.includes(String(value));
                    }
                    return true;
                })
            );

        const builder: Record<string, unknown> = {};
        const chain = (op: string) => (col: string, val?: unknown, extra?: unknown) => {
            filters.push({ op, col, val, extra });
            return builder;
        };
        builder.select = () => builder;
        builder.eq = chain("eq");
        builder.is = chain("is");
        builder.in = chain("in");
        builder.not = chain("not");
        builder.or = () => builder;
        builder.order = () => builder;
        builder.limit = () => builder;
        builder.maybeSingle = () => Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
        builder.then = (
            onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
            onRejected?: (e: unknown) => unknown
        ) => Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected);
        return builder;
    }) as never);

    return log;
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

async function renderSidebar(currentTicketId?: string, limit?: number) {
    const { result } = renderHook(() => useUserActiveTicketsSidebar(USER, currentTicketId, limit), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
}

describe("useUserActiveTicketsSidebar activeCount", () => {
    beforeEach(() => vi.clearAllMocks());

    it("queries only Unclaimed and In progress statuses as active", async () => {
        const log = setupSupabase({ tickets: [] });
        await renderSidebar();

        const activeQuery = log.find((q) => q.table === "tickets")!;
        expect(activeQuery.filters).toContainEqual(
            expect.objectContaining({
                op: "in",
                col: "status",
                val: ["available", "claimed", "in-progress"],
            })
        );
        expect(activeQuery.filters).toContainEqual(expect.objectContaining({ op: "eq", col: "created_by", val: USER }));
        expect(activeQuery.filters).toContainEqual(expect.objectContaining({ op: "is", col: "deleted_at", val: null }));
    });

    it("counts available, claimed and in-progress tickets as active", async () => {
        setupSupabase({
            tickets: [
                ticket("t-available", { status: "available" }),
                ticket("t-claimed", { status: "claimed" }),
                ticket("t-progress", { status: "in-progress" }),
                ticket("t-completed", { status: "completed" }),
                ticket("t-cancelled", { status: "cancelled" }),
            ],
        });

        const data = await renderSidebar(undefined, 10);
        expect(data.activeCount).toBe(3);
        expect(data.items.map((i) => i.id).sort()).toEqual(["t-available", "t-claimed", "t-progress"]);
    });

    it("activeCount equals the number of active rows, independent of the display limit", async () => {
        setupSupabase({
            tickets: Array.from({ length: 5 }, (_, i) => ticket(`t-${i}`, { status: "available" })),
        });

        const data = await renderSidebar(undefined, 3);
        expect(data.items).toHaveLength(3);
        expect(data.activeCount).toBe(5);
    });

    it("does not count a completed current ticket that is added to the list", async () => {
        setupSupabase({
            tickets: [
                ticket("t-active", { status: "in-progress" }),
                ticket("t-done", { status: "completed" }),
            ],
        });

        const data = await renderSidebar("t-done");
        expect(data.items.map((i) => i.id)).toContain("t-done");
        expect(data.activeCount).toBe(1);
    });
});
