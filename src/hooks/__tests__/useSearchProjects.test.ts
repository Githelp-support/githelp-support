import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { supabase } from "@/lib/supabase/client";
import {
    useSearchProjects,
    escapeProjectSearchTerm,
    PROJECT_SEARCH_MIN_CHARS,
} from "../useProject";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    return Wrapper;
}

function mockChain(resolveWith: { data: unknown; error: unknown }) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(resolveWith),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);
    return chain;
}

describe("escapeProjectSearchTerm", () => {
    it("escapes LIKE wildcards and strips filter delimiters", () => {
        expect(escapeProjectSearchTerm("50%_off")).toBe("50\\%\\_off");
        expect(escapeProjectSearchTerm("a,b(c)")).toBe("a b c");
        expect(escapeProjectSearchTerm("  padded  ")).toBe("padded");
    });
});

describe("useSearchProjects", () => {
    beforeEach(() => vi.clearAllMocks());

    it("does not query when the term is shorter than the minimum", async () => {
        mockChain({ data: [], error: null });
        const { result } = renderHook(
            () => useSearchProjects("ab"),
            { wrapper: makeWrapper() },
        );
        expect(PROJECT_SEARCH_MIN_CHARS).toBe(3);
        expect(result.current.fetchStatus).toBe("idle");
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("ignores surrounding whitespace when checking the minimum length", () => {
        mockChain({ data: [], error: null });
        const { result } = renderHook(
            () => useSearchProjects("  ab  "),
            { wrapper: makeWrapper() },
        );
        expect(result.current.fetchStatus).toBe("idle");
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("searches name and slug case-insensitively once the minimum is met", async () => {
        const rows = [
            { project_id: "p1", name: "Acme Support", slug: "acme", logo_url: null },
        ];
        const chain = mockChain({ data: rows, error: null });

        const { result } = renderHook(
            () => useSearchProjects("acm"),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(supabase.from).toHaveBeenCalledWith("projects");
        expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
        expect(chain.eq).toHaveBeenCalledWith("sandbox", false);
        expect(chain.or).toHaveBeenCalledWith("name.ilike.%acm%,slug.ilike.%acm%");
        expect(chain.limit).toHaveBeenCalledWith(10);
        expect(result.current.data).toEqual(rows);
    });

    it("surfaces query errors", async () => {
        mockChain({ data: null, error: new Error("boom") });
        const { result } = renderHook(
            () => useSearchProjects("acme"),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});
