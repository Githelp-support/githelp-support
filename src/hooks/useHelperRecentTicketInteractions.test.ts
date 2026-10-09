import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase/client";
import { useHelperRecentTicketInteractions } from "./useHelperRecentTicketInteractions";

/** The helper's AUTH user id (what the hook receives). */
const HELPER_USER = "helper-user-1";
/** The helper's projects_helpers.helper_id (what time entries reference). */
const HELPER_ID = "ph-1";
const CUSTOMER = "customer-1";
const OTHER_HELPER = "helper-user-2";

type Filter = { op: string; col: string; val: unknown };

type Fixture = {
    tickets?: Array<Record<string, unknown>>;
    messages?: Array<Record<string, unknown>>;
    participants?: Array<Record<string, unknown>>;
    timeEntries?: Array<Record<string, unknown>>;
    helpers?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    brandings?: Array<Record<string, unknown>>;
    users?: Array<Record<string, unknown>>;
};

function ticket(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Ticket ${id}`,
        project_id: "proj-1",
        status: "available",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: CUSTOMER,
        completed_at: null,
        cancelled_at: null,
        end_requested_at: null,
        end_requested_by: null,
        time_review_requested_at: null,
        time_review_requested_by: null,
        deleted_at: null,
        ...overrides,
    };
}

function participant(ticket_id: string, overrides: Record<string, unknown> = {}) {
    return {
        ticket_id,
        participant_id: HELPER_USER,
        created_at: "2026-01-01T00:00:00.000Z",
        claimed: true,
        last_read_message_id: null,
        ...overrides,
    };
}

function message(id: string, ticket_id: string, created_at: string, overrides: Record<string, unknown> = {}) {
    return { id, ticket_id, sender_id: CUSTOMER, created_at, deleted_at: null, ...overrides };
}

/**
 * Chainable supabase mock. Resolves rows for each table by applying the
 * recorded eq / is / in filters (and order) to the fixture, so the hook's
 * queries behave like a tiny in-memory database.
 */
function setupSupabase(fx: Fixture) {
    const tables: Record<string, Array<Record<string, unknown>>> = {
        tickets: fx.tickets ?? [],
        tickets_messages: fx.messages ?? [],
        tickets_participants: fx.participants ?? [],
        tickets_time_entries: fx.timeEntries ?? [],
        projects_helpers: fx.helpers ?? [{ helper_id: HELPER_ID, user_id: HELPER_USER }],
        projects: fx.projects ?? [{ project_id: "proj-1", name: "Project One", logo_url: "p.png" }],
        projects_branding: fx.brandings ?? [],
        users_public: fx.users ?? [{ id: CUSTOMER, name: "Casey Customer", avatar_url: "c.png" }],
    };

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
        const filters: Filter[] = [];
        let order: { col: string; ascending: boolean } | null = null;
        const rows = tables[table] ?? [];

        const resolveRows = () => {
            const matched = rows.filter((row) =>
                filters.every((f) => {
                    if (f.col === "helper.user_id") {
                        // tickets_time_entries → projects_helpers!inner join on the auth user
                        const h = tables.projects_helpers.find((ph) => ph.helper_id === row.helper_id);
                        return !!h && h.user_id === f.val;
                    }
                    const value = row[f.col];
                    if (f.op === "eq") return value === f.val;
                    if (f.op === "is") return value === f.val || (f.val === null && value === undefined);
                    if (f.op === "in") return (f.val as unknown[]).includes(value);
                    return true;
                })
            );
            if (!order) return matched;
            const { col, ascending } = order;
            return [...matched].sort((a, b) => {
                const av = String(a[col] ?? "");
                const bv = String(b[col] ?? "");
                return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            });
        };

        const builder: Record<string, unknown> = {};
        const chain = (op: string) => (col: string, val?: unknown) => {
            filters.push({ op, col, val });
            return builder;
        };
        builder.select = () => builder;
        builder.eq = chain("eq");
        builder.is = chain("is");
        builder.in = chain("in");
        builder.order = (col: string, opts?: { ascending?: boolean }) => {
            order = { col, ascending: opts?.ascending !== false };
            return builder;
        };
        builder.limit = () => builder;
        builder.then = (
            onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
            onRejected?: (e: unknown) => unknown
        ) => Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected);
        return builder;
    }) as never);
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

async function renderRecent(userId: string | undefined = HELPER_USER, limit?: number) {
    const { result } = renderHook(() => useHelperRecentTicketInteractions(userId, limit), {
        wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
}

describe("useHelperRecentTicketInteractions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("orders tickets by the latest interaction across all sources", async () => {
        setupSupabase({
            tickets: [
                // helper only wrote a message
                ticket("t-msg"),
                // claimed early, completed later
                ticket("t-done", { status: "completed", completed_at: "2026-01-20T00:00:00.000Z" }),
                // helper only logged time
                ticket("t-time"),
                // claimed early, end requested later BY the helper
                ticket("t-end", {
                    end_requested_at: "2026-01-25T00:00:00.000Z",
                    end_requested_by: HELPER_USER,
                }),
                // claimed early, time summary sent later BY the helper
                ticket("t-review", {
                    time_review_requested_at: "2026-01-22T00:00:00.000Z",
                    time_review_requested_by: HELPER_USER,
                }),
                // end requested by someone else must NOT count
                ticket("t-end-other", {
                    end_requested_at: "2026-02-01T00:00:00.000Z",
                    end_requested_by: CUSTOMER,
                }),
                // cancelled later on a participant ticket
                ticket("t-cancel", { cancelled_at: "2026-01-18T00:00:00.000Z" }),
                // completed_at on a ticket the helper is NOT a participant of must NOT count
                ticket("t-msg-done", { status: "completed", completed_at: "2026-02-05T00:00:00.000Z" }),
            ],
            messages: [
                message("m1", "t-msg", "2026-01-10T00:00:00.000Z", { sender_id: HELPER_USER }),
                // deleted message must be ignored
                message("m2", "t-msg", "2026-03-01T00:00:00.000Z", {
                    sender_id: HELPER_USER,
                    deleted_at: "2026-03-02T00:00:00.000Z",
                }),
                // someone else's message does not count as the helper's interaction
                message("m3", "t-msg", "2026-03-05T00:00:00.000Z", { sender_id: CUSTOMER }),
                message("m4", "t-msg-done", "2026-01-11T00:00:00.000Z", { sender_id: HELPER_USER }),
            ],
            participants: [
                participant("t-done", { created_at: "2026-01-02T00:00:00.000Z" }),
                participant("t-end", { created_at: "2026-01-03T00:00:00.000Z" }),
                participant("t-review", { created_at: "2026-01-04T00:00:00.000Z" }),
                participant("t-end-other", { created_at: "2026-01-05T00:00:00.000Z" }),
                participant("t-cancel", { created_at: "2026-01-06T00:00:00.000Z" }),
                // another helper's participant row must not count for us
                participant("t-msg", { participant_id: OTHER_HELPER, created_at: "2026-04-01T00:00:00.000Z" }),
            ],
            timeEntries: [
                { ticket_id: "t-time", helper_id: HELPER_ID, created_at: "2026-01-15T00:00:00.000Z" },
                // another helper's time entry must not count for us
                { ticket_id: "t-time", helper_id: "ph-other", created_at: "2026-04-01T00:00:00.000Z" },
            ],
            helpers: [
                { helper_id: HELPER_ID, user_id: HELPER_USER },
                { helper_id: "ph-other", user_id: OTHER_HELPER },
            ],
        });

        const data = await renderRecent(HELPER_USER, 10);

        expect(data.map((d) => d.id)).toEqual([
            "t-end",
            "t-review",
            "t-done",
            "t-cancel",
            "t-time",
            "t-msg-done",
            "t-msg",
            "t-end-other",
        ]);
        const byId = new Map(data.map((d) => [d.id, d.last_interaction_at]));
        expect(byId.get("t-end")).toBe("2026-01-25T00:00:00.000Z");
        expect(byId.get("t-review")).toBe("2026-01-22T00:00:00.000Z");
        expect(byId.get("t-done")).toBe("2026-01-20T00:00:00.000Z");
        expect(byId.get("t-cancel")).toBe("2026-01-18T00:00:00.000Z");
        expect(byId.get("t-time")).toBe("2026-01-15T00:00:00.000Z");
        expect(byId.get("t-msg-done")).toBe("2026-01-11T00:00:00.000Z");
        expect(byId.get("t-msg")).toBe("2026-01-10T00:00:00.000Z");
        expect(byId.get("t-end-other")).toBe("2026-01-05T00:00:00.000Z");
    });

    it("limits the result to 5 tickets by default", async () => {
        setupSupabase({
            tickets: Array.from({ length: 8 }, (_, i) => ticket(`t-${i}`)),
            participants: Array.from({ length: 8 }, (_, i) =>
                participant(`t-${i}`, { created_at: `2026-01-0${i + 1}T00:00:00.000Z` })
            ),
        });

        const data = await renderRecent();
        expect(data).toHaveLength(5);
        expect(data.map((d) => d.id)).toEqual(["t-7", "t-6", "t-5", "t-4", "t-3"]);
    });

    it("respects a custom limit", async () => {
        setupSupabase({
            tickets: Array.from({ length: 4 }, (_, i) => ticket(`t-${i}`)),
            participants: Array.from({ length: 4 }, (_, i) =>
                participant(`t-${i}`, { created_at: `2026-01-0${i + 1}T00:00:00.000Z` })
            ),
        });

        const data = await renderRecent(HELPER_USER, 2);
        expect(data.map((d) => d.id)).toEqual(["t-3", "t-2"]);
    });

    it("flags has_unread when last_read_message_id differs from the last message id", async () => {
        setupSupabase({
            tickets: [ticket("t-1")],
            participants: [participant("t-1", { last_read_message_id: "m1" })],
            messages: [
                // fixture order is deliberately reversed; the hook orders by created_at asc
                message("m2", "t-1", "2026-01-02T00:00:00.000Z"),
                message("m1", "t-1", "2026-01-01T00:00:00.000Z"),
            ],
        });

        const [row] = await renderRecent();
        expect(row.has_unread).toBe(true);
    });

    it("flags has_unread when the helper has no participant row but the ticket has messages", async () => {
        setupSupabase({
            tickets: [ticket("t-1")],
            timeEntries: [{ ticket_id: "t-1", helper_id: HELPER_ID, created_at: "2026-01-05T00:00:00.000Z" }],
            messages: [message("m1", "t-1", "2026-01-01T00:00:00.000Z")],
        });

        const [row] = await renderRecent();
        expect(row.has_unread).toBe(true);
    });

    it("does not flag has_unread when last_read_message_id equals the last message id", async () => {
        setupSupabase({
            tickets: [ticket("t-1")],
            participants: [participant("t-1", { last_read_message_id: "m2" })],
            messages: [
                message("m1", "t-1", "2026-01-01T00:00:00.000Z"),
                message("m2", "t-1", "2026-01-02T00:00:00.000Z"),
                // a newer but deleted message does not reopen the unread state
                message("m3", "t-1", "2026-01-03T00:00:00.000Z", { deleted_at: "2026-01-04T00:00:00.000Z" }),
            ],
        });

        const [row] = await renderRecent();
        expect(row.has_unread).toBe(false);
    });

    it("does not flag has_unread when the ticket has no messages", async () => {
        setupSupabase({
            tickets: [ticket("t-1")],
            participants: [participant("t-1", { last_read_message_id: null })],
        });

        const [row] = await renderRecent();
        expect(row.has_unread).toBe(false);
        expect(row.message_count).toBe(0);
    });

    it("drops deleted tickets", async () => {
        setupSupabase({
            tickets: [
                ticket("t-live"),
                ticket("t-gone", { deleted_at: "2026-02-01T00:00:00.000Z" }),
            ],
            messages: [
                message("m1", "t-live", "2026-01-01T00:00:00.000Z", { sender_id: HELPER_USER }),
                message("m2", "t-gone", "2026-01-09T00:00:00.000Z", { sender_id: HELPER_USER }),
            ],
            participants: [participant("t-gone")],
        });

        const data = await renderRecent();
        expect(data.map((d) => d.id)).toEqual(["t-live"]);
    });

    it("derives status, creator, project details and message_count", async () => {
        setupSupabase({
            tickets: [
                ticket("done", { status: "completed" }),
                ticket("mine", { project_id: "proj-2" }),
                ticket("theirs"),
                ticket("open", { created_by: null }),
            ],
            participants: [
                participant("done", { created_at: "2026-01-04T00:00:00.000Z" }),
                participant("mine", { created_at: "2026-01-03T00:00:00.000Z", claimed: true }),
                // helper joined without claiming, but someone else claimed it
                participant("theirs", { created_at: "2026-01-02T00:00:00.000Z", claimed: false }),
                participant("theirs", { participant_id: OTHER_HELPER, claimed: true }),
                participant("open", { created_at: "2026-01-01T00:00:00.000Z", claimed: false }),
            ],
            messages: [
                message("m1", "mine", "2026-01-01T00:00:00.000Z"),
                message("m2", "mine", "2026-01-02T00:00:00.000Z"),
                message("m3", "mine", "2026-01-03T00:00:00.000Z", { deleted_at: "2026-01-04T00:00:00.000Z" }),
            ],
            projects: [
                { project_id: "proj-1", name: "Project One", logo_url: "p1.png" },
                { project_id: "proj-2", name: "Project Two", logo_url: "p2-fallback.png" },
            ],
            brandings: [{ project_id: "proj-2", logo_url: "p2-brand.png" }],
        });

        const data = await renderRecent();
        const byId = new Map(data.map((d) => [d.id, d]));

        expect(byId.get("done")).toMatchObject({
            status: "Completed",
            creator: { id: CUSTOMER, name: "Casey Customer", avatar_url: "c.png" },
            project_name: "Project One",
            project_logo_url: "p1.png",
            message_count: 0,
        });
        expect(byId.get("mine")).toMatchObject({
            status: "Claimed",
            project_name: "Project Two",
            project_logo_url: "p2-brand.png",
            message_count: 2,
        });
        expect(byId.get("theirs")).toMatchObject({ status: "Claimed" });
        expect(byId.get("open")).toMatchObject({ status: "Unclaimed", creator: null });
    });

    it("does not run when userId is undefined", () => {
        setupSupabase({});
        const { result } = renderHook(() => useHelperRecentTicketInteractions(undefined), {
            wrapper: makeWrapper(),
        });
        expect(result.current.fetchStatus).toBe("idle");
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
