import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePaymentTransfers = vi.fn()
vi.mock("@/hooks/usePayments", () => ({
  usePaymentTransfers: (filters?: unknown) => usePaymentTransfers(filters),
}))

import { TicketEndedSummary } from "./ticket-ended-summary"

// Charged $50.00 split as in the payout reports: helper $33.50, project $14.85,
// platform $0 — the remaining $1.65 is the derived Stripe fee (2.9% + $0.30).
const settledTransfers = [
  { transfer_user_type: "helper", amount_smallest_unit: 3350, status: "completed" },
  { transfer_user_type: "project", amount_smallest_unit: 1485, status: "completed" },
]

const baseProps = {
  ticketId: "t1",
  isCancelledEnd: false,
  isFreeSupport: false,
  chargedSmallestUnit: 5000,
  paymentSettled: true,
  paymentProcessing: false,
  paymentFailed: false,
  paymentFailureReason: null,
  timeLoggedFormatted: "01:30 h",
  onRetryPayment: vi.fn(),
  isRetryingPayment: false,
}

describe("TicketEndedSummary breakdown", () => {
  beforeEach(() => {
    usePaymentTransfers.mockReset()
    usePaymentTransfers.mockReturnValue({ data: settledTransfers, isLoading: false })
  })

  it("renders Charged with the three sub-rows when payment settled and transfers exist", () => {
    render(<TicketEndedSummary {...baseProps} />)
    expect(screen.getByText("Charged")).toBeInTheDocument()
    expect(screen.getByText("$50.00")).toBeInTheDocument()
    expect(screen.getByText("Share helper")).toBeInTheDocument()
    expect(screen.getByText("Share project")).toBeInTheDocument()
    expect(screen.getByText("Stripe fee")).toBeInTheDocument()
  })

  it("sub-row amounts sum to the charged amount", () => {
    render(<TicketEndedSummary {...baseProps} />)
    expect(screen.getByText("$33.50")).toBeInTheDocument()
    expect(screen.getByText("$14.85")).toBeInTheDocument()
    expect(screen.getByText("$1.65")).toBeInTheDocument()
    // $33.50 + $14.85 + $1.65 === $50.00 charged
    const sum = ["$33.50", "$14.85", "$1.65"]
      .map((label) => Number(screen.getByText(label).textContent!.replace("$", "")))
      .reduce((acc, n) => acc + n, 0)
    expect(Math.round(sum * 100)).toBe(baseProps.chargedSmallestUnit)
  })

  it("hides sub-rows for a cancelled (No charge) end", () => {
    render(
      <TicketEndedSummary
        {...baseProps}
        isCancelledEnd
        paymentSettled={false}
        chargedSmallestUnit={null}
      />,
    )
    expect(screen.getByText("No charge")).toBeInTheDocument()
    expect(screen.getByText("Not able to help")).toBeInTheDocument()
    expect(screen.queryByText("Share helper")).not.toBeInTheDocument()
    expect(screen.queryByText("Share project")).not.toBeInTheDocument()
    expect(screen.queryByText("Stripe fee")).not.toBeInTheDocument()
    // The transfers query stays disabled — no pre-capture rows get cached.
    expect(usePaymentTransfers).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it("hides sub-rows for a free-support end", () => {
    render(
      <TicketEndedSummary
        {...baseProps}
        isFreeSupport
        paymentSettled={false}
        chargedSmallestUnit={null}
      />,
    )
    expect(screen.getByText("Free support")).toBeInTheDocument()
    expect(screen.queryByText("Share helper")).not.toBeInTheDocument()
    expect(screen.queryByText("Share project")).not.toBeInTheDocument()
    expect(screen.queryByText("Stripe fee")).not.toBeInTheDocument()
  })

  it("shows em-dash placeholders while transfers are loading", () => {
    usePaymentTransfers.mockReturnValue({ data: undefined, isLoading: true })
    render(<TicketEndedSummary {...baseProps} />)
    // Sub-row labels stay visible with "—" amounts until rows arrive.
    expect(screen.getByText("Share helper")).toBeInTheDocument()
    expect(screen.getByText("Share project")).toBeInTheDocument()
    expect(screen.getByText("Stripe fee")).toBeInTheDocument()
    expect(screen.getAllByText("—")).toHaveLength(3)
    expect(screen.queryByText("$33.50")).not.toBeInTheDocument()
  })
})
