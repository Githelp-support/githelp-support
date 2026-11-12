import { describe, it, expect } from "vitest"
import { buildOnboardingChecklist, type OnboardingChecklistInput } from "./onboarding-checklist"

const fresh: OnboardingChecklistInput = {
  helperCount: 0,
  ratesModified: false,
  landingPageViewed: false,
  brandingSet: false,
  payoutsNeeded: false,
  payoutsEnabled: false,
  dismissedSteps: [],
}

const build = (over: Partial<OnboardingChecklistInput> = {}) => buildOnboardingChecklist({ ...fresh, ...over })
const ids = (over?: Partial<OnboardingChecklistInput>) => build(over).steps.map((step) => step.id)

describe("buildOnboardingChecklist", () => {
  it("lists the steps in order for a new project, with only 'Create project' done", () => {
    const checklist = build()
    expect(checklist.steps.map((step) => [step.id, step.done, step.optional])).toEqual([
      ["create_project", true, false],
      ["add_helpers", false, false],
      ["modify_rates", false, true],
      ["view_landing_page", false, false],
      ["set_branding", false, true],
    ])
    expect(checklist.doneCount).toBe(1)
    expect(checklist.totalCount).toBe(5)
    expect(checklist.visible).toBe(true)
  })

  it("links every open step to its section", () => {
    const hrefs = Object.fromEntries(build({ payoutsNeeded: true }).steps.map((step) => [step.id, step.href]))
    expect(hrefs).toEqual({
      create_project: null,
      add_helpers: "/helpers",
      modify_rates: "/settings/payment",
      view_landing_page: "/landing-page",
      set_branding: "/settings/branding",
      setup_payouts: "/settings/payment",
    })
  })

  it("shows 'Set up payouts' last, and only once a paid ticket needs it", () => {
    expect(ids()).not.toContain("setup_payouts")
    expect(ids({ payoutsNeeded: true }).at(-1)).toBe("setup_payouts")
  })

  it("leaves a dismissed step out and ignores unknown ids", () => {
    expect(ids({ dismissedSteps: ["modify_rates", "something_old"] })).toEqual([
      "create_project",
      "add_helpers",
      "view_landing_page",
      "set_branding",
    ])
  })

  it("hides the section once the required steps are done, even with optional ones open", () => {
    const checklist = build({ helperCount: 1, landingPageViewed: true })
    expect(checklist.steps.filter((step) => !step.done).map((step) => step.id)).toEqual(["modify_rates", "set_branding"])
    expect(checklist.visible).toBe(false)
  })

  it("hides the section when the remaining required steps are dismissed", () => {
    expect(build({ dismissedSteps: ["add_helpers", "view_landing_page"] }).visible).toBe(false)
  })

  it("comes back for payouts after the first paid ticket, and goes away once payouts are enabled", () => {
    const done = { helperCount: 2, landingPageViewed: true }
    expect(build({ ...done, payoutsNeeded: true }).visible).toBe(true)
    expect(build({ ...done, payoutsNeeded: true, payoutsEnabled: true }).visible).toBe(false)
    expect(build({ ...done, payoutsNeeded: true, dismissedSteps: ["setup_payouts"] }).visible).toBe(false)
  })
})
