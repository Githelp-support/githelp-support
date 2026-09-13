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
import { useStartPaymentConnect, useSyncPaymentConnect } from "../usePaymentConnect";

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

import { useStartHelperPaymentConnect } from "../usePaymentConnect";

describe("useStartHelperPaymentConnect", () => {
    beforeEach(() => vi.clearAllMocks());

    it("invokes payments-create-account then payments-link-account with scope=user", async () => {
        vi.mocked(supabase.functions.invoke)
            .mockResolvedValueOnce({
                data: { scope: "user", stripe_account_id: "acct_helper_1" },
                error: null,
            } as never)
            .mockResolvedValueOnce({
                data: { scope: "user", url: "https://connect.stripe.com/onboarding/helper" },
                error: null,
            } as never);

        const { result } = renderHook(() => useStartHelperPaymentConnect(), {
            wrapper: makeWrapper(),
        });

        const out = await result.current.mutateAsync();

        expect(out).toEqual({ url: "https://connect.stripe.com/onboarding/helper" });
        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            1,
            "payments-create-account",
            { body: { scope: "user" } },
        );
        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            2,
            "payments-link-account",
            { body: { scope: "user" } },
        );
    });

    it("forwards project_id so a sandbox project onboards in test mode", async () => {
        vi.mocked(supabase.functions.invoke)
            .mockResolvedValueOnce({
                data: { scope: "user", stripe_account_id: "acct_helper_sb" },
                error: null,
            } as never)
            .mockResolvedValueOnce({
                data: { scope: "user", url: "https://connect.stripe.com/onboarding/helper-sb" },
                error: null,
            } as never);

        const { result } = renderHook(() => useStartHelperPaymentConnect(), {
            wrapper: makeWrapper(),
        });

        await result.current.mutateAsync({ projectId: "proj-sb" });

        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            1,
            "payments-create-account",
            { body: { scope: "user", project_id: "proj-sb" } },
        );
        expect(supabase.functions.invoke).toHaveBeenNthCalledWith(
            2,
            "payments-link-account",
            { body: { scope: "user", project_id: "proj-sb" } },
        );
    });

    it("rejects if payments-create-account returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "nope" },
        } as never);
        const { result } = renderHook(() => useStartHelperPaymentConnect(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(result.current.mutateAsync()).rejects.toThrow("nope");
        });
    });
});

describe("useSyncPaymentConnect", () => {
    beforeEach(() => vi.clearAllMocks());

    it("invokes payments-sync-account with scope/project and invalidates payment-status queries", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                scope: "user",
                mode: "test",
                stripe_account_id: "acct_u",
                stripe_details_submitted: true,
                stripe_charges_enabled: true,
                stripe_payouts_enabled: true,
            },
            error: null,
        } as never);

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(QueryClientProvider, { client: queryClient }, children);

        const { result } = renderHook(() => useSyncPaymentConnect(), { wrapper });
        const out = await result.current.mutateAsync({ scope: "user", projectId: "proj-1" });

        expect(out.stripe_details_submitted).toBe(true);
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-sync-account",
            { body: { scope: "user", project_id: "proj-1" } },
        );
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ["payment-status"] }),
        );
    });

    it("passes organization_id for organization scope", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { scope: "organization", mode: "live" },
            error: null,
        } as never);
        const { result } = renderHook(() => useSyncPaymentConnect(), { wrapper: makeWrapper() });
        await result.current.mutateAsync({ scope: "organization", organizationId: "org-1" });
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-sync-account",
            { body: { scope: "organization", organization_id: "org-1" } },
        );
    });

    it("rejects when the function returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "boom" },
        } as never);
        const { result } = renderHook(() => useSyncPaymentConnect(), { wrapper: makeWrapper() });
        await expect(result.current.mutateAsync({ scope: "user" })).rejects.toThrow("boom");
    });
});
