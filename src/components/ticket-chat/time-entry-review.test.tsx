import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import {
  DECLINE_TIME_ENTRY_PROMPT,
  TimeEntryAwaitingApprovalBanner,
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
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={[item()]} />)
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(screen.getByTestId("summary-total")).toHaveTextContent("00:00 h")
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }))
    expect(screen.getByTestId("summary-total")).toHaveTextContent("01:30 h")
    expect(screen.getByRole("button", { name: "Confirm logged time" })).toBeEnabled()
  })

  it("locks the form while the confirmation is being saved", () => {
    render(<TimeEntrySummaryDialog open pending onOpenChange={() => {}} onConfirm={() => {}} entries={[item()]} />)
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled()
  })

  it("has nothing to confirm when every entry was already reviewed", () => {
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        entries={[item({ reviewStatus: "accepted" })]}
      />,
    )
    expect(screen.getByText("There is no logged time waiting for your confirmation.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm logged time" })).toBeDisabled()
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
