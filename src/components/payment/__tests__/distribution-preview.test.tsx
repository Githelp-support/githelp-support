import { describe, it, expect, beforeAll } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

import { DistributionPreview } from "../distribution-preview"

const HEADER = "About the Stripe fee"
const BODY_FEE =
  "Stripe charges about 2,9% + $0.30 per card transaction (US cards)."
const BODY_ASSUMPTION =
  "This preview assumes one transaction. Tickets charged several times - extra time beyond the hold, weekly captures, a retry after a declined card - pay the fee on each charge, before the helper/project split."

const renderPreview = () =>
  render(<DistributionPreview helperPercentage={50} oneHourTotal={100} />)

const getInfoButton = () => screen.getByRole("button", { name: HEADER })

/** The popover header; the trigger only carries the same string as aria-label. */
const queryPopoverHeader = () => screen.queryByRole("heading", { name: HEADER })

/** Radix registers its outside-pointer listener on a 0ms timer after opening. */
const flushTimers = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

/** Returns the grid row (label + amount) that contains the given label text. */
const getRow = (label: string) => {
  // Match the label cell by its full text: the Stripe label is split around
  // the info button, so a plain string matcher would not find it.
  const cell = screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === label)
  const row = cell.closest("div.grid")
  if (!row) throw new Error(`No row found for "${label}"`)
  return row as HTMLElement
}

describe("DistributionPreview", () => {
  beforeAll(() => {
    // Radix Popper measures its anchor with ResizeObserver, which jsdom lacks.
    if (!globalThis.ResizeObserver) {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
  })

  it("renders the short assumption note below the Sum row instead of the long paragraph", () => {
    renderPreview()

    const note = screen.getByText("Assumes one transaction.")
    const sumLabel = screen.getByText("Sum")
    expect(
      sumLabel.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(screen.queryByText(/Stripe charges a fee/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/typically 2\.9%/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/a ticket charged in several transactions/i),
    ).not.toBeInTheDocument()
  })

  it("renders the info button in the Stripe row with the popover closed", () => {
    renderPreview()

    const stripeRow = getRow("Stripe (per transaction)")
    expect(stripeRow).toContainElement(getInfoButton())

    expect(queryPopoverHeader()).not.toBeInTheDocument()
    expect(screen.queryByText(BODY_FEE)).not.toBeInTheDocument()
    expect(screen.queryByText(BODY_ASSUMPTION)).not.toBeInTheDocument()
  })

  it("opens the popover with the header and both paragraphs on click", () => {
    renderPreview()

    fireEvent.click(getInfoButton())

    expect(queryPopoverHeader()).toBeInTheDocument()
    expect(screen.getByText(BODY_FEE)).toBeInTheDocument()
    expect(screen.getByText(BODY_ASSUMPTION)).toBeInTheDocument()
  })

  it("uses the dark tooltip style with one font size for the body text", () => {
    renderPreview()

    fireEvent.click(getInfoButton())

    const content = document.querySelector('[data-slot="popover-content"]')
    expect(content).toHaveClass("bg-foreground", "text-background", "text-xs")

    // Neither paragraph overrides the size inherited from the popover.
    for (const body of [BODY_FEE, BODY_ASSUMPTION]) {
      expect(screen.getByText(body).className).not.toMatch(/\btext-/)
    }
  })

  it("keeps the info button on the same line as the last word of the Stripe label", () => {
    renderPreview()

    // The last word and the button share a no-wrap span, so the button can
    // never drop to its own line or drift away from the text.
    const tail = getInfoButton().parentElement
    expect(tail).toHaveClass("whitespace-nowrap")
    expect(tail?.firstChild?.textContent).toBe("transaction)")
    expect(tail?.lastElementChild).toBe(getInfoButton())
    expect(tail?.parentElement?.textContent).toBe("Stripe (per transaction)")
  })

  it("closes the popover when Escape is pressed", async () => {
    renderPreview()

    fireEvent.click(getInfoButton())
    expect(queryPopoverHeader()).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })

    await waitFor(() => expect(queryPopoverHeader()).not.toBeInTheDocument())
    expect(screen.queryByText(BODY_FEE)).not.toBeInTheDocument()
  })

  it("opens the popover on hover and closes it after the pointer leaves", async () => {
    renderPreview()

    fireEvent.mouseEnter(getInfoButton())

    expect(queryPopoverHeader()).toBeInTheDocument()
    expect(screen.getByText(BODY_FEE)).toBeInTheDocument()
    expect(screen.getByText(BODY_ASSUMPTION)).toBeInTheDocument()

    // Closing is delayed so the pointer can travel into the popover.
    fireEvent.mouseLeave(getInfoButton())
    expect(queryPopoverHeader()).toBeInTheDocument()
    await waitFor(() => expect(queryPopoverHeader()).not.toBeInTheDocument())
  })

  it("closes the popover on a pointer-down outside", async () => {
    renderPreview()

    fireEvent.click(getInfoButton())
    expect(queryPopoverHeader()).toBeInTheDocument()
    await flushTimers()

    fireEvent.pointerDown(document.body)

    await waitFor(() => expect(queryPopoverHeader()).not.toBeInTheDocument())
  })

  it("still renders the distribution amounts", () => {
    renderPreview()

    // 100 - (100 * 2.9% + 0.30) = 96.80, split 50/50.
    expect(getRow("Helper")).toHaveTextContent("$48.40")
    expect(getRow("Project")).toHaveTextContent("$48.40")
    expect(getRow("Githelp")).toHaveTextContent("$0.00")
    expect(getRow("Stripe (per transaction)")).toHaveTextContent("$3.20")
    expect(getRow("Sum")).toHaveTextContent("$100.00")
  })
})
