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
import { usePaymentStatus } from "../usePaymentStatus";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockSingleResolve(resolveWith: { data: unknown; error: unknown }) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(resolveWith),
    };
    return chain;
}

describe("usePaymentStatus", () => {
    beforeEach(() => vi.clearAllMocks());

    it("queries organizations_payments_config when scope is organization", async () => {
        const chain = mockSingleResolve({
            data: {
                stripe_account_id: "acct_org_1",
                stripe_details_submitted: true,
                stripe_charges_enabled: true,
                stripe_payouts_enabled: true,
            },
            error: null,
        });
        vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

        const { result } = renderHook(
            () => usePaymentStatus({ scope: "organization", scopeId: "org-1" }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(supabase.from).toHaveBeenCalledWith("organizations_payments_config");
        expect(result.current.data?.stripe_account_id).toBe("acct_org_1");
    });

    it("queries users_payments_config when scope is user", async () => {
        const chain = mockSingleResolve({
            data: {
                stripe_account_id: null,
                stripe_details_submitted: false,
                stripe_charges_enabled: false,
                stripe_payouts_enabled: false,
            },
            error: null,
        });
        vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

        const { result } = renderHook(
            () => usePaymentStatus({ scope: "user", scopeId: "user-1" }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(supabase.from).toHaveBeenCalledWith("users_payments_config");
        expect(result.current.data?.stripe_account_id).toBe(null);
    });

    it("is disabled when scopeId is empty", () => {
        const chain = mockSingleResolve({ data: null, error: null });
        vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);

        const { result } = renderHook(
            () => usePaymentStatus({ scope: "user", scopeId: "" }),
            { wrapper: makeWrapper() },
        );
        expect(result.current.fetchStatus).toBe("idle");
    });
});
