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
      ["set_branding", false, true],
      ["view_landing_page", false, false],
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

  it("shows 'Set up payouts' only once a paid ticket needs it, and keeps the landing page step last", () => {
    expect(ids()).not.toContain("setup_payouts")
    expect(ids().at(-1)).toBe("view_landing_page")
    expect(ids({ payoutsNeeded: true }).slice(-2)).toEqual(["setup_payouts", "view_landing_page"])
  })

  it("leaves a dismissed step out and ignores unknown ids", () => {
    expect(ids({ dismissedSteps: ["modify_rates", "something_old"] })).toEqual([
      "create_project",
      "add_helpers",
      "set_branding",
      "view_landing_page",
    ])
  })

  it("keeps the section while an optional step is open, even with the required ones done", () => {
    const checklist = build({ helperCount: 1, landingPageViewed: true })
    expect(checklist.steps.filter((step) => !step.done).map((step) => step.id)).toEqual(["modify_rates", "set_branding"])
    expect(checklist.visible).toBe(true)
    expect(build({ helperCount: 1, landingPageViewed: true, dismissedSteps: ["modify_rates"] }).visible).toBe(true)
  })

  it("hides the section once every step is done or dismissed", () => {
    const required = { helperCount: 1, landingPageViewed: true }
    expect(build({ ...required, ratesModified: true, brandingSet: true }).visible).toBe(false)
    expect(build({ ...required, dismissedSteps: ["modify_rates", "set_branding"] }).visible).toBe(false)
    expect(build({ ...required, ratesModified: true, dismissedSteps: ["set_branding"] }).visible).toBe(false)
    expect(
      build({ dismissedSteps: ["add_helpers", "modify_rates", "set_branding", "view_landing_page"] }).visible,
    ).toBe(false)
  })

  it("comes back for payouts after the first paid ticket, and goes away once payouts are enabled", () => {
    const done = { helperCount: 2, landingPageViewed: true, ratesModified: true, brandingSet: true }
    expect(build({ ...done, payoutsNeeded: true }).visible).toBe(true)
    expect(build({ ...done, payoutsNeeded: true, payoutsEnabled: true }).visible).toBe(false)
    expect(build({ ...done, payoutsNeeded: true, dismissedSteps: ["setup_payouts"] }).visible).toBe(false)
  })
})
