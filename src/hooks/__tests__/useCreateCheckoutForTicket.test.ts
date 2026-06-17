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
import { useCreateCheckoutForTicket } from "../useCreateCheckoutForTicket";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCreateCheckoutForTicket", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the checkout url on success", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { checkout_url: "https://checkout.stripe.com/c/pay/x", hold_amount_smallest_unit: 5500 },
            error: null,
        } as never);
        const { result } = renderHook(() => useCreateCheckoutForTicket(), {
            wrapper: makeWrapper(),
        });
        const out = await result.current.mutateAsync({ ticketId: "ticket-1" });
        expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/x");
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-create-checkout-for-ticket",
            { body: expect.objectContaining({ ticket_id: "ticket-1" }) },
        );
    });

    it("rejects when the function returns an error", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "Payment already exists for this ticket" },
        } as never);
        const { result } = renderHook(() => useCreateCheckoutForTicket(), {
            wrapper: makeWrapper(),
        });
        await waitFor(async () => {
            await expect(
                result.current.mutateAsync({ ticketId: "ticket-2" }),
            ).rejects.toThrow("Payment already exists");
        });
    });
});
