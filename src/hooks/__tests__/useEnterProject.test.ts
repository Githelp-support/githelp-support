import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { switchRole, setSelectedProjectId, rolesQueryFn } = vi.hoisted(() => ({
    switchRole: vi.fn(),
    setSelectedProjectId: vi.fn(),
    rolesQueryFn: vi.fn(),
}));
vi.mock("@/contexts/user-context", () => ({
    useUser: () => ({ user: { role: "helper" }, switchRole }),
}));
vi.mock("@/contexts/project-context", () => ({
    useProjectSelection: () => ({ setSelectedProjectId }),
}));
vi.mock("@/hooks/useProjectRole", () => ({
    projectAvailableRolesQueryOptions: (projectId: string) => ({
        queryKey: ["project-available-roles", projectId],
        queryFn: rolesQueryFn,
        staleTime: 1800000,
    }),
}));

import { useEnterProject } from "../useEnterProject";

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

describe("useEnterProject", () => {
    beforeEach(() => {
        switchRole.mockReset();
        setSelectedProjectId.mockReset();
        rolesQueryFn.mockReset();
    });

    it("selects the project and switches to the highest role held there", async () => {
        rolesQueryFn.mockResolvedValueOnce(["admin", "helper", "user"]);
        const queryClient = makeQueryClient();
        const { result } = renderHook(() => useEnterProject(), { wrapper: makeWrapper(queryClient) });

        const role = await result.current("project-1", "admin");

        expect(role).toBe("admin");
        expect(setSelectedProjectId).toHaveBeenCalledWith("project-1");
        expect(switchRole).toHaveBeenCalledWith("admin");
    });

    it("refreshes the project list before selecting the project", async () => {
        rolesQueryFn.mockResolvedValueOnce(["helper", "user"]);
        const queryClient = makeQueryClient();
        const order: string[] = [];
        vi.spyOn(queryClient, "refetchQueries").mockImplementation(async () => {
            order.push("refetch");
        });
        setSelectedProjectId.mockImplementation(() => order.push("select"));
        const { result } = renderHook(() => useEnterProject(), { wrapper: makeWrapper(queryClient) });

        const role = await result.current("project-1");

        expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ["user-projects"] });
        expect(order).toEqual(["refetch", "select"]);
        expect(role).toBe("helper");
    });

    it("ignores a cached roles result, since membership just changed", async () => {
        const queryClient = makeQueryClient();
        queryClient.setQueryData(["project-available-roles", "project-1"], ["user"]);
        rolesQueryFn.mockResolvedValueOnce(["admin", "user"]);
        const { result } = renderHook(() => useEnterProject(), { wrapper: makeWrapper(queryClient) });

        const role = await result.current("project-1");

        expect(role).toBe("admin");
        expect(switchRole).toHaveBeenCalledWith("admin");
    });

    it("falls back to the given role when the roles lookup fails", async () => {
        rolesQueryFn.mockRejectedValueOnce(new Error("network"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const queryClient = makeQueryClient();
        const { result } = renderHook(() => useEnterProject(), { wrapper: makeWrapper(queryClient) });

        const role = await result.current("project-1", "admin");

        expect(role).toBe("admin");
        expect(setSelectedProjectId).toHaveBeenCalledWith("project-1");
        expect(switchRole).toHaveBeenCalledWith("admin");
    });

    it("persists the role even when it matches the active one", async () => {
        rolesQueryFn.mockResolvedValueOnce(["helper", "user"]);
        const queryClient = makeQueryClient();
        const { result } = renderHook(() => useEnterProject(), { wrapper: makeWrapper(queryClient) });

        await result.current("project-1");

        expect(switchRole).toHaveBeenCalledWith("helper");
    });
});
