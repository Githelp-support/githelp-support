import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useAccountRoles } from "../useAccountRoles";

// Mock Supabase client before any imports resolve it
vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(),
    },
}));

import { supabase } from "@/lib/supabase/client";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        );
    }
    return Wrapper;
}

/**
 * Builds a query chain that works both awaited directly (list queries, via
 * `then`) and terminated with `.maybeSingle()` (single-row queries).
 */
function mockChain({
    rows = null,
    single = null,
}: {
    rows?: unknown;
    single?: unknown;
}) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() =>
            Promise.resolve({ data: single, error: null }),
        ),
        then: undefined as unknown,
    };
    // Make the chain thenable so await works for list queries
    chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
    return chain;
}

function mockTables({
    memberRows = [],
    helperRow = null,
    ticketRow = null,
}: {
    memberRows?: unknown;
    helperRow?: unknown;
    ticketRow?: unknown;
}) {
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        if (table === "projects_members") {
            return mockChain({ rows: memberRows });
        }
        if (table === "projects_helpers") {
            return mockChain({ single: helperRow });
        }
        if (table === "tickets") {
            return mockChain({ single: ticketRow });
        }
        throw new Error(`Unexpected table: ${table}`);
    }) as unknown as typeof supabase.from);
}

function mockSignedInUser(id = "user-1") {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id } },
        error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);
}

describe("useAccountRoles", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns no roles when there is no signed-in user", async () => {
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);
        mockTables({});

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([]);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns all roles ordered admin > helper > user", async () => {
        mockSignedInUser();
        mockTables({
            memberRows: [{ role: "admin" }, { role: "member" }],
            helperRow: { helper_id: "h1" },
            ticketRow: null,
        });

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(["admin", "helper", "user"]);
    });

    it("returns only admin when the user is admin everywhere with no support usage", async () => {
        mockSignedInUser();
        mockTables({
            memberRows: [{ role: "admin" }],
            helperRow: null,
            ticketRow: null,
        });

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(["admin"]);
    });

    it("returns helper when the user has a non-deleted projects_helpers row", async () => {
        mockSignedInUser();
        mockTables({
            memberRows: [],
            helperRow: { helper_id: "h1" },
            ticketRow: null,
        });

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(["helper"]);
    });

    it("returns user when the account has support usage via a created ticket", async () => {
        mockSignedInUser();
        mockTables({
            memberRows: [],
            helperRow: null,
            ticketRow: { id: "t1" },
        });

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(["user"]);
    });

    it("returns user when the account has a non-admin membership", async () => {
        mockSignedInUser();
        mockTables({
            memberRows: [{ role: "member" }],
            helperRow: null,
            ticketRow: null,
        });

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(["user"]);
    });

    it("queries the expected tables for the signed-in user", async () => {
        mockSignedInUser("user-42");
        mockTables({});

        const { result } = renderHook(() => useAccountRoles(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(supabase.from).toHaveBeenCalledWith("projects_members");
        expect(supabase.from).toHaveBeenCalledWith("projects_helpers");
        expect(supabase.from).toHaveBeenCalledWith("tickets");
    });
});
