import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        functions: { invoke: vi.fn() },
    },
}));

import { supabase } from "@/lib/supabase/client";
import { useRetryTicketPayment } from "../useRetryTicketPayment";

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    return Wrapper;
}

describe("useRetryTicketPayment", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the setup checkout url and passes the ticket id + origin", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: {
                checkout_url: "https://checkout.stripe.com/c/setup/x",
                payer_type: "user",
                failure_reason: "Your card was declined.",
            },
            error: null,
        } as never);
        const { result } = renderHook(() => useRetryTicketPayment(), { wrapper: makeWrapper() });
        const out = await result.current.mutateAsync({ ticketId: "ticket-1" });
        expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/setup/x");
        expect(out.payerType).toBe("user");
        expect(out.failureReason).toBe("Your card was declined.");
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "payments-retry-ticket-payment",
            { body: expect.objectContaining({ ticket_id: "ticket-1", return_origin: expect.any(String) }) },
        );
    });

    it("rejects with the backend's message when the function returns an error body", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: { error: "This ticket has no failed payment to retry" },
            error: null,
        } as never);
        const { result } = renderHook(() => useRetryTicketPayment(), { wrapper: makeWrapper() });
        await expect(result.current.mutateAsync({ ticketId: "ticket-1" })).rejects.toThrow(
            "This ticket has no failed payment to retry",
        );
    });

    it("rejects when the invoke itself fails", async () => {
        vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: { message: "Only the payer can update the payment method for this ticket" },
        } as never);
        const { result } = renderHook(() => useRetryTicketPayment(), { wrapper: makeWrapper() });
        await expect(result.current.mutateAsync({ ticketId: "ticket-1" })).rejects.toThrow(
            "Only the payer can update the payment method for this ticket",
        );
    });
});
