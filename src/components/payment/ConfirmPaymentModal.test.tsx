import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(async () => null) }))

import { ConfirmPaymentModal } from "./ConfirmPaymentModal"

function renderModal() {
  const onCancel = vi.fn()
  const onResolved = vi.fn()
  render(<ConfirmPaymentModal clientSecret="pi_secret" mode="test" onResolved={onResolved} onCancel={onCancel} />)
  return { onCancel, onResolved }
}

describe("ConfirmPaymentModal", () => {
  it("only dismisses through the Cancel button, not Escape or a tap outside", () => {
    const { onCancel } = renderModal()
    const dialog = screen.getByRole("dialog", { name: /confirm the hold on your card/i })

    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onCancel).not.toHaveBeenCalled()

    const backdrop = document.querySelector("[data-slot='dialog-overlay']")
    expect(backdrop).not.toBeNull()
    fireEvent.pointerDown(backdrop!)
    fireEvent.click(backdrop!)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
