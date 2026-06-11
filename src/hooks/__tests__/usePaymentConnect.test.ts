import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        functions: { invoke: vi.fn() },
    },
}));

import { supabase } from "@/lib/supabase/client";
import { useStartPaymentConnect } from "../usePaymentConnect";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useStartPaymentConnect", () => {
    beforeEach(() => vi.clearAllMocks());

    it("invokes payments-create-account then payments-link-account and returns the URL", async () => {
        vi.mocked(supabase.functions.invoke)
            .mockResolvedValueOnce({
                data: { scope: "organization", stripe_account_id: "acct_1" },
                error: null,
            } as never)
            .mockResolvedValueOnce({
                data: { scope: "organization", url: "https://connect.stripe.com/onboarding/x" },
                error: null,
            } as never);

        const { result } = renderHook(() => useStartPaymentConnect(), {
            wrapper: makeWrapper(),
        });

        const out = await result.current.mutateAsync({ organizationId: "org-1", projectId: "proj-1" });

        expect(out).toEqual({ url: "https://connect.stripe.com/onboarding/x" });
        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            1,
            "payments-create-account",
            { body: { scope: "organization", organization_id: "org-1", project_id: "proj-1" } },
        );
        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            2,
            "payments-link-account",
            { body: { scope: "organization", organization_id: "org-1", project_id: "proj-1" } },
        );
    });

    it("rejects if payments-create-account returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "nope" },
        } as never);
        const { result } = renderHook(() => useStartPaymentConnect(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({ organizationId: "org-1", projectId: "proj-1" }),
            ).rejects.toThrow("nope");
        });
    });
});
