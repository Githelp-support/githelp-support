import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { SlaBillingPeriodRow, SlaPaymentFrequency } from "@/lib/sla"

export interface SlaReportSla {
  id: string
  name: string | null
  project_id: string
  payment_frequency: SlaPaymentFrequency
  subscription_amount_smallest_unit: number
  currency: string
  minutes_rollover: boolean
  ticket_price_minute_first_60: number
}

export interface ProjectSlaBillingPeriod extends SlaBillingPeriodRow {
  sla: SlaReportSla
}

const REPORT_QUERY_DEFAULTS = {
  retry: false,
  staleTime: 60_000,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const

/**
 * Every billing period of every SLA in a project, newest first, with the SLA
 * embedded (inner join so periods of other projects are excluded server-side).
 */
export function useProjectSlaBillingPeriods(projectId?: string | null) {
  return useQuery({
    queryKey: ["project-sla-billing-periods", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_billing_periods")
        .select(
          "*, sla:slas!inner(id, name, project_id, payment_frequency, subscription_amount_smallest_unit, currency, minutes_rollover, ticket_price_minute_first_60)",
        )
        .eq("sla.project_id", projectId as string)
        .order("period_start", { ascending: false })
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => {
        const rawSla = row.sla
        const sla = Array.isArray(rawSla) ? rawSla[0] : rawSla
        return { ...row, sla } as ProjectSlaBillingPeriod
      })
    },
    enabled: !!projectId,
    ...REPORT_QUERY_DEFAULTS,
  })
}

export interface ProjectSlaTicket {
  id: string
  title: string
  status: string
  created_at: string
  completed_at: string | null
  sla_id: string
  sla_usage_recorded_at: string | null
  sla: { id: string; name: string | null } | null
  time_entries: Array<{ time_milliseconds: number; date: string }>
  categories: Array<{ help_category: { value: string } | null }>
}

/** SLA-covered tickets of a project with their logged time and SLA name. */
export function useProjectSlaTickets(projectId?: string | null) {
  return useQuery({
    queryKey: ["project-sla-tickets", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, title, status, created_at, completed_at, sla_id, sla_usage_recorded_at, sla:slas(id, name), time_entries:tickets_time_entries(time_milliseconds, date), categories:tickets_help_categories(help_category:projects_help_categories(value))",
        )
        .eq("project_id", projectId as string)
        .not("sla_id", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => {
        const rawSla = row.sla
        const sla = Array.isArray(rawSla) ? rawSla[0] ?? null : rawSla ?? null
        return { ...row, sla } as ProjectSlaTicket
      })
    },
    enabled: !!projectId,
    ...REPORT_QUERY_DEFAULTS,
  })
}

/** Total logged minutes on a ticket from its embedded time entries. */
export function ticketLoggedMinutes(entries: Array<{ time_milliseconds: number }> | null | undefined): number {
  return Math.round((entries ?? []).reduce((sum, e) => sum + (e.time_milliseconds || 0), 0) / 60000)
}
