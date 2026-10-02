import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { GithelpFunctionError, invokeFunction } from "@/hooks/useUnlisted"

/**
 * GitHelp staff tools (the `staff` edge function): outreach approvals,
 * independent-helper applications, unclaimed projects and platform settings.
 * The function answers 403 `not_staff` for everyone else.
 */
function staff<T>(action: string, body: Record<string, unknown> = {}, fallback = "Staff request failed"): Promise<T> {
  return invokeFunction<T>("staff", { action, ...body }, fallback)
}

export interface StaffOverview {
  pending_outreach: number
  pending_applications: number
  unclaimed_projects: number
}

/** True for a `not_staff` / 403 answer (the caller simply isn't staff). */
export function isNotStaffError(error: unknown): boolean {
  return error instanceof GithelpFunctionError && (error.code === "not_staff" || error.status === 403)
}

/**
 * Staff overview; doubles as the "is this user staff?" check (sidebar entry,
 * page guard). `null` means "not staff" — a successful, cached answer (an
 * error would be re-fetched on every sidebar mount), so non-staff users pay
 * one request per session.
 */
export function useStaffOverview(enabled = true) {
  return useQuery({
    queryKey: ["staff-overview"],
    queryFn: async (): Promise<StaffOverview | null> => {
      try {
        return await staff<StaffOverview>("overview")
      } catch (e) {
        if (isNotStaffError(e)) return null
        throw e
      }
    },
    enabled,
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useIsStaff(enabled = true): boolean {
  const { data } = useStaffOverview(enabled)
  return !!data
}

// --- Outreach -------------------------------------------------------------------

export interface OutreachItem {
  id: string
  repo: string
  status: string
  request_count: number
  pledged_smallest_unit: number
  created_at: string
  posted_url: string | null
  error: string | null
  last_posted_at: string | null
}

export interface OutreachPreview {
  title: string
  body: string
  channel_available: { discussion: boolean; issue: boolean }
  opted_out: boolean
}

export function useOutreachQueue(status?: string) {
  return useQuery({
    queryKey: ["staff-outreach", status ?? "all"],
    queryFn: async () => (await staff<{ items: OutreachItem[] }>("list_outreach", status ? { status } : {})).items,
    retry: false,
  })
}

export function useOutreachPreview(id: string | null) {
  return useQuery({
    queryKey: ["staff-outreach-preview", id],
    queryFn: () => staff<OutreachPreview>("preview_outreach", { id }),
    enabled: !!id,
    retry: false,
  })
}

function useStaffMutation<TInput extends Record<string, unknown>, TResult>(action: string, invalidate: string[][]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => staff<TResult>(action, input),
    onSuccess: () => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ["staff-overview"] })
    },
  })
}

export function useApproveOutreach() {
  return useStaffMutation<
    { id: string; channel?: "discussion" | "issue"; title?: string; body?: string },
    { status: "posted" | "opted_out" | "failed"; posted_url?: string; error?: string }
  >("approve_outreach", [["staff-outreach"]])
}

export function useRejectOutreach() {
  return useStaffMutation<{ id: string; reason: string }, unknown>("reject_outreach", [["staff-outreach"]])
}

// --- Helper applications ----------------------------------------------------------

export interface StaffApplication {
  id: string
  repo: string
  user: { id: string; name: string | null; email: string | null; avatar_url: string | null; github_login: string | null }
  motivation: string
  evidence: {
    merged_prs: number | null
    commits: number | null
    profile_url: string | null
    /** True when the login comes from a GitHub account linked to the applicant (not typed in). */
    github_login_verified?: boolean
  }
  status: string
  created_at: string
}

export function useHelperApplications(status?: string) {
  return useQuery({
    queryKey: ["staff-applications", status ?? "all"],
    queryFn: async () => (await staff<{ items: StaffApplication[] }>("list_applications", status ? { status } : {})).items,
    retry: false,
  })
}

export function useApproveApplication() {
  return useStaffMutation<{ id: string }, unknown>("approve_application", [["staff-applications"]])
}

export function useRejectApplication() {
  return useStaffMutation<{ id: string; reason: string }, unknown>("reject_application", [["staff-applications"]])
}

// --- Unclaimed projects --------------------------------------------------------------

export interface UnclaimedProject {
  project_id: string
  slug: string
  /** Null when the project's repository row is missing. */
  repo: string | null
  open_tickets: number
  requests: number
  helpers: number
  created_at: string
}

export function useUnclaimedProjects() {
  return useQuery({
    queryKey: ["staff-unclaimed"],
    queryFn: async () => (await staff<{ items: UnclaimedProject[] }>("list_unclaimed")).items,
    retry: false,
  })
}

// --- Platform settings ------------------------------------------------------------------

export interface PlatformSettings {
  unlisted_start_price: number
  unlisted_price_minute_first_60: number
  unlisted_price_minute_after_60: number
  unlisted_default_estimated_minutes: number
  independent_helper_percentage: number
  outreach_threshold_requests: number
  outreach_cooldown_days: number
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["staff-settings"],
    queryFn: async () => (await staff<{ settings: PlatformSettings }>("get_settings")).settings,
    retry: false,
  })
}

export function useUpdatePlatformSettings() {
  return useStaffMutation<Partial<PlatformSettings>, { settings: PlatformSettings }>("update_settings", [["staff-settings"]])
}
