import { useCallback, useMemo, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { useHelpers } from "@/hooks/useHelpers"
import { useProject, useProjectBranding, useProjectPaymentSettings } from "@/hooks/useProject"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import {
  buildOnboardingChecklist,
  type OnboardingChecklist,
  type OnboardingStepId,
} from "@/lib/onboarding-checklist"

/** The part of the checklist that is stored (`projects_onboarding`); the rest is derived. */
interface OnboardingState {
  dismissed_steps: string[]
  landing_page_viewed_at: string | null
}

const EMPTY_STATE: OnboardingState = { dismissed_steps: [], landing_page_viewed_at: null }

const stateKey = (projectId: string) => ["project-onboarding", projectId] as const

/** A settings row counts as edited once it was saved after the project created it. */
const EDITED_AFTER_MS = 2000

function useOnboardingState(projectId: string) {
  return useQuery({
    queryKey: stateKey(projectId),
    enabled: !!projectId,
    retry: false,
    staleTime: 1800000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OnboardingState> => {
      const { data, error } = await supabase
        .from("projects_onboarding")
        .select("dismissed_steps, landing_page_viewed_at")
        .eq("project_id", projectId)
        .maybeSingle()
      if (error) throw error
      const row = data as Partial<OnboardingState> | null
      return {
        dismissed_steps: row?.dismissed_steps ?? [],
        landing_page_viewed_at: row?.landing_page_viewed_at ?? null,
      }
    },
  })
}

/**
 * True once a completed, paid ticket has a share for the project: from then
 * on there is money that needs a Stripe account to be received.
 */
function usePayoutsNeeded(projectId: string) {
  return useQuery({
    queryKey: ["project-payouts-needed", projectId],
    enabled: !!projectId,
    retry: false,
    staleTime: 300000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("payments_transfers")
        .select("id, ticket:tickets!inner(status)")
        .eq("project_id", projectId)
        .eq("transfer_user_type", "project")
        .neq("status", "cancelled")
        .gt("amount_smallest_unit", 0)
        .eq("ticket.status", "completed")
        .limit(1)
      if (error) throw error
      return (data ?? []).length > 0
    },
  })
}

/** Writes one column of the project's `projects_onboarding` row, creating the row when needed. */
function useSaveOnboardingState(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<OnboardingState>) => {
      const { error } = await supabase
        .from("projects_onboarding")
        .upsert({ project_id: projectId, ...patch }, { onConflict: "project_id" })
      if (error) throw error
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: stateKey(projectId) })
      const previous = queryClient.getQueryData<OnboardingState>(stateKey(projectId))
      queryClient.setQueryData<OnboardingState>(stateKey(projectId), { ...(previous ?? EMPTY_STATE), ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      queryClient.setQueryData(stateKey(projectId), context?.previous)
    },
  })
}

/**
 * Records that an admin opened the support landing page section, which ticks
 * off the "See your support landing page" step. Safe to call repeatedly: it
 * writes once per project and never surfaces an error (the step just stays
 * open).
 */
export function useMarkLandingPageViewed(projectId: string) {
  const { data: state } = useOnboardingState(projectId)
  const { mutate } = useSaveOnboardingState(projectId)
  const pending = !!projectId && !!state && !state.landing_page_viewed_at
  // One attempt per project per mount: a failed save rolls the cached state
  // back, which would otherwise make `pending` true again and retry forever
  // from the landing page's effect.
  const attemptedFor = useRef<string | null>(null)
  return useCallback(() => {
    if (!pending || attemptedFor.current === projectId) return
    attemptedFor.current = projectId
    mutate({ landing_page_viewed_at: new Date().toISOString() })
  }, [pending, projectId, mutate])
}

export interface UseOnboardingChecklist {
  /** Null while loading, for a sandbox project, or when the state could not be read. */
  checklist: OnboardingChecklist | null
  /** Hide a step for good (or bring it back, for "Undo"). Rejects when the save fails. */
  setStepDismissed: (stepId: OnboardingStepId, dismissed: boolean) => Promise<void>
}

export function useOnboardingChecklist(projectId: string): UseOnboardingChecklist {
  const queryClient = useQueryClient()
  const { data: project } = useProject(projectId)
  const state = useOnboardingState(projectId)
  const helpers = useHelpers(projectId || undefined)
  const paymentSettings = useProjectPaymentSettings(projectId)
  const branding = useProjectBranding(projectId)
  const payoutsNeeded = usePayoutsNeeded(projectId)
  const orgStatus = usePaymentStatus({
    scope: "organization",
    scopeId: project?.organization_id ?? "",
    projectId: projectId || undefined,
  })
  const save = useSaveOnboardingState(projectId)

  // Every input must have settled, so a step never flips from open to done
  // (or the whole section in and out) while the page loads. A failed read of
  // a derived input counts as "not done"; without the stored state there is
  // no way to honour dismissals, so nothing is shown.
  const settled =
    !!project &&
    state.isSuccess &&
    !helpers.isLoading &&
    !paymentSettings.isLoading &&
    !branding.isLoading &&
    !payoutsNeeded.isLoading &&
    (!project.organization_id || !orgStatus.isLoading)

  const checklist = useMemo(() => {
    // A sandbox project is seeded demo data: there is nothing to onboard.
    if (!settled || !project || project.sandbox || !state.data) return null
    const settings = paymentSettings.data as { created_at?: string; updated_at?: string } | null | undefined
    const brand = branding.data as { primary_color?: string | null; logo_url?: string | null } | null | undefined
    return buildOnboardingChecklist({
      helperCount: helpers.data?.length ?? 0,
      ratesModified:
        !!settings?.created_at &&
        !!settings.updated_at &&
        new Date(settings.updated_at).getTime() - new Date(settings.created_at).getTime() > EDITED_AFTER_MS,
      landingPageViewed: !!state.data.landing_page_viewed_at,
      brandingSet: !!brand?.primary_color || !!brand?.logo_url,
      payoutsNeeded: payoutsNeeded.data === true,
      payoutsEnabled: !!orgStatus.data?.stripe_account_id && orgStatus.data.stripe_payouts_enabled === true,
      dismissedSteps: state.data.dismissed_steps,
    })
  }, [settled, project, state.data, helpers.data, paymentSettings.data, branding.data, payoutsNeeded.data, orgStatus.data])

  const { mutateAsync } = save
  const setStepDismissed = useCallback(
    async (stepId: OnboardingStepId, dismissed: boolean) => {
      const current = queryClient.getQueryData<OnboardingState>(stateKey(projectId))?.dismissed_steps ?? []
      const next = dismissed
        ? [...new Set([...current, stepId])]
        : current.filter((id) => id !== stepId)
      await mutateAsync({ dismissed_steps: next })
    },
    [queryClient, projectId, mutateAsync],
  )

  return { checklist, setStepDismissed }
}
