import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"

/**
 * Edge-function error that keeps the backend's machine-readable `code`
 * (e.g. `not_a_maintainer`, `not_staff`) and HTTP status, so pages can react
 * to specific cases instead of only showing the message.
 */
export class GithelpFunctionError extends Error {
  constructor(message: string, public readonly code: string | null, public readonly status: number | null) {
    super(message)
    this.name = "GithelpFunctionError"
  }
}

async function toFunctionError(error: unknown, fallback: string): Promise<GithelpFunctionError> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? null
    const body = await error.context?.json?.().catch(() => null)
    if (body && typeof body.error === "string") {
      return new GithelpFunctionError(body.error, typeof body.code === "string" ? body.code : null, status)
    }
    return new GithelpFunctionError(fallback, null, status)
  }
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message
  return new GithelpFunctionError(message || fallback, null, null)
}

export async function invokeFunction<T>(fn: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw await toFunctionError(error, fallback)
  if (data?.error) throw new GithelpFunctionError(String(data.error), data.code ?? null, null)
  return data as T
}

// --- Repository overview (public) ----------------------------------------------

export type RepoSupportStatus = "listed" | "unclaimed" | "unknown"

/**
 * For a malformed repo the backend returns only `{repo, status: "unknown"}`,
 * so everything beyond those two fields is optional.
 */
export interface RepoSupportOverview {
  repo: string
  status: RepoSupportStatus
  project?: { project_id: string; slug: string; name: string } | null
  requests?: number
  pledged_smallest_unit?: number
  open_tickets?: number
  independent_helpers?: number
  pricing?: {
    start_price: number
    per_minute_first_60: number
    per_minute_after_60: number
  } | null
  outreach?: {
    status: "none" | "pending_review" | "posted" | "opted_out"
    posted_url: string | null
  }
}

/** Demand, pricing and status for "owner/repo" — readable by anonymous visitors. */
export function useRepoOverview(repo: string | null) {
  return useQuery({
    queryKey: ["repo-support-overview", repo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_repo_support_overview", { p_repo: repo })
      if (error) throw error
      return data as RepoSupportOverview
    },
    enabled: !!repo,
    staleTime: 30_000,
    retry: 1,
  })
}

// --- Customer: support requests ------------------------------------------------

export interface RequestSupportInput {
  repo: string
  message?: string
  pledge_smallest_unit?: number | null
  ticket?: { title: string; description: string; allow_independent: boolean }
  /** One per form submit, so a retry doesn't open a second ticket. */
  client_request_id?: string
}

export interface RequestSupportRecorded {
  already_listed?: false
  repo: string
  project_id: string
  slug: string
  request_id: string
  ticket_id: string | null
  demand_url: string
}

/** The repo turned out to be run by its maintainers already (rename, race with a claim). */
export interface RequestSupportAlreadyListed {
  already_listed: true
  repo: string
  project: { project_id: string; slug: string; name: string }
  note?: string
}

export type RequestSupportResult = RequestSupportRecorded | RequestSupportAlreadyListed

export function useRequestSupport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RequestSupportInput) =>
      invokeFunction<RequestSupportResult>(
        "unlisted-projects",
        { action: "request", ...input },
        "Could not send your request",
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["repo-support-overview", result.repo] })
      queryClient.invalidateQueries({ queryKey: ["my-support-requests"] })
    },
  })
}

export function useWithdrawRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (repo: string) =>
      invokeFunction<{ withdrawn: boolean }>("unlisted-projects", { action: "withdraw_request", repo }, "Could not withdraw your request"),
    onSuccess: (_data, repo) => {
      queryClient.invalidateQueries({ queryKey: ["repo-support-overview", repo] })
      queryClient.invalidateQueries({ queryKey: ["my-support-requests"] })
    },
  })
}

export interface MySupportRequest {
  repo: string
  created_at: string
  pledge_smallest_unit: number | null
  ticket_id: string | null
  status: string
}

export function useMySupportRequests(enabled = true) {
  return useQuery({
    queryKey: ["my-support-requests"],
    queryFn: async () =>
      (await invokeFunction<{ requests: MySupportRequest[] }>(
        "unlisted-projects",
        { action: "my_requests" },
        "Could not load your requests",
      )).requests,
    enabled,
    retry: false,
  })
}

// --- Independent helpers ---------------------------------------------------------

export interface HelperApplication {
  id: string
  repo: string
  status: "pending" | "approved" | "rejected" | string
  created_at: string
  decided_at: string | null
  reason: string | null
}

export function useApplyAsHelper() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { repo: string; motivation: string; github_login?: string }) =>
      invokeFunction<{ application_id: string; status: string }>(
        "unlisted-projects",
        { action: "apply_helper", ...input },
        "Could not send your application",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-helper-applications"] })
    },
  })
}

export function useMyHelperApplications(enabled = true) {
  return useQuery({
    queryKey: ["my-helper-applications"],
    queryFn: async () =>
      (await invokeFunction<{ applications: HelperApplication[] }>(
        "unlisted-projects",
        { action: "my_applications" },
        "Could not load your applications",
      )).applications,
    enabled,
    retry: false,
  })
}

// --- Maintainers: claiming the project ----------------------------------------------

export function useClaimRepo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { repo: string; github_token: string }) =>
      invokeFunction<{ project_id: string; slug: string }>(
        "unlisted-projects",
        { action: "claim", ...input },
        "Could not claim this project",
      ),
    onSuccess: async (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["repo-support-overview", input.repo] })
      // The user is now an admin of a project: the cached "not a member" state
      // from the GitHub verification round-trip would otherwise bounce them
      // into onboarding when they open the project.
      await refreshMembership(queryClient)
    },
  })
}

/** Re-read membership/onboarding state (after a claim or an approved helper application). */
export async function refreshMembership(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["onboarding-status"] }),
    queryClient.refetchQueries({ queryKey: ["user-projects"] }),
  ])
}

// --- Ticket chat: is this ticket's project still unclaimed? ------------------------

/** True when the project is run by GitHelp until its maintainers claim it. */
export function useProjectUnclaimed(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-unclaimed", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("unclaimed")
        .eq("project_id", projectId as string)
        .maybeSingle()
      // Older databases have no such column: treat as a normal project.
      if (error) return false
      return (data as { unclaimed?: boolean } | null)?.unclaimed === true
    },
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
