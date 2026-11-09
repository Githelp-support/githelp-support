import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "../button"

describe("Button", () => {
  it("renders with the correct text", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("calls the onClick handler when clicked", () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Submit</Button>)
    fireEvent.click(screen.getByRole("button"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it("applies the destructive variant class", () => {
    render(<Button variant="destructive">Delete</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toMatch(/bg-destructive/)
  })

  it("applies the outline variant class", () => {
    render(<Button variant="outline">Cancel</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toMatch(/border/)
  })

  it("applies the ghost variant class", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toMatch("hover:bg-surface-hover")
  })

  it("applies the brand variant (solid brand purple with brand hover)", () => {
    render(<Button variant="brand">Get support</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toMatch(/\bbg-brand-primary\b/)
    expect(btn.className).toMatch(/text-brand-foreground/)
    expect(btn.className).toMatch(/hover:bg-brand-primary-hover/)
  })

  it("uses token-based styling, never hardcoded hex or rgba", () => {
    for (const variant of ["default", "outline", "ghost", "lavender", "neutral", "brand"] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole("button").className).not.toMatch(/#[0-9a-fA-F]{3,6}|rgba\(/)
      unmount()
    }
  })

  it("applies additional className prop", () => {
    render(<Button className="my-custom-class">Styled</Button>)
    expect(screen.getByRole("button").className).toMatch(/my-custom-class/)
  })

  it("has data-slot attribute", () => {
    render(<Button>Slotted</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-slot", "button")
  })
})
