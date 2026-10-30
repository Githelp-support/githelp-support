import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { SLAConfirmationModal } from "./sla-confirmation-modal"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SLA_CREATION_UNAVAILABLE_TOOLTIP } from "@/lib/constants"

// Radix Tooltip positions its content with Popper, which relies on
// ResizeObserver — jsdom does not implement it.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = vi.fn()
  }
})

function renderModal(overrides: Partial<React.ComponentProps<typeof SLAConfirmationModal>> = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  // The app mounts one TooltipProvider in the root layout; mirror it here.
  const utils = render(
    <TooltipProvider>
      <SLAConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        slaId="sla_123"
        {...overrides}
      />
    </TooltipProvider>,
  )
  return { ...utils, onClose, onConfirm }
}

describe("SLAConfirmationModal", () => {
  it("does not call onConfirm or onClose when 'Confirm creation' is clicked", () => {
    const { onClose, onConfirm } = renderModal()

    fireEvent.click(screen.getByRole("button", { name: /confirm creation/i }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("shows the 'not available yet' tooltip after clicking 'Confirm creation'", async () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: /confirm creation/i }))

    // Radix may render the tooltip content twice (visible + visually hidden for a11y).
    const matches = await screen.findAllByText(SLA_CREATION_UNAVAILABLE_TOOLTIP)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0]).toBeInTheDocument()
    expect(SLA_CREATION_UNAVAILABLE_TOOLTIP).toBe(
      "Creating SLAs is not available yet. This setup flow is shown for illustration only.",
    )
  })

  it("calls onClose when 'Cancel' is clicked", () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("has no header close button and clicking the backdrop does not call onClose", () => {
    const { container, onClose } = renderModal()

    // No X / close button anywhere in the modal.
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument()
    // The header row (containing the title) has no buttons at all.
    const header = screen.getByRole("heading", { name: /confirming new sla/i }).parentElement
    expect(header).not.toBeNull()
    expect(header!.querySelector("button")).toBeNull()

    // Clicking the backdrop does nothing.
    const backdrop = container.querySelector(".fixed.inset-0")
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("renders nothing when closed", () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole("heading", { name: /confirming new sla/i })).not.toBeInTheDocument()
  })
})
