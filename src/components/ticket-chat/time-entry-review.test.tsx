import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

// TimeReviewSystemMessage → MarkdownContent → ChatImage → useTicketAttachments pulls in the client, which throws without env vars.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import {
  DECLINE_REASON_MAX_LENGTH,
  DECLINE_TIME_ENTRY_PROMPT,
  TimeEntryAwaitingApprovalBanner,
  TimeEntryRejectedBanner,
  TimeEntriesReviewStatus,
  TimeEntryReviewStatusBadge,
  TimeEntrySummaryBanner,
  TimeEntrySummaryDialog,
  TimeReviewSystemMessage,
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
    expect(within(list).getAllByText("08.10.2026")).toHaveLength(2)
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
    expect(screen.getByRole("button", { name: "Reject logged time" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled()
  })

  it("offers to close the summary when every entry was already reviewed", () => {
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        entries={[item({ reviewStatus: "accepted" })]}
      />,
    )
    expect(screen.getByText("There is no logged time waiting for your confirmation.")).toBeInTheDocument()
    // The open request can still be acknowledged; the RPC then just clears it.
    expect(screen.getByRole("button", { name: "Close summary" })).toBeEnabled()
    // Nothing is pending, so there is nothing to reject.
    expect(screen.getByRole("button", { name: "Reject logged time" })).toBeDisabled()
  })

  it("shows the helper's avatar on each entry", () => {
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        entries={[
          item({ helperUser: { id: "u-ada", name: "Ada", avatarUrl: null } }),
          item({ id: "e2", helperName: "Grace", note: "Fixed the webhook" }),
        ]}
      />,
    )
    const rows = within(screen.getByRole("list", { name: "Logged time to confirm" })).getAllByRole("listitem")
    // Initial of the helper, not the old T/S type letter.
    expect(within(rows[0]).getByText("A")).toBeInTheDocument()
    expect(within(rows[1]).getByText("G")).toBeInTheDocument()
    expect(within(rows[0]).queryByText("T")).not.toBeInTheDocument()
    expect(within(rows[1]).getByText("Fixed the webhook")).toHaveClass("ml-9")
  })

  it("caps the list of entries and keeps the earlier lines and the total outside it", () => {
    render(
      <TimeEntrySummaryDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        entries={[
          item(),
          item({ id: "e2" }),
          item({ id: "e3" }),
          item({ id: "e4" }),
          item({ id: "e5", reviewStatus: "accepted" }),
        ]}
      />,
    )
    const list = screen.getByRole("list", { name: "Logged time to confirm" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(4)
    expect(list).toHaveClass("max-h-54", "overflow-y-auto")
    expect(list).not.toContainElement(screen.getByText(/Already confirmed earlier/))
    expect(list).not.toContainElement(screen.getByTestId("summary-total"))
  })
})

