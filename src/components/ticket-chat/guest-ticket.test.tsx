import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ClaimTicketButton,
  EndAbandonedGuestTicketButton,
  GUEST_ABANDONED_END_COPY,
  GUEST_CLAIM_BLOCKED_COPY,
  endAbandonedGuestTicketErrorMessage,
  GuestTicketBadge,
  VisitorLeftAction,
  ticketCreatorDisplayName,
} from "./guest-ticket"
import {
  GUEST_SIGNED_IN_CUSTOMER_COPY,
  GUEST_SIGNED_IN_HELPER_COPY,
  VISITOR_LEFT_CUSTOMER_COPY,
  VISITOR_LEFT_HELPER_COPY,
  buildCustomerThreadMessages,
  guestSystemMessageCopy,
  hasVisitorLeft,
  isGuestAbandoned,
} from "@/lib/customer-chat-messages"

describe("ClaimTicketButton", () => {
  it("is disabled on a guest ticket and explains why in a tooltip", async () => {
    const onClaim = vi.fn()
    render(
      <TooltipProvider delayDuration={0}>
        <ClaimTicketButton isGuest showExplanation={false} onClaim={onClaim} />
      </TooltipProvider>,
    )
    const button = screen.getByRole("button", { name: "Claim ticket" })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute("title")
    fireEvent.click(button)
    expect(onClaim).not.toHaveBeenCalled()

    // The copy only appears once the trigger is hovered or focused.
    expect(screen.queryByText(GUEST_CLAIM_BLOCKED_COPY)).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    // The wrapper is the focusable tooltip trigger, so keyboard users get the reason too.
    const trigger = button.parentElement as HTMLElement
    expect(trigger).toHaveAttribute("tabindex", "0")
    fireEvent.pointerMove(trigger)
    fireEvent.focus(trigger)
    const tooltip = await screen.findByRole("tooltip")
    expect(tooltip).toHaveTextContent(GUEST_CLAIM_BLOCKED_COPY)
    expect((await screen.findAllByText(GUEST_CLAIM_BLOCKED_COPY)).length).toBeGreaterThanOrEqual(1)
  })

  it("also shows the explanation under the button by default", () => {
    render(
      <TooltipProvider>
        <ClaimTicketButton isGuest onClaim={vi.fn()} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: "Claim ticket" })).toBeDisabled()
    // The notice sits in its own tinted box, with the exact copy.
    const notice = screen.getByText(GUEST_CLAIM_BLOCKED_COPY)
    expect(notice).toHaveAttribute("data-slot", "guest-claim-explanation")
    expect(notice).toHaveClass("bg-bg-subtle", "rounded-md")
    expect(notice).toHaveTextContent("The user needs to sign in before this ticket can be claimed. You can still reply.")
  })

  it("becomes available once the ticket is no longer a guest ticket", () => {
    const onClaim = vi.fn()
    const { rerender } = render(
      <TooltipProvider>
        <ClaimTicketButton isGuest onClaim={onClaim} />
      </TooltipProvider>,
    )
    rerender(
      <TooltipProvider>
        <ClaimTicketButton isGuest={false} onClaim={onClaim} />
      </TooltipProvider>,
    )
    const button = screen.getByRole("button", { name: "Claim ticket" })
    expect(button).toBeEnabled()
    // No tooltip trigger wraps the enabled button, and the copy is gone.
    expect(button.parentElement).not.toHaveAttribute("tabindex")
    expect(button.parentElement).not.toHaveAttribute("data-state")
    expect(screen.queryByText(GUEST_CLAIM_BLOCKED_COPY)).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(onClaim).toHaveBeenCalledTimes(1)
  })

  it("shows the pending label", () => {
    render(
      <TooltipProvider>
        <ClaimTicketButton isGuest={false} pending onClaim={vi.fn()} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: "Claiming…" })).toBeDisabled()
  })
})

