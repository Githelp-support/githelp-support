import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TicketIdPill } from "./ticket-id-pill"

const FULL_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

describe("TicketIdPill", () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the first 8 characters of the ticket ID", () => {
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.getByText("a1b2c3d4")).toBeInTheDocument()
    expect(screen.queryByText(FULL_ID)).not.toBeInTheDocument()
  })

  it("labels the copy button", () => {
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.getByRole("button", { name: "Copy full ticket ID" })).toBeInTheDocument()
  })

  it("writes the full ID to the clipboard and announces it for 1.5s", async () => {
    vi.useFakeTimers()
    render(<TicketIdPill ticketId={FULL_ID} />)
    expect(screen.queryByText("Copied")).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy full ticket ID" }))
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(FULL_ID)
    const status = screen.getByText("Copied")
    expect(status).toHaveAttribute("aria-live", "polite")

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByText("Copied")).not.toBeInTheDocument()
  })
})
