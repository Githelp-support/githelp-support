import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ClaimTicketButton,
  GUEST_CLAIM_BLOCKED_COPY,
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
} from "@/lib/customer-chat-messages"

describe("ClaimTicketButton", () => {
  it("is disabled on a guest ticket and explains why in a tooltip", async () => {
    const onClaim = vi.fn()
    render(
      <TooltipProvider delayDuration={0}>
        <ClaimTicketButton isGuest onClaim={onClaim} />
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