describe("EndAbandonedGuestTicketButton", () => {
  it("ends the ticket on click and explains why under the button", () => {
    const onEnd = vi.fn()
    render(<EndAbandonedGuestTicketButton onEnd={onEnd} />)
    const button = screen.getByRole("button", { name: "End ticket" })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute("aria-busy")
    const explanation = screen.getByText(GUEST_ABANDONED_END_COPY)
    expect(explanation).toHaveTextContent("The guest has left. End the ticket to keep a record of the support given.")
    expect(explanation).toHaveClass("text-ui", "text-text-muted")
    expect(button).toHaveAttribute("aria-describedby", explanation.id)
    fireEvent.click(button)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("shows only the button without the explanation (header)", () => {
    render(<EndAbandonedGuestTicketButton onEnd={vi.fn()} showExplanation={false} />)
    const button = screen.getByRole("button", { name: "End ticket" })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByText(GUEST_ABANDONED_END_COPY)).not.toBeInTheDocument()
  })

  it("is busy and not clickable while the request is pending, keeping its label", () => {
    const onEnd = vi.fn()
    render(<EndAbandonedGuestTicketButton pending onEnd={onEnd} />)
    const button = screen.getByRole("button", { name: "End ticket" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull()
    fireEvent.click(button)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it("disappears when the guest returns or the ticket ends (page condition)", () => {
    const system = (id: string, kind: string) => ({ id, sender_type: "system", metadata: { kind } })
    const Harness = ({ messages, status }: { messages: ReturnType<typeof system>[]; status: string }) =>
      isGuestAbandoned(messages, status) ? <EndAbandonedGuestTicketButton onEnd={vi.fn()} /> : null

    const abandoned = [system("s1", "guest_abandoned")]
    const { rerender } = render(<Harness messages={abandoned} status="available" />)
    expect(screen.getByRole("button", { name: "End ticket" })).toBeInTheDocument()

    // A realtime guest_returned message removes it.
    rerender(<Harness messages={[...abandoned, system("s2", "guest_returned")]} status="available" />)
    expect(screen.queryByRole("button", { name: "End ticket" })).not.toBeInTheDocument()
    expect(screen.queryByText(GUEST_ABANDONED_END_COPY)).not.toBeInTheDocument()

    // So does the ticket being ended.
    rerender(<Harness messages={abandoned} status="completed" />)
    expect(screen.queryByRole("button", { name: "End ticket" })).not.toBeInTheDocument()
  })

  it("maps the RPC error hints to helper-facing copy", () => {
    expect(endAbandonedGuestTicketErrorMessage({ hint: "guest_ticket_not_abandoned" })).toBe("The guest is back in the chat.")
    expect(endAbandonedGuestTicketErrorMessage({ hint: "ticket_closed" })).toBe("This ticket is already closed.")
    expect(endAbandonedGuestTicketErrorMessage({ hint: "guest_ticket_not_found" })).toBe("Ticket not found.")
    expect(endAbandonedGuestTicketErrorMessage({ hint: "something_else" })).toBeNull()
    expect(endAbandonedGuestTicketErrorMessage(new Error("network"))).toBeNull()
    expect(endAbandonedGuestTicketErrorMessage(null)).toBeNull()
  })
})

describe("guest ticket labels", () => {
  it("renders the guest badge", () => {
    render(<GuestTicketBadge />)
    expect(screen.getByText("Guest — not signed in")).toBeInTheDocument()
  })

  it("shows guests as Guest", () => {
    expect(ticketCreatorDisplayName("Ada", true)).toBe("Guest")
    expect(ticketCreatorDisplayName("Ada", false)).toBe("Ada")
    expect(ticketCreatorDisplayName(null, false)).toBe("User")
    expect(ticketCreatorDisplayName("  ", false, "Unknown")).toBe("Unknown")
  })
})

describe("guest system messages", () => {
  const base = {
    projectName: "Acme",
    projectLogo: null,
    nowFormatted: "29/10/2026, 10:00",
    currentUser: { id: "guest-1", name: "Guest" },
  }
  const persisted = (id: string, kind: string, content = "stored text") => ({
    id,
    content,
    created_at: "2026-10-29T10:00:00.000Z",
    sender_type: "system",
    sender_id: null,
    metadata: { kind },
  })

  it("uses side-specific copy for the two guest kinds", () => {
    expect(guestSystemMessageCopy("visitor_left", "customer")).toBe(VISITOR_LEFT_CUSTOMER_COPY)
    expect(guestSystemMessageCopy("visitor_left", "helper")).toBe(VISITOR_LEFT_HELPER_COPY)
    expect(guestSystemMessageCopy("guest_signed_in", "helper")).toBe(GUEST_SIGNED_IN_HELPER_COPY)
    expect(guestSystemMessageCopy("guest_signed_in", "customer")).toBe(GUEST_SIGNED_IN_CUSTOMER_COPY)
    expect(guestSystemMessageCopy("payment_required", "customer")).toBeNull()
    expect(VISITOR_LEFT_HELPER_COPY).toBe("The visitor left before signing in.")
    expect(GUEST_SIGNED_IN_HELPER_COPY).toBe("The visitor signed in — you can claim this ticket now.")
  })

  it("renders visitor_left and guest_signed_in in the customer thread", () => {
    const list = buildCustomerThreadMessages({
      ...base,
      ticketStatus: "cancelled",
      messagesData: [persisted("m2", "guest_signed_in"), persisted("m3", "time_logged", "Logged 5m"), persisted("m1", "visitor_left")],
    })
    const byId = Object.fromEntries(list.map((m) => [m.id, m]))
    expect(byId.m1.content).toBe(VISITOR_LEFT_CUSTOMER_COPY)
    expect(byId.m1.paymentMetadata?.kind).toBe("visitor_left")
    expect(byId.m2.content).toBe(GUEST_SIGNED_IN_CUSTOMER_COPY)
    expect(byId.m3.content).toBe("Logged 5m")
  })

  it("does not rewrite user messages that carry a kind", () => {
    const list = buildCustomerThreadMessages({
      ...base,
      messagesData: [{ ...persisted("u1", "visitor_left", "hello"), sender_type: "user", sender_id: "guest-1" }],
    })
    expect(list.find((m) => m.id === "u1")?.content).toBe("hello")
  })

  it("hides the visitor_left notice once the ticket was reopened", () => {
    const messagesData = [persisted("m1", "visitor_left"), persisted("m2", "guest_signed_in")]
    for (const ticketStatus of ["available", "claimed", "completed", null]) {
      const list = buildCustomerThreadMessages({ ...base, ticketStatus, messagesData })
      expect(list.find((m) => m.id === "m1")).toBeUndefined()
      expect(list.find((m) => m.id === "m2")?.content).toBe(GUEST_SIGNED_IN_CUSTOMER_COPY)
    }
  })

  it("detects a visitor_left closure only while the ticket is cancelled", () => {
    expect(hasVisitorLeft([persisted("m1", "visitor_left")], "cancelled")).toBe(true)
    // Reopened by adoption, then ended normally: the summary must show.
    expect(hasVisitorLeft([persisted("m1", "visitor_left")], "completed")).toBe(false)
    expect(hasVisitorLeft([persisted("m1", "visitor_left")], "available")).toBe(false)
    expect(hasVisitorLeft([persisted("m1", "payment_required")], "cancelled")).toBe(false)
    expect(hasVisitorLeft(undefined, "cancelled")).toBe(false)
  })

  it("a reopened ticket that is cancelled again (e.g. spam) doesn't resurrect the old notice", () => {
    const messagesData = [persisted("m1", "visitor_left"), persisted("m2", "guest_signed_in")]
    expect(hasVisitorLeft(messagesData, "cancelled")).toBe(false)
    const list = buildCustomerThreadMessages({ ...base, ticketStatus: "cancelled", messagesData })
    expect(list.find((m) => m.id === "m1")).toBeUndefined()
  })

  it("offers to start a new conversation", () => {
    const onStart = vi.fn()
    render(<VisitorLeftAction onStartNewConversation={onStart} />)
    fireEvent.click(screen.getByRole("button", { name: "Start a new conversation" }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
