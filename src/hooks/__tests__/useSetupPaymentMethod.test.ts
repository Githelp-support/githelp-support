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
import { useSetupPaymentMethod } from "../useSetupPaymentMethod";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useSetupPaymentMethod", () => {
    beforeEach(() => vi.clearAllMocks());

    it("invokes payments-setup-method with scope=user and returns the checkout URL", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                scope: "user",
                checkout_url: "https://checkout.stripe.com/c/pay/abc",
                stripe_customer_id: "cus_u1",
            },
            error: null,
        } as never);

        const { result } = renderHook(() => useSetupPaymentMethod(), {
            wrapper: makeWrapper(),
        });

        const out = await result.current.mutateAsync({ scope: "user" });

        expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/abc");
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-setup-method",
            { body: { scope: "user" } },
        );
    });

    it("invokes with scope=organization and forwards organizationId", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                scope: "organization",
                checkout_url: "https://checkout.stripe.com/c/pay/org",
                stripe_customer_id: "cus_org",
            },
            error: null,
        } as never);

        const { result } = renderHook(() => useSetupPaymentMethod(), {
            wrapper: makeWrapper(),
        });

        await result.current.mutateAsync({ scope: "organization", organizationId: "org-1" });

        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-setup-method",
            { body: { scope: "organization", organization_id: "org-1" } },
        );
    });

    it("rejects when payments-setup-method returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "boom" },
        } as never);
        const { result } = renderHook(() => useSetupPaymentMethod(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({ scope: "user" }),
            ).rejects.toThrow("boom");
        });
    });
});
