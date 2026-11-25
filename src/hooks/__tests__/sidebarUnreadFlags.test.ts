import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/**
 * Chainable stand-in for the supabase query builder: every filter returns the
 * builder, and awaiting it (or `.maybeSingle()`) resolves to the rows queued
 * for that table.
 */
const tableRows: Record<string, unknown> = {};
const fromCalls: { table: string; select: string }[] = [];

function builder(table: string) {
    const result = () => {
        const rows = tableRows[table] ?? [];
        return { data: rows, error: null };
    };
    const b: Record<string, unknown> = {};
    for (const m of ["eq", "in", "is", "not", "order", "or", "neq", "filter"]) {
        b[m] = vi.fn(() => b);
    }
    b.select = vi.fn((cols: string) => {
        fromCalls.push({ table, select: cols });
        return b;
    });
    b.maybeSingle = vi.fn(async () => {
        const rows = tableRows[table];
        return { data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null };
    });
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject);
    return b;
}

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn((table: string) => builder(table)),
        rpc: vi.fn(),
    },
}));

import { supabase } from "@/lib/supabase/client";
import { useAdminActiveTicketsSidebar, useHelperClaimedTicketsSidebar } from "../useHelperTickets";
import { useUserActiveTicketsSidebar } from "../useTicketsWithDetails";

const rpc = vi.mocked(supabase.rpc);

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client }, children);
    }
    return Wrapper;
}

const ticket = (id: string, status = "in-progress") => ({
    id,
    title: `Ticket ${id}`,
    description: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
    created_by: "customer-1",
    project_id: "p1",
    status,
});

/** t1 is the open ticket; t1 and t2 are unread per the server, t3 is read. */
function seed() {
    tableRows.tickets_participants = [
        { ticket_id: "t1" },
        { ticket_id: "t2" },
        { ticket_id: "t3" },
    ];
    tableRows.tickets = [ticket("t1"), ticket("t2"), ticket("t3")];
    tableRows.projects = [{ project_id: "p1", name: "Acme" }];
    tableRows.projects_branding = [];
    tableRows.users_public = [{ id: "customer-1", name: "Cara", avatar_url: null }];
    // The last message on t3 is not the read one: the old client-side rule
    // would have shown a dot here.
    tableRows.tickets_messages = [
        { id: "m1", ticket_id: "t3", content: "Hello", created_at: "2026-11-20T10:00:00Z", is_automatic: false },
    ];
    rpc.mockImplementation((async (name: string) => {
        if (name !== "ticket_unread_flags") return { data: null, error: null };
        return {
            data: [
                { ticket_id: "t1", has_unread: true },
                { ticket_id: "t2", has_unread: true },
                { ticket_id: "t3", has_unread: false },
            ],
            error: null,
        };
    }) as never);
}

const dots = (items: { id: string; hasNotification: boolean }[] | undefined) =>
    Object.fromEntries((items ?? []).map((i) => [i.id, i.hasNotification]));

beforeEach(() => {
    for (const k of Object.keys(tableRows)) delete tableRows[k];
    fromCalls.length = 0;
    rpc.mockReset();
    seed();
});

const cases = [
    ["useHelperClaimedTicketsSidebar", () => useHelperClaimedTicketsSidebar("helper-1", "t1", 50)],
    ["useAdminActiveTicketsSidebar", () => useAdminActiveTicketsSidebar("p1", "admin-1", "t1", 50)],
    ["useUserActiveTicketsSidebar", () => useUserActiveTicketsSidebar("customer-1", "t1", 50)],
] as const;

describe.each(cases)("%s unread dots", (_name, useHook) => {
    it("sets hasNotification from ticket_unread_flags, never on the open ticket", async () => {
        const { result } = renderHook(useHook, { wrapper: wrapper() });

        await waitFor(() => expect(dots(result.current.data?.items)).toEqual({ t1: false, t2: true, t3: false }));
        expect(rpc).toHaveBeenCalledWith("ticket_unread_flags", { p_ticket_ids: ["t1", "t2", "t3"] });
    });

    it("no longer reads last_read_message_id", async () => {
        const { result } = renderHook(useHook, { wrapper: wrapper() });

        await waitFor(() => expect(result.current.data?.items).toHaveLength(3));
        expect(fromCalls.some((c) => c.select.includes("last_read_message_id"))).toBe(false);
    });

    it("treats tickets missing from the flags as read", async () => {
        rpc.mockResolvedValue({ data: [], error: null } as never);
        const { result } = renderHook(useHook, { wrapper: wrapper() });

        await waitFor(() => expect(rpc).toHaveBeenCalled());
        await waitFor(() => expect(dots(result.current.data?.items)).toEqual({ t1: false, t2: false, t3: false }));
    });
});
