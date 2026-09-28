import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const mutateAsync = vi.fn()
vi.mock("@/hooks/useApiAccess", () => ({
  useTicketCompletion: () => ({ mutateAsync, isPending: false }),
  formatUsd: (c: number | null | undefined) => `$${((c ?? 0) / 100).toFixed(2)}`,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { CompletionBanner, type CompletionTicket } from "./completion-banner"

const base: CompletionTicket = {
  id: "t1",
  status: "claimed",
  created_by: "cust",
  pricing_mode: "fixed_answer",
  fixed_price_smallest_unit: 2500,
  completion_proposed_by: null,
}

beforeEach(() => mutateAsync.mockReset().mockResolvedValue({}))

describe("CompletionBanner", () => {
  it("lets the customer accept an agent's proposal and pay its price", async () => {
    render(
      <CompletionBanner
        ticket={{ ...base, completion_proposed_by: "agent", completion_summary: "Upgrade to 2.1" }}
        currentUserId="cust"
        role="customer"
        paymentStatus="authorized"
      />,
    )
    expect(screen.getByText("The AI agent says this ticket is resolved.")).toBeInTheDocument()
    expect(screen.getByText("Upgrade to 2.1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Accept answer & pay $25.00" }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ action: "respond", ticket_id: "t1", accept: true }),
    )
  })

  it("requires a reason to decline", async () => {
    render(<CompletionBanner ticket={{ ...base, completion_proposed_by: "agent" }} currentUserId="cust" role="customer" />)
    fireEvent.click(screen.getByRole("button", { name: "Not resolved yet" }))
    const submit = screen.getByRole("button", { name: "Decline" })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("What is still not working?"), { target: { value: "Still fails" } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ action: "respond", ticket_id: "t1", accept: false, reason: "Still fails" }),
    )
  })

  it("offers resolve and escalate on an agent ticket without a proposal", async () => {
    render(<CompletionBanner ticket={base} currentUserId="cust" role="customer" />)
    fireEvent.click(screen.getByRole("button", { name: /Ask for a human instead/ }))
    fireEvent.click(screen.getByRole("button", { name: "Ask for a human" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ action: "escalate", ticket_id: "t1", reason: undefined }))
  })

  it("leaves time-based tickets to the End session flow for customers", () => {
    const { container } = render(
      <CompletionBanner ticket={{ ...base, pricing_mode: "time" }} currentUserId="cust" role="customer" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the waiting state to the side that proposed", () => {
    render(
      <CompletionBanner
        ticket={{ ...base, pricing_mode: "time", completion_proposed_by: "helper-1" }}
        currentUserId="helper-1"
        role="helper"
      />,
    )
    expect(screen.getByText("Waiting for the customer to confirm the ticket is resolved.")).toBeInTheDocument()
  })

  it("keeps a paid agent answer from being accepted before the card hold exists", () => {
    render(
      <CompletionBanner
        ticket={{ ...base, completion_proposed_by: "agent" }}
        currentUserId="cust"
        role="customer"
        paymentStatus="none"
      />,
    )
    expect(screen.getByRole("button", { name: "Accept answer & pay $25.00" })).toBeDisabled()
    expect(screen.getByText(/Add a payment method first/)).toBeInTheDocument()
  })

  it("gates accepting a helper's proposal on a time ticket until payment is secured", () => {
    const ticket = { ...base, pricing_mode: "time" as const, completion_proposed_by: "helper-1" }
    const { rerender } = render(
      <CompletionBanner ticket={ticket} currentUserId="cust" role="customer" paymentStatus="requires_action" />,
    )
    expect(screen.getByRole("button", { name: "Accept & complete" })).toBeDisabled()
    rerender(<CompletionBanner ticket={ticket} currentUserId="cust" role="customer" paymentStatus="authorized" />)
    expect(screen.getByRole("button", { name: "Accept & complete" })).toBeEnabled()
  })

  it("lets the proposer withdraw their proposal", async () => {
    render(
      <CompletionBanner
        ticket={{ ...base, pricing_mode: "time", completion_proposed_by: "helper-1" }}
        currentUserId="helper-1"
        role="helper"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ action: "withdraw", ticket_id: "t1" }))
  })

  it("gives human helpers no handshake controls on an AI agent's ticket", () => {
    const { container } = render(
      <CompletionBanner ticket={{ ...base, completion_proposed_by: "cust" }} currentUserId="admin-1" role="helper" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing once the ticket is closed", () => {
    const { container } = render(
      <CompletionBanner ticket={{ ...base, status: "completed" }} currentUserId="cust" role="customer" />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
