import type { ReactNode } from "react"
import { describe, it, expect, vi, beforeAll } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/hooks/useTicketAttachments", () => ({
  useTicketAttachmentUpload: () => ({ uploadFiles: vi.fn(), isUploading: false }),
}))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title, inlineRightContent, actions }: { title: string; inlineRightContent?: ReactNode; actions?: ReactNode }) => (
    <header data-testid="header">
      <h1>{title}</h1>
      {inlineRightContent}
      {actions}
    </header>
  ),
}))

import { TicketChat, type TicketChatMessage, type TicketChatProps } from "./ticket-chat"

beforeAll(() => {
  // jsdom has no layout: the thread's scroll-to-bottom is a no-op here.
  Element.prototype.scrollIntoView = vi.fn()
})

/** Local time, so the grouping and day checks do not depend on the runner's timezone. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).toISOString()

const message = (overrides: Partial<TicketChatMessage> & Pick<TicketChatMessage, "id">): TicketChatMessage => ({
  senderType: "user",
  senderName: "Patrick",
  senderId: "user-1",
  timestamp: "",
  content: "",
  ...overrides,
})

const renderChat = (overrides: Partial<TicketChatProps> = {}) =>
  render(
    <TicketChat
      headerTitle="Ticket with Acme"
      messages={[]}
      message=""
      onMessageChange={vi.fn()}
      onSend={vi.fn()}
      {...overrides}
    />,
  )

describe("TicketChat thread", () => {
  it("shows one name, time and avatar for a run of messages from the same sender", () => {
    const { container } = renderChat({
      messages: [
        message({ id: "m1", content: "First question", createdAt: at(15, 10, 17) }),
        message({ id: "m2", content: "And a detail", createdAt: at(15, 10, 18) }),
        message({ id: "m3", content: "Much later", createdAt: at(15, 11, 30) }),
      ],
    })
    // m1 and m2 group; m3 is more than five minutes later and starts a new group.
    expect(screen.getAllByText("Patrick")).toHaveLength(2)
    expect(screen.getAllByText("Patrick")[0]).toHaveClass("text-sm", "font-semibold")
    expect(screen.getByText("10:17")).toBeInTheDocument()
    expect(screen.queryByText("10:18")).not.toBeInTheDocument()
    expect(screen.getByText("11:30")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="chat-avatar-spacer"]')).toHaveLength(1)
    // All three messages are still there.
    expect(screen.getByText("First question")).toBeInTheDocument()
    expect(screen.getByText("And a detail")).toBeInTheDocument()
    expect(screen.getByText("Much later")).toBeInTheDocument()
  })

  it("puts a day divider above the thread and between days, and shows the time only", () => {
    renderChat({
      intro: <div>Intro</div>,
      messages: [
        message({ id: "m1", content: "Sunday message", createdAt: at(15, 10, 17), timestamp: "15.11.2026, 10:17" }),
        message({ id: "m2", content: "Monday message", createdAt: at(16, 9, 5), timestamp: "16.11.2026, 09:05" }),
      ],
    })
    const dividers = screen.getAllByRole("separator")
    expect(dividers.map((d) => d.getAttribute("aria-label"))).toEqual(["Sunday 15 November", "Monday 16 November"])
    // The first divider sits above the intro, the second between the two messages.
    const position = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(position(dividers[0], screen.getByText("Intro"))).toBeTruthy()
    expect(position(screen.getByText("Sunday message"), dividers[1])).toBeTruthy()
    expect(position(dividers[1], screen.getByText("Monday message"))).toBeTruthy()
    expect(screen.getByText("09:05")).toBeInTheDocument()
    expect(screen.queryByText(/16\.11\.2026/)).not.toBeInTheDocument()
  })

  it("dates an empty thread with today", () => {
    renderChat({ intro: <div>Intro</div> })
    expect(screen.getByRole("separator")).toHaveAttribute("aria-label", "Today")
  })

  it("renders a system message as a 'Note · …' line without a bubble", () => {
    const { container } = renderChat({
      messages: [
        message({
          id: "welcome",
          senderType: "system",
          senderName: "Acme Team",
          senderId: null,
          content: "You are not charged anything yet.",
        }),
      ],
    })
    const note = container.querySelector('[data-slot="chat-system-note"]') as HTMLElement
    expect(note).not.toBeNull()
    expect(note).toHaveTextContent("Note · You are not charged anything yet.")
    expect(container.querySelector(".bg-muted.ml-11")).toBeNull()
    // No sender line on a note.
    expect(screen.queryByText("Acme Team")).not.toBeInTheDocument()
  })

  it("keeps the payment CTA on a payment_required note and the coloured bubble for other kinds", () => {
    const onPaymentCtaClick = vi.fn()
    const { container } = renderChat({
      onPaymentCtaClick,
      messages: [
        message({
          id: "s1",
          senderType: "system",
          senderId: null,
          content: "Add a payment method to continue.",
          paymentMetadata: { kind: "payment_required", hold_amount_smallest_unit: 3000 },
        }),
        message({
          id: "s2",
          senderType: "system",
          senderId: null,
          content: "Payment failed.",
          paymentMetadata: { kind: "payment_failed" },
        }),
      ],
    })
    const notes = container.querySelectorAll('[data-slot="chat-system-note"]')
    expect(notes).toHaveLength(1)
    const note = notes[0] as HTMLElement
    fireEvent.click(within(note).getByRole("button", { name: "Add payment method" }))
    expect(onPaymentCtaClick).toHaveBeenCalledTimes(1)
    expect(note).toHaveTextContent("temporary hold of $30.00")
    expect(screen.getByText("Payment failed.").closest(".bg-red-50")).not.toBeNull()
  })
})

describe("TicketChat header", () => {
  it("shows End session in the header only when onRequestEndSession is set", () => {
    const { unmount } = renderChat()
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
    unmount()

    renderChat({ onRequestEndSession: vi.fn() })
    const button = within(screen.getByTestId("header")).getByRole("button", { name: "End session" })
    expect(screen.getAllByRole("button", { name: "End session" })).toHaveLength(1)
    fireEvent.click(button)
    // It opens the confirmation dialog; it does not end the session itself.
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("hides End session once the ticket has ended or the request is pending with the helper", () => {
    const { unmount } = renderChat({ onRequestEndSession: vi.fn(), isEnded: true })
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
    unmount()
    renderChat({ onRequestEndSession: vi.fn(), endSessionRequestedAt: at(15, 10, 0) })
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })

  it("shows the ticket id pill and the composer placeholder", () => {
    renderChat({ ticketId: "b435097a-1c2d-4e5f-8a9b-0c1d2e3f4a5b", composerPlaceholder: "Ask #acme" })
    expect(within(screen.getByTestId("header")).getByText("b435097a..")).toBeInTheDocument()
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Ask #acme")).toBeInTheDocument()
  })
})

describe("TicketChat right panel", () => {
  const you = { id: "user-1", name: "Patrick", avatarInitial: "P", isCurrentUser: true }

  it("says when no helper has joined and when there are no other topics", () => {
    renderChat({ participants: [you], hasHelper: false })
    expect(screen.getByText("You")).toBeInTheDocument()
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
    expect(screen.getByText("No other topics yet.")).toBeInTheDocument()
  })

  it("shows the note instead of a dash for an empty list, and nothing while loading", () => {
    const { unmount } = renderChat({ participants: [] })
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
    expect(screen.queryByText("-")).not.toBeInTheDocument()
    unmount()
    renderChat({ participantsLoading: true })
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
  })

  it("drops both notes once a helper has joined and topics exist", () => {
    renderChat({
      participants: [you, { id: "helper-1", name: "Grace", avatarInitial: "G" }],
      hasHelper: true,
      topics: ["Billing"],
    })
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
    expect(screen.queryByText("No other topics yet.")).not.toBeInTheDocument()
    expect(screen.getByText("Billing")).toBeInTheDocument()
  })
})
