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
import { useOrgSpendingCaps, useUpdateOrgSpendingCaps } from "../useOrgSpendingCaps";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useOrgSpendingCaps", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the org's cap fields", async () => {
        const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    monthly_spend_cap_smallest_unit: 100000,
                    default_user_monthly_cap_smallest_unit: 20000,
                },
                error: null,
            }),
        };
        vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

        const { result } = renderHook(() => useOrgSpendingCaps("org-1"), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(supabase.from).toHaveBeenCalledWith("organizations_payments_config");
        expect(result.current.data?.monthly_spend_cap_smallest_unit).toBe(100000);
        expect(result.current.data?.default_user_monthly_cap_smallest_unit).toBe(20000);
    });

    it("is disabled when orgId is empty", () => {
        const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

        const { result } = renderHook(() => useOrgSpendingCaps(""), {
            wrapper: makeWrapper(),
        });
        expect(result.current.fetchStatus).toBe("idle");
    });
});

describe("useUpdateOrgSpendingCaps", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends an update to organizations_payments_config with both cap fields", async () => {
        const eq = vi.fn().mockResolvedValue({ data: null, error: null });
        const update = vi.fn().mockReturnValue({ eq });
        vi.mocked(supabase.from).mockReturnValue(
            { update } as unknown as ReturnType<typeof supabase.from>,
        );

        const { result } = renderHook(() => useUpdateOrgSpendingCaps(), {
            wrapper: makeWrapper(),
        });

        await result.current.mutateAsync({
            organizationId: "org-1",
            monthlySpendCapSmallestUnit: 100000,
            defaultUserMonthlyCapSmallestUnit: null,
        });

        expect(supabase.from).toHaveBeenCalledWith("organizations_payments_config");
        expect(update).toHaveBeenCalledWith({
            monthly_spend_cap_smallest_unit: 100000,
            default_user_monthly_cap_smallest_unit: null,
        });
        expect(eq).toHaveBeenCalledWith("id", "org-1");
    });

    it("rejects when the update returns an error", async () => {
        const eq = vi.fn().mockResolvedValue({ data: null, error: { message: "no perms" } });
        const update = vi.fn().mockReturnValue({ eq });
        vi.mocked(supabase.from).mockReturnValue(
            { update } as unknown as ReturnType<typeof supabase.from>,
        );

        const { result } = renderHook(() => useUpdateOrgSpendingCaps(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({
                    organizationId: "org-1",
                    monthlySpendCapSmallestUnit: 100,
                    defaultUserMonthlyCapSmallestUnit: 50,
                }),
            ).rejects.toThrow("no perms");
        });
    });
});
