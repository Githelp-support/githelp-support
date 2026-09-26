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
import { useSyncPaymentMethod } from "../useSetupPaymentMethod";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
    return { wrapper, queryClient };
}

describe("useSyncPaymentMethod", () => {
    beforeEach(() => vi.clearAllMocks());

    it("invokes payments-sync-setup-method with the session id and maps a synced card", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                scope: "user",
                mode: "test",
                synced: true,
                default_payment_method_id: "pm_new",
                card_brand: "visa",
                card_last4: "4242",
            },
            error: null,
        } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => useSyncPaymentMethod(), { wrapper });

        const out = await result.current.mutateAsync({
            scope: "user",
            projectId: "proj-1",
            sessionId: "cs_123",
        });

        expect(out).toEqual({
            synced: true,
            defaultPaymentMethodId: "pm_new",
            cardBrand: "visa",
            cardLast4: "4242",
        });
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-sync-setup-method",
            { body: { scope: "user", session_id: "cs_123", project_id: "proj-1" } },
        );
    });

    it("refetches payment-status queries once the card is synced", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { synced: true, default_payment_method_id: "pm_new", card_brand: null, card_last4: null },
            error: null,
        } as never);
        const { wrapper, queryClient } = makeWrapper();
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        const { result } = renderHook(() => useSyncPaymentMethod(), { wrapper });

        await result.current.mutateAsync({ scope: "user", sessionId: "cs_123" });

        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["payment-status"] });
    });

    it("returns synced=false without refetching when the SetupIntent has not succeeded", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { synced: false, setup_intent_status: "requires_action" },
            error: null,
        } as never);
        const { wrapper, queryClient } = makeWrapper();
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        const { result } = renderHook(() => useSyncPaymentMethod(), { wrapper });

        const out = await result.current.mutateAsync({ scope: "user", sessionId: "cs_123" });

        expect(out).toEqual({ synced: false, setupIntentStatus: "requires_action" });
        expect(invalidate).not.toHaveBeenCalled();
    });

    it("forwards organizationId for scope=organization", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { synced: true, default_payment_method_id: "pm_org", card_brand: null, card_last4: null },
            error: null,
        } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => useSyncPaymentMethod(), { wrapper });

        await result.current.mutateAsync({
            scope: "organization",
            organizationId: "org-1",
            sessionId: "cs_org",
        });

        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-sync-setup-method",
            { body: { scope: "organization", session_id: "cs_org", organization_id: "org-1" } },
        );
    });

    it("rejects when the function returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "Checkout session does not belong to this customer" },
        } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => useSyncPaymentMethod(), { wrapper });

        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({ scope: "user", sessionId: "cs_123" }),
            ).rejects.toThrow("Checkout session does not belong to this customer");
        });
    });
});
