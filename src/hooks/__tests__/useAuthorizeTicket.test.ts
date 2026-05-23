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
import { useAuthorizeTicket } from "../useAuthorizeTicket";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useAuthorizeTicket", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the authorized response when the backend places a hold", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                payment_id: "pay-1",
                stripe_payment_intent_id: "pi_1",
                status: "authorized",
                hold_amount_smallest_unit: 5500,
                hold_expires_at: "2026-06-01T00:00:00Z",
            },
            error: null,
        } as never);
        const { result } = renderHook(() => useAuthorizeTicket(), {
            wrapper: makeWrapper(),
        });
        const out = await result.current.mutateAsync({
            ticketId: "ticket-1",
            payerType: "user",
        });
        expect(out.status).toBe("authorized");
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-authorize-ticket",
            { body: { ticket_id: "ticket-1", payer_type: "user" } },
        );
    });

    it("returns requires_checkout with a checkout URL", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                ticket_id: "ticket-2",
                status: "requires_checkout",
                checkout_url: "https://checkout.stripe.com/c/pay/xyz",
                hold_amount_smallest_unit: 5500,
            },
            error: null,
        } as never);
        const { result } = renderHook(() => useAuthorizeTicket(), {
            wrapper: makeWrapper(),
        });
        const out = await result.current.mutateAsync({
            ticketId: "ticket-2",
            payerType: "user",
        });
        expect(out.status).toBe("requires_checkout");
        if (out.status === "requires_checkout") {
            expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/xyz");
        }
    });

    it("returns sla_covered for SLA-tagged tickets", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                ticket_id: "ticket-3",
                status: "sla_covered",
                sla_id: "sla-1",
                hold_amount_smallest_unit: 0,
                message: "Ticket is covered by an SLA — no hold needed",
            },
            error: null,
        } as never);
        const { result } = renderHook(() => useAuthorizeTicket(), {
            wrapper: makeWrapper(),
        });
        const out = await result.current.mutateAsync({
            ticketId: "ticket-3",
            payerType: "user",
        });
        expect(out.status).toBe("sla_covered");
    });

    it("forwards organizationId when payerType is organization", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { status: "authorized" },
            error: null,
        } as never);
        const { result } = renderHook(() => useAuthorizeTicket(), {
            wrapper: makeWrapper(),
        });
        await result.current.mutateAsync({
            ticketId: "ticket-4",
            payerType: "organization",
            organizationId: "org-1",
        });
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-authorize-ticket",
            { body: { ticket_id: "ticket-4", payer_type: "organization", organization_id: "org-1" } },
        );
    });

    it("rejects when the function returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "monthly_cap_exceeded" },
        } as never);
        const { result } = renderHook(() => useAuthorizeTicket(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({ ticketId: "ticket-5", payerType: "user" }),
            ).rejects.toThrow("monthly_cap_exceeded");
        });
    });
});
