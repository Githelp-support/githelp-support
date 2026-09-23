import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
    supabase: { rpc },
}));

import { useProjectAverageResponseTime } from "../useProjectResponseTime";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
    return Wrapper;
}

describe("useProjectAverageResponseTime", () => {
    beforeEach(() => rpc.mockReset());

    it("calls the RPC with the project id and returns the seconds", async () => {
        rpc.mockResolvedValue({ data: 5400, error: null });

        const { result } = renderHook(
            () => useProjectAverageResponseTime("project-1"),
            { wrapper: makeWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(rpc).toHaveBeenCalledWith("get_project_avg_response_time", {
            p_project_id: "project-1",
        });
        expect(result.current.data).toBe(5400);
    });

    it("returns null when the project has no responded-to tickets", async () => {
        rpc.mockResolvedValue({ data: null, error: null });

        const { result } = renderHook(
            () => useProjectAverageResponseTime("project-1"),
            { wrapper: makeWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toBeNull();
    });

    it("does not query without a project id", () => {
        const { result } = renderHook(
            () => useProjectAverageResponseTime(""),
            { wrapper: makeWrapper() },
        );

        expect(rpc).not.toHaveBeenCalled();
        expect(result.current.fetchStatus).toBe("idle");
    });

    it("surfaces RPC errors", async () => {
        rpc.mockResolvedValue({ data: null, error: new Error("boom") });

        const { result } = renderHook(
            () => useProjectAverageResponseTime("project-1"),
            { wrapper: makeWrapper() },
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});
