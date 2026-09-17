import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
    supabase: { rpc },
}));

import { useRemoveHelper } from "../useHelpers";

function makeWrapper(queryClient: QueryClient) {
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    return Wrapper;
}

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
}

describe("useRemoveHelper", () => {
    beforeEach(() => rpc.mockReset());

    it("archives the helper through the remove_project_helper RPC", async () => {
        const removed = { helper_id: "helper-1", project_id: "project-1", deleted_at: "2026-09-17T00:00:00Z" };
        rpc.mockResolvedValueOnce({ data: removed, error: null });
        const queryClient = makeQueryClient();
        const { result } = renderHook(() => useRemoveHelper(), { wrapper: makeWrapper(queryClient) });

        const data = await result.current.mutateAsync({ helperId: "helper-1" });

        expect(rpc).toHaveBeenCalledWith("remove_project_helper", { p_helper_id: "helper-1" });
        expect(data).toEqual(removed);
    });

    it("invalidates the helper list and role queries for the project", async () => {
        rpc.mockResolvedValueOnce({
            data: { helper_id: "helper-1", project_id: "project-1", deleted_at: "2026-09-17T00:00:00Z" },
            error: null,
        });
        const queryClient = makeQueryClient();
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        const { result } = renderHook(() => useRemoveHelper(), { wrapper: makeWrapper(queryClient) });

        await result.current.mutateAsync({ helperId: "helper-1" });

        const keys = invalidate.mock.calls.map(([opts]) => opts?.queryKey);
        expect(keys).toEqual(
            expect.arrayContaining([
                ["helpers", "project-1"],
                ["helper", "helper-1"],
                ["current-helper", "project-1"],
                ["project-available-roles", "project-1"],
                ["project-role", "project-1"],
            ]),
        );
    });

    it("rejects when the RPC returns an error (e.g. caller is not an admin)", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: "Only project admins can remove helpers" } });
        const queryClient = makeQueryClient();
        const { result } = renderHook(() => useRemoveHelper(), { wrapper: makeWrapper(queryClient) });

        await expect(result.current.mutateAsync({ helperId: "helper-1" })).rejects.toMatchObject({
            message: "Only project admins can remove helpers",
        });
    });
});
