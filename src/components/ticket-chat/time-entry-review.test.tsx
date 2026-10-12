import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import {
  DECLINE_TIME_ENTRY_PROMPT,
  REJECT_LOGGED_TIME_PROMPT,
  TimeEntryAwaitingApprovalBanner,
  TimeEntriesReviewStatus,
  TimeEntryRejectedBanner,
  TimeEntryReviewStatusBadge,
  TimeEntrySummaryBanner,
  TimeEntrySummaryDialog,
  formatSummaryDate,
  type TimeEntrySummaryItem,
} from "./time-entry-review"

const item = (overrides: Partial<TimeEntrySummaryItem> = {}): TimeEntrySummaryItem => ({
  id: "e1",
  type: "together",
  date: "2026-10-08",
  hours: 1,
  minutes: 30,
  reviewStatus: "pending",
  helperName: "Ada",
  ...overrides,
})

describe("TimeEntrySummaryDialog", () => {
  it("lists pending entries, totals them and confirms everything with one action", async () => {
    const onConfirm = vi.fn()
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
        onReject={() => {}}
        autoAcceptHint="in about 5 hours"
        entries={[
          item(),
          item({ id: "e2", type: "solo", hours: 0, minutes: 45, note: "Fixed the webhook" }),
          item({ id: "e3", reviewStatus: "accepted", hours: 2, minutes: 0 }),
          item({ id: "e4", reviewStatus: "declined", hours: 5, minutes: 0 }),
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "Confirm the logged time" })).toBeInTheDocument()
    expect(screen.getByText(/confirmed automatically in about 5 hours otherwise/)).toBeInTheDocument()
    const list = screen.getByRole("list", { name: "Logged time to confirm" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(within(list).getByText("Fixed the webhook")).toBeInTheDocument()
    expect(within(list).getAllByText("08/10/2026")).toHaveLength(2)
    // 1:30 + 0:45 pending + 2:00 already confirmed; the declined 5h is not charged.
    expect(screen.getByTestId("summary-total")).toHaveTextContent("04:15 h")
    expect(screen.getByText(/Already confirmed earlier: 02:00 h/)).toBeInTheDocument()
    expect(screen.getByText(/Declined earlier: 1 entry/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Confirm logged time" }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith([]))
  })

  it("requires a reason for each declined entry and sends the trimmed reasons", async () => {
    const onConfirm = vi.fn()
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
        onReject={() => {}}
        entries={[item(), item({ id: "e2", type: "solo", hours: 0, minutes: 45 })]}
      />,
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[0])
    expect(screen.getByText(DECLINE_TIME_ENTRY_PROMPT)).toBeInTheDocument()
    // Declining removes the entry from the charged total.
    expect(screen.getByTestId("summary-total")).toHaveTextContent("00:45 h")

    const submit = screen.getByRole("button", { name: "Confirm 1 and decline 1" })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), { target: { value: "   " } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), {
      target: { value: "  We only spent 20 minutes together.  " },
    })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith([{ entryId: "e1", reason: "We only spent 20 minutes together." }]),
    )
  })

  it("lets the customer take a decline back", () => {
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />)
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(screen.getByTestId("summary-total")).toHaveTextContent("00:00 h")
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }))
    expect(screen.getByTestId("summary-total")).toHaveTextContent("01:30 h")
    expect(screen.getByRole("button", { name: "Confirm logged time" })).toBeEnabled()
  })

  it("locks the form while the confirmation is being saved", () => {
    render(<TimeEntrySummaryDialog open pending onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />)
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reject logged time" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled()
  })

  it("has nothing to confirm when every entry was already reviewed", () => {
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        onReject={() => {}}
        entries={[item({ reviewStatus: "accepted" })]}
      />,
    )
    expect(screen.getByText("There is no logged time waiting for your confirmation.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm logged time" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reject logged time" })).toBeDisabled()
  })

  it("shows the helper's avatar on each entry and scrolls the list past three entries", () => {
    const { rerender } = render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        onReject={() => {}}
        entries={[item({ helperId: "u1" }), item({ id: "e2" }), item({ id: "e3" })]}
      />,
    )
    const list = screen.getByRole("list", { name: "Logged time to confirm" })
    // No image → the fallback initial of the helper's name.
    expect(within(list).getAllByText("A")).toHaveLength(3)
    expect(list.className).not.toContain("max-h-")

    rerender(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        onReject={() => {}}
        entries={[item(), item({ id: "e2" }), item({ id: "e3" }), item({ id: "e4" })]}
      />,
    )
    const longList = screen.getByRole("list", { name: "Logged time to confirm" })
    expect(longList).toHaveClass("overflow-y-auto")
    expect(longList.className).toContain("max-h-")
    // The total stays outside the scrolling list.
    expect(longList).not.toContainElement(screen.getByTestId("summary-total"))
  })

  it("switches to the reject view and back", () => {
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />)
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))

    expect(screen.getByRole("heading", { name: "Logged time rejected" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Confirm the logged time" })).not.toBeInTheDocument()
    expect(REJECT_LOGGED_TIME_PROMPT).toBe(
      "You have rejected the time logged. Please explain why you are rejecting the logged time. Your explanation will be shared with your helper(s) in the ticket chat, so you together can coordinate what the logged time should be.",
    )
    expect(screen.getByText(REJECT_LOGGED_TIME_PROMPT)).toBeInTheDocument()
    const explanation = screen.getByRole("textbox")
    expect(explanation).toHaveAttribute("rows", "5")
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Confirm logged time" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("heading", { name: "Confirm the logged time" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Logged time rejected" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm logged time" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Reject logged time" })).toBeEnabled()
  })

  it("keeps per-entry declines when the reject view is cancelled", () => {
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />)
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), { target: { value: "Too long" } })
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Why are you declining this time?")).toHaveValue("Too long")
  })

  it("submits the trimmed rejection reason and needs a non-empty one", async () => {
    const onReject = vi.fn()
    const onConfirm = vi.fn()
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={onConfirm} onReject={onReject} entries={[item()]} />)
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))

    const submit = screen.getByRole("button", { name: "Submit" })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  We agreed on one hour.  " } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(onReject).toHaveBeenCalledWith("We agreed on one hour."))
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("locks the reject view while the rejection is being saved", () => {
    const { rerender } = render(
      <TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Too much" } })
    rerender(
      <TimeEntrySummaryDialog open pending onOpenChange={() => {}} onConfirm={() => {}} onReject={() => {}} entries={[item()]} />,
    )
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })
})

