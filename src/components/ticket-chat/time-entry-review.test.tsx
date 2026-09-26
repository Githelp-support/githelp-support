import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import {
  DeclineTimeEntryDialog,
  DECLINE_TIME_ENTRY_PROMPT,
  TimeEntryAwaitingApprovalBanner,
  TimeEntryReviewActions,
  TimeEntryReviewBanner,
  TimeEntryReviewStatusBadge,
} from "./time-entry-review"

describe("DeclineTimeEntryDialog", () => {
  it("shows the decline prompt and refuses to submit without an explanation", () => {
    const onConfirm = vi.fn()
    render(<DeclineTimeEntryDialog open onOpenChange={() => {}} onConfirm={onConfirm} durationLabel="1h 30min" helperName="Ada" />)

    expect(screen.getByText(DECLINE_TIME_ENTRY_PROMPT)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Decline 1h 30min logged by Ada?" })).toBeInTheDocument()

    const submit = screen.getByRole("button", { name: "Decline logged time" })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), { target: { value: "   " } })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("submits the trimmed explanation", async () => {
    const onConfirm = vi.fn()
    render(<DeclineTimeEntryDialog open onOpenChange={() => {}} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), {
      target: { value: "  We only spent 20 minutes together.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Decline logged time" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("We only spent 20 minutes together."))
  })

  it("locks the form while the decision is being saved", () => {
    render(<DeclineTimeEntryDialog open pending onOpenChange={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole("button", { name: "Declining…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Keep it" })).toBeDisabled()
    expect(screen.getByLabelText("Why are you declining this time?")).toBeDisabled()
  })
})

describe("TimeEntryReviewActions", () => {
  it("mentions when the entry is accepted automatically", () => {
    render(<TimeEntryReviewActions onAccept={() => {}} onDecline={() => {}} autoAcceptHint="in about 5 hours" />)
    expect(screen.getByText(/Accepted automatically in about 5 hours otherwise\./)).toBeInTheDocument()
  })

  it("calls accept / decline handlers", () => {
    const onAccept = vi.fn()
    const onDecline = vi.fn()
    render(<TimeEntryReviewActions onAccept={onAccept} onDecline={onDecline} />)
    fireEvent.click(screen.getByRole("button", { name: "Accept" }))
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onDecline).toHaveBeenCalledTimes(1)
  })
})

describe("TimeEntryReviewBanner", () => {
  it("renders nothing without pending entries and counts them otherwise", () => {
    const { container, rerender } = render(<TimeEntryReviewBanner pendingCount={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TimeEntryReviewBanner pendingCount={2} />)
    expect(screen.getByRole("status")).toHaveTextContent("2 logged time entries need your review.")
  })
})

describe("TimeEntryReviewStatusBadge", () => {
  it("words the pending state per perspective", () => {
    const { rerender } = render(<TimeEntryReviewStatusBadge status="pending" perspective="customer" />)
    expect(screen.getByText("Awaiting your review")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="pending" />)
    expect(screen.getByText("Waiting for approval")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="declined" />)
    expect(screen.getByText("Declined")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="accepted" auto />)
    expect(screen.getByText("Accepted automatically")).toBeInTheDocument()
  })
})

describe("TimeEntryAwaitingApprovalBanner", () => {
  it("tells the helper their logged time is waiting for approval", () => {
    const { container, rerender } = render(<TimeEntryAwaitingApprovalBanner pendingCount={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TimeEntryAwaitingApprovalBanner pendingCount={1} customerName="Grace" autoAcceptHint="in about 5 hours" />)
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for Grace to approve your logged time")
    expect(screen.getByRole("status")).toHaveTextContent("Accepted automatically in about 5 hours otherwise.")
    rerender(<TimeEntryAwaitingApprovalBanner pendingCount={3} />)
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the user to approve 3 logged time entries")
  })
})
