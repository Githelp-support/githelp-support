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
const openLabels = [
  "Add helpers",
  "Modify rates",
  "Share your support landing page",
  "Set your branding",
  "Set up payouts",
]
/** Labels of the rows carrying the inset brand edge of the next open step. */
const accentedRows = () =>
  ["Create project", ...openLabels].filter(
    (label) => screen.queryByText(label)?.closest("li")?.className.includes("shadow-[inset_3px_0_0"),
  )

describe("OnboardingChecklistCard", () => {
  it("marks done steps with the done icon and links the open ones to their section", () => {
    wrap(
      <OnboardingChecklistCard
        checklist={buildOnboardingChecklist({ ...input, payoutsNeeded: true })}
        onStepOpen={vi.fn()}
        onStepDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText("1 / 6")).toBeInTheDocument()
    expect(screen.getByLabelText("1 of 6 done")).toHaveTextContent("1 / 6")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(
      screen.getByText("Follow the steps below to get your project ready for support requests."),
    ).toBeInTheDocument()
    expect(screen.getByText("Create project")).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Create project")).not.toHaveClass("line-through")
    expect(screen.queryByRole("link", { name: "Create project" })).not.toBeInTheDocument()
    expect(within(row("Create project")).queryByRole("button", { name: /Skip/ })).not.toBeInTheDocument()

    expect(screen.getByRole("link", { name: "Add helpers" })).toHaveAttribute("href", "/helpers")
    expect(screen.getByRole("link", { name: "Modify rates" })).toHaveAttribute("href", "/settings/payment")
    expect(screen.getByRole("link", { name: "Share your support landing page" })).toHaveAttribute("href", "/landing-page")
    expect(screen.getByRole("link", { name: "Set your branding" })).toHaveAttribute("href", "/settings/branding")
    expect(screen.getByRole("link", { name: "Set up payouts" })).toHaveAttribute("href", "/settings/payment")

    expect(accentedRows()).toEqual(["Add helpers"])
    expect(within(row("Create project")).getByRole("img", { name: "Done" })).toBeInTheDocument()
    expect(within(row("Create project")).queryByRole("img", { name: "Not done" })).not.toBeInTheDocument()
    for (const label of openLabels) {
      expect(within(row(label)).getByRole("img", { name: "Not done" })).toBeInTheDocument()
    }

    expect(within(row("Modify rates")).getByText("Optional")).toBeInTheDocument()
    expect(within(row("Add helpers")).queryByText("Optional")).not.toBeInTheDocument()
  })

  it("moves the accent to the next open step and gives each done icon its own mask", () => {
    wrap(
      <OnboardingChecklistCard
        checklist={buildOnboardingChecklist({ ...input, helperCount: 1 })}
        onStepOpen={vi.fn()}
        onStepDismiss={vi.fn()}
      />,
    )

    expect(accentedRows()).toEqual(["Modify rates"])

    const doneIcons = screen.getAllByRole("img", { name: "Done" })
    expect(doneIcons).toHaveLength(2)
    const maskIds = doneIcons.map((icon) => icon.querySelector("mask")?.id)
    expect(maskIds[0]).toBeTruthy()
    expect(maskIds[1]).toBeTruthy()
    expect(maskIds[0]).not.toBe(maskIds[1])
    // Each disc points at its own mask, not the first one in the document.
    doneIcons.forEach((icon, i) =>
      expect(icon.querySelector("circle[mask]")).toHaveAttribute("mask", `url(#${maskIds[i]})`),
    )
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
    fireEvent.click(screen.getByRole("button", { name: 'Skip "Set your branding"' }))
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

  it("renders nothing while loading and once every step is done or dismissed", () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: null, setStepDismissed })
    const { container, rerender } = wrap(<OnboardingChecklist projectId="p1" />)
    expect(container).toBeEmptyDOMElement()

    mocks.useOnboardingChecklist.mockReturnValue({
      checklist: buildOnboardingChecklist({
        ...input,
        helperCount: 1,
        landingPageViewed: true,
        ratesModified: true,
        dismissedSteps: ["set_branding"],
      }),
      setStepDismissed,
    })
    rerender(<TooltipProvider><OnboardingChecklist projectId="p1" /></TooltipProvider>)
    expect(screen.queryByText("Finish setting up your project")).not.toBeInTheDocument()
  })

  it("dismisses a step for good and offers an undo", async () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: buildOnboardingChecklist(input), setStepDismissed })
    wrap(<OnboardingChecklist projectId="p1" />)

    fireEvent.click(screen.getByRole("button", { name: 'Skip "Modify rates"' }))
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

    fireEvent.click(screen.getByRole("button", { name: 'Skip "Add helpers"' }))
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it("ticks off the landing page step when it is opened from the list", () => {
    mocks.useOnboardingChecklist.mockReturnValue({ checklist: buildOnboardingChecklist(input), setStepDismissed })
    wrap(<OnboardingChecklist projectId="p1" />)

    fireEvent.click(screen.getByRole("link", { name: "Add helpers" }))
    expect(mocks.markLandingPageViewed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("link", { name: "Share your support landing page" }))
    expect(mocks.markLandingPageViewed).toHaveBeenCalledTimes(1)
  })
})