describe("TimeEntrySummaryDialog reject view", () => {
  const entries = [
    item(),
    item({ id: "e2", type: "solo", hours: 0, minutes: 45 }),
    item({ id: "e3", reviewStatus: "accepted", hours: 2, minutes: 0 }),
  ]

  it("asks for an explanation and blocks Submit until there is one", () => {
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />)
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))

    expect(screen.getByRole("heading", { name: "Logged time rejected" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Confirm the logged time" })).not.toBeInTheDocument()
    expect(
      screen.getByText(
        "You have rejected the time logged. Please explain why you are rejecting the logged time. Your explanation will be shared with your helper(s) in the ticket chat, so you together can coordinate what the logged time should be.",
      ),
    ).toBeInTheDocument()
    // The summary's own actions are out of the way.
    expect(screen.queryByRole("button", { name: "Confirm logged time" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reject logged time" })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Logged time to confirm" })).not.toBeInTheDocument()

    const explanation = screen.getByRole("textbox", { name: "Your explanation" })
    expect(explanation).toHaveAttribute("rows", "5")
    expect(explanation).toHaveAttribute("maxlength", String(DECLINE_REASON_MAX_LENGTH))
    expect(explanation).toHaveClass("resize-none")
    expect(explanation).toHaveFocus()

    const submit = screen.getByRole("button", { name: "Submit" })
    expect(submit).toBeDisabled()
    fireEvent.change(explanation, { target: { value: "   " } })
    expect(submit).toBeDisabled()
    fireEvent.change(explanation, { target: { value: "We agreed on one hour." } })
    expect(submit).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  it("returns to the summary on Cancel with the per-entry declines kept", () => {
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[0])
    fireEvent.change(screen.getByLabelText("Why are you declining this time?"), { target: { value: "Only 20 minutes" } })

    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.getByRole("heading", { name: "Confirm the logged time" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Your explanation" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Why are you declining this time?" })).toHaveValue("Only 20 minutes")
    expect(screen.getByRole("button", { name: "Confirm 1 and decline 1" })).toBeEnabled()
    expect(screen.getByTestId("summary-total")).toHaveTextContent("02:45 h")
  })

  it("declines every pending entry with the trimmed explanation on Submit", async () => {
    const onConfirm = vi.fn()
    render(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={onConfirm} entries={entries} />)
    // A per-entry draft is ignored: the rejection covers everything that is pending.
    fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Your explanation" }), {
      target: { value: "  We agreed on one hour.\nNot three.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith([
        { entryId: "e1", reason: "We agreed on one hour.\nNot three." },
        { entryId: "e2", reason: "We agreed on one hour.\nNot three." },
      ]),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("shows the spinner on Submit and locks the view while the rejection is being saved", () => {
    const { rerender } = render(
      <TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Your explanation" }), { target: { value: "Too much" } })
    rerender(<TimeEntrySummaryDialog open pending onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />)

    const submit = screen.getByRole("button", { name: "Submit" })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toBeDisabled()
  })

  it("starts on the summary again after the dialog was closed", () => {
    const { rerender } = render(
      <TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Your explanation" }), { target: { value: "Too much" } })
    rerender(<TimeEntrySummaryDialog open={false} onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />)
    rerender(<TimeEntrySummaryDialog open onOpenChange={() => {}} onConfirm={() => {}} entries={entries} />)

    expect(screen.getByRole("heading", { name: "Confirm the logged time" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Your explanation" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reject logged time" }))
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toHaveValue("")
  })
})

describe("formatSummaryDate", () => {
  it("renders YYYY-MM-DD as dd.mm.yyyy and leaves other strings alone", () => {
    expect(formatSummaryDate("2026-10-08")).toBe("08.10.2026")
    expect(formatSummaryDate("08.10.2026")).toBe("08.10.2026")
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
    expect(screen.getByRole("status")).toHaveTextContent("Grace has rejected the logged time")
    expect(screen.getByRole("status")).toHaveTextContent("See the explanation for the rejection in the chat.")
    rerender(<TimeEntryRejectedBanner className="mx-0" />)
    expect(screen.getByRole("status")).toHaveTextContent("The user has rejected the logged time")
    expect(screen.getByRole("status")).toHaveClass("mx-0")
  })
})

describe("TimeReviewSystemMessage", () => {
  const confirmedMetadata = (overrides: Record<string, unknown> = {}) => ({
    kind: "time_entries_confirmed",
    reviewer_name: "Grace",
    auto: false,
    accepted_count: 0,
    declined: [
      { entry_id: "e1", reason: "We agreed on one hour.\nNot three." },
      { entry_id: "e2", reason: "We agreed on one hour.\nNot three." },
    ],
    ...overrides,
  })

  it("shows who rejected the logged time and quotes the explanation", () => {
    render(
      <TimeReviewSystemMessage
        content="**Grace reviewed the logged time** and did not confirm any of it."
        metadata={confirmedMetadata()}
      />,
    )
    const title = screen.getByText("Grace rejected the logged time")
    expect(title).toHaveClass("font-medium")
    const quote = screen.getByText(/We agreed on one hour\./)
    expect(quote).toHaveTextContent("We agreed on one hour. Not three.")
    expect(quote).toHaveClass("border-l-2", "pl-3", "whitespace-pre-wrap")
    // The message's own wording is replaced, and a rejection carries no badge.
    expect(screen.queryByText(/did not confirm any of it/)).not.toBeInTheDocument()
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument()
  })

  it("renders the message text with a Confirmed badge for a manual confirmation", () => {
    render(
      <TimeReviewSystemMessage
        content="**Grace confirmed 1h 30min of logged time** (1 entry)."
        metadata={confirmedMetadata({ accepted_count: 1, declined: [] })}
      />,
    )
    expect(screen.getByText("Grace confirmed 1h 30min of logged time")).toBeInTheDocument()
    const badge = screen.getByText("Confirmed")
    expect(badge).toHaveAttribute("data-status", "accepted")
    expect(badge.parentElement).toHaveClass("mt-2", "flex", "justify-start")
  })

  it("renders only the message text for an automatic confirmation or per-entry declines", () => {
    const { rerender } = render(
      <TimeReviewSystemMessage
        content="**1h 30min of logged time was confirmed automatically** (1 entry)."
        metadata={confirmedMetadata({ auto: true, accepted_count: 1, declined: [], reviewer_name: null })}
      />,
    )
    expect(screen.getByText("1h 30min of logged time was confirmed automatically")).toBeInTheDocument()
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument()

    // Declined for different reasons: not a rejection of the summary, so the text stays.
    rerender(
      <TimeReviewSystemMessage
        content="**Grace reviewed the logged time** and did not confirm any of it."
        metadata={confirmedMetadata({
          declined: [
            { entry_id: "e1", reason: "Too much" },
            { entry_id: "e2", reason: "Not agreed" },
          ],
        })}
      />,
    )
    expect(screen.getByText(/did not confirm any of it/)).toBeInTheDocument()
    expect(screen.queryByText("Grace rejected the logged time")).not.toBeInTheDocument()
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument()
  })
})
