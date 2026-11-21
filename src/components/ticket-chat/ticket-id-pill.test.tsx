import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { TicketIdPill } from "./ticket-id-pill"

const FULL_ID = "b435097a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

describe("TicketIdPill", () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the short id followed by two dots", () => {
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.getByText("b435097a..")).toBeInTheDocument()
    expect(screen.queryByText(FULL_ID)).not.toBeInTheDocument()
  })

  it("has a labelled copy button", () => {
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.getByRole("button", { name: "Copy full ticket ID" })).toBeInTheDocument()
  })

  it("copies the full id and shows 'Copied' for 1.5s", async () => {
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.queryByText("Copied")).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy full ticket ID" }))
    })
    expect(writeText).toHaveBeenCalledWith(FULL_ID)
    expect(screen.getByText("Copied")).toHaveAttribute("aria-live", "polite")

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByText("Copied")).not.toBeInTheDocument()
  })
})
