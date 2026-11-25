import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import { useAdminActiveTicketsSidebar, useHelperClaimedTicketsSidebar } from "./useHelperTickets";

const HELPER = "helper-1";
const ADMIN = "admin-1";
const PROJECT = "proj-1";

type Filter = { op: string; col: string; val: unknown };
type QueryLog = { table: string; filters: Filter[] };

function ticket(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Ticket ${id}`,
        description: null,
        project_id: PROJECT,
        status: "claimed",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        created_by: "user-1",
        deleted_at: null,
        ...overrides,
    };
}

/**
 * Chainable supabase mock. Applies the recorded eq / is / in filters to the
 * fixture rows and logs every query so tests can assert on the filters.
 */
function setupSupabase(fx: {
    tickets: Array<Record<string, unknown>>;
    participants?: Array<Record<string, unknown>>;
}) {
    const tables: Record<string, Array<Record<string, unknown>>> = {
        tickets: fx.tickets,
        tickets_participants: fx.participants ?? [],
        projects: [{ project_id: PROJECT, name: "Project One" }],
        users_public: [],
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

async function renderHelper(currentTicketId?: string) {
    const { result } = renderHook(() => useHelperClaimedTicketsSidebar(HELPER, currentTicketId, 10), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
}

async function renderAdmin(currentTicketId?: string) {
    const { result } = renderHook(() => useAdminActiveTicketsSidebar(PROJECT, ADMIN, currentTicketId, 10), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
}

const STATUS_FILTER = { op: "in", col: "status", val: ["claimed", "in-progress"] };

/** Claimed by the helper in every status, so only the status filter decides. */
const ALL_STATUS_TICKETS = [
    ticket("t-claimed", { status: "claimed" }),
    ticket("t-progress", { status: "in-progress" }),
    ticket("t-available", { status: "available" }),
    ticket("t-completed", { status: "completed" }),
    ticket("t-cancelled", { status: "cancelled" }),
];
const HELPER_PARTICIPANTS = ALL_STATUS_TICKETS.map((t) => ({
    ticket_id: t.id,
    participant_id: HELPER,
    claimed: true,
    last_read_message_id: null,
}));

describe("useHelperClaimedTicketsSidebar activeCount", () => {
    beforeEach(() => vi.clearAllMocks());

    it("filters the active query to claimed and in-progress", async () => {
        const log = setupSupabase({ tickets: ALL_STATUS_TICKETS, participants: HELPER_PARTICIPANTS });
        await renderHelper();

        const activeQuery = log.find((q) => q.table === "tickets")!;
        expect(activeQuery.filters).toContainEqual(STATUS_FILTER);
    });

    it("counts only claimed and in-progress tickets", async () => {
        setupSupabase({ tickets: ALL_STATUS_TICKETS, participants: HELPER_PARTICIPANTS });
        const data = await renderHelper();

        expect(data.activeCount).toBe(2);
        expect(data.items.map((i) => i.id).sort()).toEqual(["t-claimed", "t-progress"]);
    });

    it.each(["available", "completed"])(
        "a current %s ticket is listed but does not raise activeCount",
        async (status) => {
            const id = `t-${status}`;
            setupSupabase({ tickets: ALL_STATUS_TICKETS, participants: HELPER_PARTICIPANTS });
            const data = await renderHelper(id);

            expect(data.items.map((i) => i.id)).toContain(id);
            expect(data.items.find((i) => i.id === id)?.current).toBe(true);
            expect(data.activeCount).toBe(2);
        }
    );
});

describe("useAdminActiveTicketsSidebar activeCount", () => {
    beforeEach(() => vi.clearAllMocks());

    it("filters the active query to claimed and in-progress in the project", async () => {
        const log = setupSupabase({ tickets: ALL_STATUS_TICKETS });
        await renderAdmin();

        const activeQuery = log.find((q) => q.table === "tickets")!;
        expect(activeQuery.filters).toContainEqual(STATUS_FILTER);
        expect(activeQuery.filters).toContainEqual({ op: "eq", col: "project_id", val: PROJECT });
    });

    it("counts only claimed and in-progress tickets", async () => {
        setupSupabase({ tickets: ALL_STATUS_TICKETS });
        const data = await renderAdmin();

        expect(data.activeCount).toBe(2);
        expect(data.items.map((i) => i.id).sort()).toEqual(["t-claimed", "t-progress"]);
    });

    it.each(["available", "completed"])(
        "a current %s ticket is listed but does not raise activeCount",
        async (status) => {
            const id = `t-${status}`;
            setupSupabase({ tickets: ALL_STATUS_TICKETS });
            const data = await renderAdmin(id);

            expect(data.items.map((i) => i.id)).toContain(id);
            expect(data.items.find((i) => i.id === id)?.current).toBe(true);
            expect(data.activeCount).toBe(2);
        }
    );
});
