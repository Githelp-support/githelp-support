import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

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
    user?: {
      name: string
    }
  }
  ticket?: {
    id: string
    title: string
    sla?: { name: string }
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
            user:users_public(name)
          ),
          ticket:tickets(id, title, sla:slas(name))
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

      // Transform nested data
      return (data || []).map((transfer: any) => ({
        ...transfer,
        helper: transfer.helper?.[0] || null,
        ticket: transfer.ticket || null,
        sla: transfer.ticket?.sla || null,
      })) as PaymentTransfer[]
    },
    enabled: enabledProp !== false,
    retry: false,
    staleTime: 1800000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

// Helper function to format amount from cents to dollars
export function formatAmount(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100
  const currencySymbol = currency === "usd" ? "USD" : currency.toUpperCase()
  return `${currencySymbol} ${dollars.toFixed(2)}`
}
















