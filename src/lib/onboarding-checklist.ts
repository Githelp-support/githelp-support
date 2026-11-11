/**
 * The onboarding checklist shown at the top of the admin Overview page:
 * which steps exist, whether each is done, and whether the section is shown
 * at all. Pure, so the rules are easy to test; `useOnboardingChecklist`
 * gathers the inputs.
 *
 * Rules:
 * - "Create project" is always done.
 * - A dismissed step is never listed again (stored per project in
 *   `projects_onboarding.dismissed_steps`).
 * - "Set up payouts" only exists once a completed, paid ticket has a share
 *   for the project, i.e. once there is money to receive.
 * - The section is shown while a required step is still open. Optional
 *   steps are listed alongside but never keep it on screen by themselves.
 */

export type OnboardingStepId =
  | "create_project"
  | "add_helpers"
  | "modify_rates"
  | "view_landing_page"
  | "set_branding"
  | "setup_payouts"

export interface OnboardingStep {
  id: OnboardingStepId
  label: string
  /** Shown behind the info button. One or two short sentences. */
  details: string
  /** Where the step takes the admin; null for a step with nothing to open. */
  href: string | null
  optional: boolean
  done: boolean
}

export interface OnboardingChecklistInput {
  helperCount: number
  /** The ticket prices or sharing ratios were saved at least once. */
  ratesModified: boolean
  landingPageViewed: boolean
  /** A logo or a brand colour is set. */
  brandingSet: boolean
  /** A completed, paid ticket has a share for the project. */
  payoutsNeeded: boolean
  /** The organization's Stripe account can receive payouts. */
  payoutsEnabled: boolean
  /** Step ids from `projects_onboarding.dismissed_steps`; unknown ids are ignored. */
  dismissedSteps: readonly string[]
}

export interface OnboardingChecklist {
  /** Steps to list, in order. Dismissed steps are left out. */
  steps: OnboardingStep[]
  doneCount: number
  totalCount: number
  /** False once no required step is left open. */
  visible: boolean
}

export function buildOnboardingChecklist(input: OnboardingChecklistInput): OnboardingChecklist {
  const all: OnboardingStep[] = [
    {
      id: "create_project",
      label: "Create project",
      details: "Done. Your project is connected and ready to set up.",
      href: null,
      optional: false,
      done: true,
    },
    {
      id: "add_helpers",
      label: "Add helpers",
      details:
        "Helpers answer your tickets. Invite at least one. If that's you, add yourself.",
      href: "/helpers",
      optional: false,
      done: input.helperCount > 0,
    },
    {
      id: "modify_rates",
      label: "Modify rates",
      details:
        "Projects start with default prices. Change what a ticket costs and how it is shared with helpers.",
      href: "/settings/payment",
      optional: true,
      done: input.ratesModified,
    },
    {
      id: "view_landing_page",
      label: "See your support landing page",
      details: "This is the page your users open to ask for help. Open it and copy the link to share.",
      href: "/landing-page",
      optional: false,
      done: input.landingPageViewed,
    },
    {
      id: "set_branding",
      label: "Set your branding",
      details: "Add your logo and colour so the support page looks like your project.",
      href: "/settings/branding",
      optional: true,
      done: input.brandingSet,
    },
  ]

  if (input.payoutsNeeded) {
    all.push({
      id: "setup_payouts",
      label: "Set up payouts",
      details:
        "Connect a Stripe account. You need it to receive the money your project has earned from tickets.",
      href: "/settings/payment",
      optional: false,
      done: input.payoutsEnabled,
    })
  }

  const dismissed = new Set(input.dismissedSteps)
  // A done step stays listed (struck through) even if it was dismissed earlier.
  const steps = all.filter((step) => step.done || !dismissed.has(step.id))

  return {
    steps,
    doneCount: steps.filter((step) => step.done).length,
    totalCount: steps.length,
    visible: steps.some((step) => !step.optional && !step.done),
  }
}
