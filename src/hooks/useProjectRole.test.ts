import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        auth: { getUser: vi.fn() },
        from: vi.fn(),
    },
}));

import { supabase } from "@/lib/supabase/client";
import { useUserRoles } from "./useProjectRole";

type Registrations = {
    admin?: boolean;
    helper?: boolean;
    member?: boolean;
    ticketCreator?: boolean;
};

/**
 * Builds a chainable supabase query mock. The builder records which filters
 * were applied and resolves (when awaited) with rows according to the
 * configured registrations:
 *  - projects_members + eq("role","admin")  -> admin row
 *  - projects_members + neq("role","admin") -> non-admin member row
 *  - projects_helpers                        -> helper row
 *  - tickets                                 -> ticket row
 */
function setupSupabase(regs: Registrations) {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
    } as never);

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        const filters: { op: string; col: string; val: unknown }[] = [];

        const resolveRows = (): unknown[] => {
            if (table === "projects_members") {
                const isAdminQuery = filters.some(
                    (f) => f.op === "eq" && f.col === "role" && f.val === "admin",
                );
                const isNonAdminQuery = filters.some(
                    (f) => f.op === "neq" && f.col === "role" && f.val === "admin",
                );
                if (isAdminQuery) return regs.admin ? [{ role: "admin" }] : [];
                if (isNonAdminQuery) return regs.member ? [{ role: "member" }] : [];
                return [];
            }
            if (table === "projects_helpers") {
                return regs.helper ? [{ helper_id: "helper-1" }] : [];
            }
            if (table === "tickets") {
                return regs.ticketCreator ? [{ id: "ticket-1" }] : [];
            }
            return [];
        };

        const builder: Record<string, unknown> = {};
        const chain = (op: string) => (col: string, val?: unknown) => {
            filters.push({ op, col, val });
            return builder;
        };
        builder.select = () => builder;
        builder.eq = chain("eq");
        builder.neq = chain("neq");
        builder.is = chain("is");
        builder.limit = () => builder;
        builder.then = (
            onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
            onRejected?: (e: unknown) => unknown,
        ) =>
            Promise.resolve({ data: resolveRows(), error: null }).then(
                onFulfilled,
                onRejected,
            );
        return builder;
    }) as never);
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    return Wrapper;
}

async function renderRoles() {
    const { result } = renderHook(() => useUserRoles(), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data;
}

describe("useUserRoles", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns ['helper'] for a helper-only registration", async () => {
        setupSupabase({ helper: true });
        expect(await renderRoles()).toEqual(["helper"]);
    });

    it("returns ['admin'] for an admin-only registration", async () => {
        setupSupabase({ admin: true });
        expect(await renderRoles()).toEqual(["admin"]);
    });

    it("returns ['admin','helper','user'] for admin + helper + ticket creator", async () => {
        setupSupabase({ admin: true, helper: true, ticketCreator: true });
        expect(await renderRoles()).toEqual(["admin", "helper", "user"]);
    });

    it("falls back to ['user'] when there are no registrations", async () => {
        setupSupabase({});
        expect(await renderRoles()).toEqual(["user"]);
    });

    it("returns [] when not signed in", async () => {
        setupSupabase({});
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as never);
        expect(await renderRoles()).toEqual([]);
    });
});