describe("formatSummaryDate", () => {
  it("renders YYYY-MM-DD as dd/mm/yyyy and leaves other strings alone", () => {
    expect(formatSummaryDate("2026-10-08")).toBe("08/10/2026")
    expect(formatSummaryDate("08/10/2026")).toBe("08/10/2026")
  })
})

describe("TimeEntrySummaryBanner", () => {
  it("names the helper, counts the entries and opens the review", () => {
    const onReview = vi.fn()
    render(<TimeEntrySummaryBanner pendingCount={2} helperName="Ada" autoAcceptHint="in about 5 hours" onReview={onReview} />)
    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent("Ada is ready to end the session and needs you to confirm the logged time.")
    expect(banner).toHaveTextContent("2 entries are waiting for your confirmation.")
    expect(banner).toHaveTextContent("confirmed automatically in about 5 hours")
    fireEvent.click(screen.getByRole("button", { name: "Review & confirm" }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
})

describe("TimeEntryReviewStatusBadge", () => {
  it("words the states per perspective", () => {
    const { rerender } = render(<TimeEntryReviewStatusBadge status="pending" perspective="customer" />)
    expect(screen.getByText("To confirm when the session ends")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="pending" />)
    expect(screen.getByText("Not yet confirmed")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="declined" />)
    expect(screen.getByText("Declined")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="accepted" />)
    expect(screen.getByText("Confirmed")).toBeInTheDocument()
    rerender(<TimeEntryReviewStatusBadge status="accepted" auto />)
    expect(screen.getByText("Confirmed automatically")).toBeInTheDocument()
  })
})

describe("TimeEntriesReviewStatus", () => {
  it("shows one state for all logged time", () => {
    const { container, rerender } = render(<TimeEntriesReviewStatus entries={[]} />)
    expect(container).toBeEmptyDOMElement()
    rerender(
      <TimeEntriesReviewStatus
        perspective="customer"
        entries={[{ reviewStatus: "accepted" }, { reviewStatus: "pending" }]}
      />,
    )
    expect(screen.getByText("To confirm when the session ends")).toBeInTheDocument()
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument()
    rerender(
      <TimeEntriesReviewStatus
        entries={[{ reviewStatus: "accepted" }, { reviewStatus: "accepted", autoAccepted: true }, { reviewStatus: "declined" }]}
      />,
    )
    expect(screen.getByText("Confirmed")).toBeInTheDocument()
    expect(screen.getByText("1 declined")).toBeInTheDocument()
    rerender(<TimeEntriesReviewStatus entries={[{ reviewStatus: "accepted", autoAccepted: true }]} />)
    expect(screen.getByText("Confirmed automatically")).toBeInTheDocument()
  })
})

describe("TimeEntryAwaitingApprovalBanner", () => {
  it("tells the helper the summary is waiting for the user", () => {
    const { container, rerender } = render(<TimeEntryAwaitingApprovalBanner pendingCount={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TimeEntryAwaitingApprovalBanner pendingCount={1} customerName="Grace" autoAcceptHint="in about 5 hours" />)
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for Grace to confirm the logged time")
    expect(screen.getByRole("status")).toHaveTextContent("You sent the summary (1 entry).")
    expect(screen.getByRole("status")).toHaveTextContent("confirmed automatically in about 5 hours")
    rerender(<TimeEntryAwaitingApprovalBanner pendingCount={3} />)
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the user to confirm the logged time")
    expect(screen.getByRole("status")).toHaveTextContent("confirmed automatically after 24 hours")
  })
})

describe("TimeEntryRejectedBanner", () => {
  it("tells the helper the user rejected the logged time", () => {
    const { rerender } = render(<TimeEntryRejectedBanner customerName="Grace" />)
    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent("Grace has rejected the logged time")
    expect(banner).toHaveTextContent("See the explanation for the rejection in the chat.")
    expect(screen.getByText("Grace has rejected the logged time")).toHaveClass("font-[550]")
    expect(banner.querySelector("i.fi.fi-rr-cross-circle")).toBeInTheDocument()
    rerender(<TimeEntryRejectedBanner />)
    expect(screen.getByRole("status")).toHaveTextContent("The user has rejected the logged time")
  })
})
