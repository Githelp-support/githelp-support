import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { buildOnboardingChecklist, type OnboardingChecklistInput } from "@/lib/onboarding-checklist"
import { OnboardingChecklist, OnboardingChecklistCard } from "./onboarding-checklist"

const mocks = vi.hoisted(() => ({
  useOnboardingChecklist: vi.fn(),
  markLandingPageViewed: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

vi.mock("@/hooks/useOnboardingChecklist", () => ({
  useOnboardingChecklist: mocks.useOnboardingChecklist,
  useMarkLandingPageViewed: () => mocks.markLandingPageViewed,
}))
vi.mock("sonner", () => ({ toast: mocks.toast }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const input: OnboardingChecklistInput = {
  helperCount: 0,
  ratesModified: false,
  landingPageViewed: false,
  brandingSet: false,
  payoutsNeeded: false,
  payoutsEnabled: false,
  dismissedSteps: [],
}

const wrap = (ui: ReactNode) => render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)
const row = (label: string) => screen.getByText(label).closest("li") as HTMLElement

describe("OnboardingChecklistCard", () => {
  it("strikes through done steps and links the open ones to their section", () => {
    wrap(
      <OnboardingChecklistCard
        checklist={buildOnboardingChecklist({ ...input, payoutsNeeded: true })}
        onStepOpen={vi.fn()}
        onStepDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText("1 of 6 done")).toBeInTheDocument()
    expect(screen.getByText("Create project")).toHaveClass("line-through")
    expect(screen.queryByRole("link", { name: "Create project" })).not.toBeInTheDocument()
    expect(within(row("Create project")).queryByRole("button", { name: /Dismiss/ })).not.toBeInTheDocument()

    expect(screen.getByRole("link", { name: "Add helpers" })).toHaveAttribute("href", "/helpers")
    expect(screen.getByRole("link", { name: "Modify rates" })).toHaveAttribute("href", "/settings/payment")
    expect(screen.getByRole("link", { name: "See your support landing page" })).toHaveAttribute("href", "/landing-page")
    expect(screen.getByRole("link", { name: "Set your branding" })).toHaveAttribute("href", "/settings/branding")
    expect(screen.getByRole("link", { name: "Set up payouts" })).toHaveAttribute("href", "/settings/payment")

    expect(within(row("Modify rates")).getByText("Optional")).toBeInTheDocument()
    expect(within(row("Add helpers")).queryByText("Optional")).not.toBeInTheDocument()
  })

  it("shows a step's details from its info button", async () => {
    wrap(
      <OnboardingChecklistCard
        checklist={buildOnboardingChecklist({ ...input, payoutsNeeded: true })}
        onStepOpen={vi.fn()}
        onStepDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: 'About "Set up payouts"' }))
    await waitFor(() =>
      expect(screen.getAllByText(/receive the money your project has earned from tickets/).length).toBeGreaterThan(0),
    )
  })

  it("reports the dismissed step without following the row link", () => {
    const onStepDismiss = vi.fn()
    const onStepOpen = vi.fn()
    wrap(
      <OnboardingChecklistCard
        checklist={buildOnboardingChecklist(input)}
        onStepOpen={onStepOpen}
        onStepDismiss={onStepDismiss}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: 'Dismiss "Set your branding"' }))
    expect(onStepDismiss).toHaveBeenCalledTimes(1)
    expect(onStepDismiss.mock.calls[0][0].id).toBe("set_branding")
    expect(onStepOpen).not.toHaveBeenCalled()
  })
})

describe("OnboardingChecklist", () => {
  const setStepDismissed = vi.fn()

  beforeEach(() => {
    setStepDismissed.mockReset().mockResolvedValue(undefined)
    mocks.markLandingPageViewed.mockReset()
    mocks.toast.mockReset()
    mocks.toast.error.mockReset()
  })

  it("renders nothing while loading and once every required step is done", () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: null, setStepDismissed })
    const { container, rerender } = wrap(<OnboardingChecklist projectId="p1" />)
    expect(container).toBeEmptyDOMElement()

    mocks.useOnboardingChecklist.mockReturnValue({
      checklist: buildOnboardingChecklist({ ...input, helperCount: 1, landingPageViewed: true }),
      setStepDismissed,
    })
    rerender(<TooltipProvider><OnboardingChecklist projectId="p1" /></TooltipProvider>)
    expect(screen.queryByText("Finish setting up your project")).not.toBeInTheDocument()
  })

  it("dismisses a step for good and offers an undo", async () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: buildOnboardingChecklist(input), setStepDismissed })
    wrap(<OnboardingChecklist projectId="p1" />)

    fireEvent.click(screen.getByRole("button", { name: 'Dismiss "Modify rates"' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled())
    expect(setStepDismissed).toHaveBeenCalledWith("modify_rates", true)

    const [message, options] = mocks.toast.mock.calls[0]
    expect(message).toBe('"Modify rates" dismissed')
    options.action.onClick()
    expect(setStepDismissed).toHaveBeenLastCalledWith("modify_rates", false)
  })

  it("tells the admin when a dismissal could not be saved", async () => {
    setStepDismissed.mockRejectedValue(new Error("offline"))
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: buildOnboardingChecklist(input), setStepDismissed })
    wrap(<OnboardingChecklist projectId="p1" />)

    fireEvent.click(screen.getByRole("button", { name: 'Dismiss "Add helpers"' }))
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it("ticks off the landing page step when it is opened from the list", () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: buildOnboardingChecklist(input), setStepDismissed })
    wrap(<OnboardingChecklist projectId="p1" />)

    fireEvent.click(screen.getByRole("link", { name: "Add helpers" }))
    expect(mocks.markLandingPageViewed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("link", { name: "See your support landing page" }))
    expect(mocks.markLandingPageViewed).toHaveBeenCalledTimes(1)
  })
})
