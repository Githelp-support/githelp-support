import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type SLA = Database["public"]["Tables"]["slas"]["Row"];
type SLAInsert = Database["public"]["Tables"]["slas"]["Insert"];
type SLAUpdate = Database["public"]["Tables"]["slas"]["Update"];
type SLABillingPeriod = Database["public"]["Tables"]["sla_billing_periods"]["Row"];

const SLA_QUERY_DEFAULTS = {
    retry: false,
    staleTime: 60_000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
} as const;

/** All SLAs of a project (admin list; RLS: project members + helpers). */
export function useSLAs(projectId?: string) {
    return useQuery({
        queryKey: ["slas", projectId],
        queryFn: async () => {
            let query = supabase
                .from("slas")
                .select("*")
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (projectId) {
                query = query.eq("project_id", projectId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as SLA[];
        },
        enabled: !!projectId,
        ...SLA_QUERY_DEFAULTS,
    });
}

export function useSLA(slaId?: string | null) {
    return useQuery({
        queryKey: ["sla", slaId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("slas")
                .select("*")
                .eq("id", slaId as string)
                .single();

            if (error) throw error;
            return data as SLA;
        },
        enabled: !!slaId,
        ...SLA_QUERY_DEFAULTS,
    });
}

export interface MySla extends SLA {
    project: { project_id: string; name: string; slug: string | null } | null;
}

/**
 * The customer's SLAs: every SLA linked to an organization the current user
 * belongs to, across all projects. Readable through the org-member RLS policy.
 */
export function useMySLAs(userId?: string | null) {
    return useQuery({
        queryKey: ["my-slas", userId],
        queryFn: async () => {
            const memberships = await supabase
                .from("organizations_members")
                .select("organization_id")
                .eq("id", userId as string);
            if (memberships.error) throw memberships.error;
            const orgIds = (memberships.data ?? []).map((m: { organization_id: string }) => m.organization_id);
            if (orgIds.length === 0) return [] as MySla[];

            const { data, error } = await supabase
                .from("slas")
                .select("*, project:projects(project_id, name, slug)")
                .in("organization_id", orgIds)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []).map((row: any) => ({
                ...row,
                project: Array.isArray(row.project) ? row.project[0] ?? null : row.project ?? null,
            })) as MySla[];
        },
        enabled: !!userId,
        ...SLA_QUERY_DEFAULTS,
    });
}

/**
 * The customer's active SLA for one project, if any — used when opening a
 * support chat to decide whether the ticket is SLA-covered.
 */
export function useMySlaForProject(userId?: string | null, projectId?: string | null) {
    const query = useMySLAs(userId);
    const sla = (query.data ?? []).find(
        (s) => s.project_id === projectId && s.status === "active" && (!s.end_date || s.end_date >= new Date().toISOString().slice(0, 10)),
    ) ?? null;
    return { ...query, sla };
}

/** Billing periods of one SLA, newest first (RLS: project members/helpers + org members). */
export function useSlaBillingPeriods(slaId?: string | null) {
    return useQuery({
        queryKey: ["sla-billing-periods", slaId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("sla_billing_periods")
                .select("*")
                .eq("sla_id", slaId as string)
                .order("period_start", { ascending: false });
            if (error) throw error;
            return (data ?? []) as SLABillingPeriod[];
        },
        enabled: !!slaId,
        ...SLA_QUERY_DEFAULTS,
    });
}

export interface SlaTicketRow {
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    created_by: string | null;
    sla_usage_recorded_at: string | null;
    time_entries: Array<{ time_milliseconds: number; date: string; helper_id: string }>;
    categories: Array<{ help_category: { value: string } | null }>;
}

/** Tickets attached to an SLA with their logged time (RLS-scoped). */
export function useSlaTickets(slaId?: string | null) {
    return useQuery({
        queryKey: ["sla-tickets", slaId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select(
                    "id, title, status, created_at, completed_at, created_by, sla_usage_recorded_at, time_entries:tickets_time_entries(time_milliseconds, date, helper_id), categories:tickets_help_categories(help_category:projects_help_categories(value))",
                )
                .eq("sla_id", slaId as string)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as unknown as SlaTicketRow[];
        },
        enabled: !!slaId,
        ...SLA_QUERY_DEFAULTS,
    });
}

/** Keep SLA rows and billing periods fresh when webhooks or helpers change them. */
export function useRealtimeSla(slaId?: string | null) {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!slaId) return;
        const channel = supabase
            .channel(`sla:${slaId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "slas", filter: `id=eq.${slaId}` }, () => {
                queryClient.invalidateQueries({ queryKey: ["sla", slaId] });
                queryClient.invalidateQueries({ queryKey: ["slas"] });
                queryClient.invalidateQueries({ queryKey: ["my-slas"] });
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "sla_billing_periods", filter: `sla_id=eq.${slaId}` }, () => {
                queryClient.invalidateQueries({ queryKey: ["sla-billing-periods", slaId] });
                queryClient.invalidateQueries({ queryKey: ["sla-usage", slaId] });
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [slaId, queryClient]);
}

export function useCreateSLA() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sla: SLAInsert) => {
            const { data, error } = await supabase
                .from("slas")
                .insert(sla)
                .select()
                .single();

            if (error) throw error;
            return data as SLA;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["slas", data.project_id],
            });
        },
    });
}

export function useUpdateSLA() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: SLAUpdate;
        }) => {
            const { data, error } = await supabase
                .from("slas")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as SLA;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["sla", data.id] });
            queryClient.invalidateQueries({
                queryKey: ["slas", data.project_id],
            });
            queryClient.invalidateQueries({ queryKey: ["my-slas"] });
        },
    });
}

/** Soft-delete: sets deleted_at; the row stays for reports and FK integrity. */
export function useDeleteSLA() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const { data, error } = await supabase
                .from("slas")
                .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as SLA;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["slas", data.project_id] });
            queryClient.invalidateQueries({ queryKey: ["sla", data.id] });
        },
    });
}

/* ---------------------------------------------------------------------------
 * Edge-function backed hooks
 * ------------------------------------------------------------------------- */

export interface SlaUsage {
    slaId: string;
    name: string | null;
    status: SLA["status"];
    covered: boolean;
    coverageReason: "inactive" | "expired" | "deleted" | null;
    hasSubscription: boolean;
    paymentFrequency: SLA["payment_frequency"];
    minutesRollover: boolean;
    overagePricePerMinuteSmallestUnit: number;
    currency: string;
    period: {
        id: string;
        periodStart: string;
        periodEnd: string;
        minutesIncluded: number;
        minutesRolledOver: number;
        minutesConsumed: number;
        minutesAvailable: number;
        minutesRemaining: number;
        overageMinutes: number;
    };
}

/**
 * Live usage for the SLA's current billing period via the `sla-usage` edge
 * function, which also materialises the period row when it does not exist.
 */
export function useSlaUsage(slaId?: string | null) {
    return useQuery({
        queryKey: ["sla-usage", slaId],
        queryFn: async (): Promise<SlaUsage> => {
            const resp = await supabase.functions.invoke("sla-usage", { body: { sla_id: slaId } });
            if (resp.error) throw new Error(resp.error.message || "Could not load SLA usage");
            const d = (resp.data ?? {}) as Record<string, any>;
            if (d.error) throw new Error(String(d.error));
            const p = (d.period ?? {}) as Record<string, any>;
            return {
                slaId: d.sla_id,
                name: d.name ?? null,
                status: d.status,
                covered: !!d.covered,
                coverageReason: d.coverage_reason ?? null,
                hasSubscription: !!d.has_subscription,
                paymentFrequency: d.payment_frequency,
                minutesRollover: !!d.minutes_rollover,
                overagePricePerMinuteSmallestUnit: Number(d.overage_price_per_minute_smallest_unit ?? 0),
                currency: d.currency ?? "usd",
                period: {
                    id: p.id,
                    periodStart: p.period_start,
                    periodEnd: p.period_end,
                    minutesIncluded: Number(p.minutes_included ?? 0),
                    minutesRolledOver: Number(p.minutes_rolled_over ?? 0),
                    minutesConsumed: Number(p.minutes_consumed ?? 0),
                    minutesAvailable: Number(p.minutes_available ?? 0),
                    minutesRemaining: Number(p.minutes_remaining ?? 0),
                    overageMinutes: Number(p.overage_minutes ?? 0),
                },
            };
        },
        enabled: !!slaId,
        ...SLA_QUERY_DEFAULTS,
    });
}

export interface JoinSlaResult {
    slaId: string;
    organizationId: string;
    projectId: string;
    projectName: string | null;
    projectSlug: string | null;
    name: string | null;
    status: SLA["status"];
    hasSubscription: boolean;
}

/** Customer enters the access code the project shared → links their organization to the SLA. */
export function useJoinSla() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ accessCode }: { accessCode: string }): Promise<JoinSlaResult> => {
            const resp = await supabase.functions.invoke("sla-join", { body: { access_code: accessCode } });
            if (resp.error) {
                // functions.invoke hides the JSON body on non-2xx; try to surface it.
                const ctx = (resp.error as { context?: Response }).context;
                let message = resp.error.message || "Could not join the SLA";
                try {
                    const body = ctx ? await ctx.clone().json() : null;
                    if (body?.error) message = String(body.error);
                } catch {
                    /* keep the generic message */
                }
                throw new Error(message);
            }
            const d = (resp.data ?? {}) as Record<string, any>;
            if (d.error) throw new Error(String(d.error));
            return {
                slaId: d.sla_id,
                organizationId: d.organization_id,
                projectId: d.project_id,
                projectName: d.project_name ?? null,
                projectSlug: d.project_slug ?? null,
                name: d.name ?? null,
                status: d.status,
                hasSubscription: !!d.has_subscription,
            };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-slas"] });
            queryClient.invalidateQueries({ queryKey: ["slas"] });
        },
    });
}

/** Org admin starts the Stripe subscription for their SLA. */
export function useCreateSlaSubscription() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ slaId }: { slaId: string }) => {
            const resp = await supabase.functions.invoke("payments-create-sla-subscription", {
                body: { sla_id: slaId },
            });
            if (resp.error) {
                const ctx = (resp.error as { context?: Response }).context;
                let message = resp.error.message || "Could not start the subscription";
                try {
                    const body = ctx ? await ctx.clone().json() : null;
                    if (body?.error) message = String(body.error);
                } catch {
                    /* keep the generic message */
                }
                throw new Error(message);
            }
            const d = (resp.data ?? {}) as Record<string, any>;
            if (d.error) throw new Error(String(d.error));
            return {
                slaId: d.sla_id as string,
                stripeSubscriptionId: d.stripe_subscription_id as string,
            };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["sla", data.slaId] });
            queryClient.invalidateQueries({ queryKey: ["sla-usage", data.slaId] });
            queryClient.invalidateQueries({ queryKey: ["my-slas"] });
            queryClient.invalidateQueries({ queryKey: ["slas"] });
        },
    });
}

export interface CompleteSlaTicketResult {
    ticketId: string;
    slaId: string;
    alreadyRecorded: boolean;
    deltaOverageMinutes: number;
    newConsumedMinutes: number;
    minutesAvailable: number;
    minutesRemaining: number;
}

/** Helper ends an SLA-covered ticket → minutes are recorded against the period. */
export function useCompleteSlaTicket() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ ticketId }: { ticketId: string }): Promise<CompleteSlaTicketResult> => {
            const resp = await supabase.functions.invoke("payments-complete-sla-ticket", {
                body: { ticket_id: ticketId },
            });
            if (resp.error) {
                const ctx = (resp.error as { context?: Response }).context;
                let message = resp.error.message || "Could not record SLA usage";
                try {
                    const body = ctx ? await ctx.clone().json() : null;
                    if (body?.error) message = String(body.error);
                } catch {
                    /* keep the generic message */
                }
                throw new Error(message);
            }
            const d = (resp.data ?? {}) as Record<string, any>;
            if (d.error) throw new Error(String(d.error));
            return {
                ticketId: d.ticket_id,
                slaId: d.sla_id,
                alreadyRecorded: !!d.already_recorded,
                deltaOverageMinutes: Number(d.delta_overage_minutes ?? 0),
                newConsumedMinutes: Number(d.new_consumed_minutes ?? 0),
                minutesAvailable: Number(d.minutes_available ?? 0),
                minutesRemaining: Number(d.minutes_remaining ?? Math.max(0, Number(d.minutes_available ?? 0) - Number(d.new_consumed_minutes ?? 0))),
            };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["sla-usage", data.slaId] });
            queryClient.invalidateQueries({ queryKey: ["sla-billing-periods", data.slaId] });
            queryClient.invalidateQueries({ queryKey: ["sla-tickets", data.slaId] });
        },
    });
}
