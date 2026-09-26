import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface HelperTimeEntry {
  id: string
  ticket_id: string
  helper_id: string
  type: "together" | "solo"
  time_milliseconds: number
  /** Calendar day the time was logged on (YYYY-MM-DD). */
  date: string
  created_at: string
  /** Customer review; rows the customer declined are filtered out by the hook. */
  review_status?: "pending" | "accepted" | "declined" | null
}

/**
 * Time entries logged by one helper row, optionally narrowed to a project via
 * the owning ticket. RLS lets helpers read their own entries. Entries the
 * customer declined are left out: they are not billed, so they should not
 * show up as hours logged in payout reports.
 */
export function useHelperTimeEntries(helperId?: string | null, projectId?: string) {
  return useQuery({
    queryKey: ["helper-time-entries", helperId, projectId],
    queryFn: async () => {
      if (!helperId) return []
      let query = supabase
        .from("tickets_time_entries")
        .select("id, ticket_id, helper_id, type, time_milliseconds, date, created_at, review_status, ticket:tickets!inner(project_id)")
        .eq("helper_id", helperId)
        .order("date", { ascending: false })
      if (projectId) {
        query = query.eq("ticket.project_id", projectId)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || [])
        .map((row: any) => {
          const { ticket: _ticket, ...entry } = row
          return entry as HelperTimeEntry
        })
        .filter((entry) => entry.review_status !== "declined")
    },
    enabled: !!helperId,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
