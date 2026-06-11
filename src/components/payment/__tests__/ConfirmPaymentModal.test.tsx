import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const confirmCardPayment = vi.fn()
vi.mock("@/lib/stripe", () => ({
  getStripe: () =>
    Promise.resolve({ confirmCardPayment }),
}))

import { ConfirmPaymentModal } from "../ConfirmPaymentModal"

describe("ConfirmPaymentModal", () => {
  beforeEach(() => {
    confirmCardPayment.mockReset()
  })

  it("calls stripe.confirmCardPayment with the client secret on click", async () => {
    confirmCardPayment.mockResolvedValueOnce({
      paymentIntent: { status: "requires_capture" },
    })
    const onResolved = vi.fn()
    render(
      <ConfirmPaymentModal
        clientSecret="pi_1_secret_x"
        onResolved={onResolved}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /confirm payment/i }))
    await waitFor(() => expect(confirmCardPayment).toHaveBeenCalledWith("pi_1_secret_x"))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("authorized"))
  })

  it("reports failure when Stripe returns an error", async () => {
    confirmCardPayment.mockResolvedValueOnce({
      error: { message: "Your card was declined." },
    })
    const onResolved = vi.fn()
    render(
      <ConfirmPaymentModal
        clientSecret="pi_2_secret_y"
        onResolved={onResolved}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /confirm payment/i }))
    await waitFor(() =>
      expect(screen.getByText(/your card was declined/i)).toBeInTheDocument(),
    )
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("calls onCancel when the user clicks cancel", () => {
    const onCancel = vi.fn()
    render(
      <ConfirmPaymentModal
        clientSecret="pi_3_secret_z"
        onResolved={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
