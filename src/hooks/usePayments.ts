import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { UserPaymentRecord } from "@/lib/user-payment-reports"

export interface Payment {
  id: string
  project_id: string | null
  ticket_id: string | null
  amount_smallest_unit: number
  currency: string
  status: "pending" | "completed" | "failed"
  amount_platform_smallest_unit: number
  amount_project_smallest_unit: number
  transaction_id: string | null
  created_at: string
  completed_at: string | null
  /**
   * Stripe-hosted receipt page for the charge. Ticket charges are plain
   * PaymentIntents (no Stripe Invoice), so this is the document to link the
   * customer to. Null until the charge is captured.
   */
  stripe_receipt_url?: string | null
}

export interface PaymentTransfer {
  id: string
  project_id: string | null
  helper_id: string | null
  ticket_id: string | null
  transfer_user_type: string
  status: "pending" | "completed" | "failed"
  amount_smallest_unit: number
  currency: string
  transfer_id: string | null
  created_at: string
  completed_at: string | null
  helper?: {
    user_id?: string | null
    user?: {
      name: string
      username: string | null
      email: string | null
    }
  }
  ticket?: {
    id: string
    title: string
    sla?: { name: string }
    categories?: Array<{ help_category: { value: string } | null }> | null
  }
  sla?: { name: string }
}

export function usePayments(projectId?: string) {
  return useQuery({
    queryKey: ["payments", projectId],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })

      if (projectId) {
        query = query.eq("project_id", projectId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as Payment[]
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function usePaymentTransfers(filters?: {
  projectId?: string
  helperId?: string
  ticketId?: string
  status?: string
  enabled?: boolean
}) {
  const { enabled: enabledProp, ...filterProps } = filters || {}
  return useQuery({
    queryKey: ["payment-transfers", filterProps?.projectId, filterProps?.helperId, filterProps?.ticketId, filterProps?.status],
    queryFn: async () => {
      let query = supabase
        .from("payments_transfers")
        .select(`
          *,
          helper:projects_helpers(
            user_id,
            user:users_public(name, username, email)
          ),
          ticket:tickets(
            id,
            title,
            sla:slas(name),
            categories:tickets_help_categories(
              help_category:projects_help_categories(value)
            )
          )
        `)
        .order("created_at", { ascending: false })

      if (filterProps?.projectId) {
        query = query.eq("project_id", filterProps.projectId)
      }
      if (filterProps?.helperId) {
        query = query.eq("helper_id", filterProps.helperId)
      }
      if (filterProps?.ticketId) {
        query = query.eq("ticket_id", filterProps.ticketId)
      }
      if (filterProps?.status) {
        query = query.eq("status", filterProps.status)
      }

      const { data, error } = await query
      if (error) throw error

      // Transform nested data (many-to-one embeds are objects, not arrays)
      return (data || []).map((transfer: any) => {
        const rawHelper = transfer.helper
        const helper = rawHelper == null
          ? null
          : Array.isArray(rawHelper)
            ? rawHelper[0] ?? null
            : rawHelper
        return {
          ...transfer,
          helper,
          ticket: transfer.ticket || null,
          sla: transfer.ticket?.sla || null,
        }
      }) as PaymentTransfer[]
    },
    enabled: enabledProp !== false,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function getHelperDisplayName(
  helper: PaymentTransfer["helper"],
): string {
  const user = helper?.user
  return user?.name || user?.username || user?.email || "Unknown"
}

// Helper function to format amount from cents to dollars
export function formatAmount(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100
  const currencySymbol = currency === "usd" ? "USD" : currency.toUpperCase()
  return `${currencySymbol} ${dollars.toFixed(2)}`
}

/**
 * Every `payments` row for tickets the given user created (the customer's
 * own charges/holds across all projects). RLS already scopes `payments` to
 * the ticket creator, so the `created_by` filter only makes the intent explicit.
 */
export function useUserPayments(userId?: string) {
  return useQuery({
    queryKey: ["user-payments", userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          ticket_id,
          project_id,
          status,
          currency,
          created_at,
          completed_at,
          amount_smallest_unit,
          authorized_amount_smallest_unit,
          captured_amount_smallest_unit,
          ticket:tickets!inner(
            id,
            title,
            project_id,
            created_by,
            project:projects(name),
            categories:tickets_help_categories(
              help_category:projects_help_categories(value)
            )
          )
        `)
        .eq("ticket.created_by", userId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as unknown as UserPaymentRecord[]
    },
    enabled: !!userId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
