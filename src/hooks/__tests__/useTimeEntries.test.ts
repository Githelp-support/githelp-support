import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const { singleMock } = vi.hoisted(() => ({ singleMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: vi.fn(() => ({
                select: vi.fn(() => ({ single: singleMock })),
            })),
        })),
    },
}));

import { isPaymentNotAuthorizedError, useCreateTimeEntry } from "../useTimeEntries";

const input = {
    ticketId: "ticket-1",
    helperId: "helper-1",
    type: "support" as never,
    timeMilliseconds: 60_000,
    note: null,
    date: "2026-09-18",
};

function setup() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    return { invalidate, wrapper: Wrapper };
}

beforeEach(() => singleMock.mockReset());

describe("isPaymentNotAuthorizedError", () => {
    it("recognises the database payment gate's hint", () => {
        expect(isPaymentNotAuthorizedError({ code: "P0001", hint: "payment_not_authorized" })).toBe(true);
    });

    it("ignores every other failure", () => {
        expect(isPaymentNotAuthorizedError({ code: "42501", hint: null })).toBe(false);
        expect(isPaymentNotAuthorizedError(new Error("network"))).toBe(false);
        expect(isPaymentNotAuthorizedError(null)).toBe(false);
    });
});

describe("useCreateTimeEntry", () => {
    it("refreshes the time entries on success", async () => {
        singleMock.mockResolvedValue({ data: { id: "te-1" }, error: null });
        const { invalidate, wrapper } = setup();
        const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
        result.current.mutate(input);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["time-entries"] });
    });

    it("refetches the stale payment gate inputs when the database gate rejects the insert", async () => {
        singleMock.mockResolvedValue({
            data: null,
            error: { code: "P0001", hint: "payment_not_authorized", message: "Time cannot be logged" },
        });
        const { invalidate, wrapper } = setup();
        const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
        result.current.mutate(input);
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-payment-settings"] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket-payment-status", "ticket-1"] });
    });

    it("leaves the payment caches alone for unrelated failures", async () => {
        singleMock.mockResolvedValue({ data: null, error: { code: "42501", message: "rls" } });
        const { invalidate, wrapper } = setup();
        const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
        result.current.mutate(input);
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(invalidate).not.toHaveBeenCalled();
    });
});
