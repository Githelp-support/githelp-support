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

  it("gives the solid variants the depth utility", () => {
    for (const variant of ["default", "destructive", "secondary", "brand"] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole("button").className).toMatch(/(^|\s)btn-depth(-light)?(\s|$)/)
      unmount()
    }
  })

  it("uses the dark-surface depth on default, destructive and brand, the light one on secondary", () => {
    const classesOf = (variant: "default" | "destructive" | "secondary" | "brand") => {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      const classes = screen.getByRole("button").className.split(/\s+/)
      unmount()
      return classes
    }
    expect(classesOf("default")).toEqual(expect.arrayContaining(["btn-depth", "dark:btn-depth-light"]))
    expect(classesOf("secondary")).toEqual(expect.arrayContaining(["btn-depth-light", "dark:btn-depth"]))
    for (const variant of ["destructive", "brand"] as const) {
      const classes = classesOf(variant)
      expect(classes).toContain("btn-depth")
      expect(classes.join(" ")).not.toMatch(/btn-depth-light/)
    }
  })

  it("replaces the old shadow on the solid variants and keeps their colours", () => {
    const expected = {
      default: ["bg-primary", "hover:bg-primary/90"],
      destructive: ["bg-destructive", "hover:bg-destructive/90"],
      secondary: ["bg-secondary", "hover:bg-secondary/80"],
      brand: ["bg-brand-primary", "hover:bg-brand-primary-hover"],
    } as const
    for (const variant of ["default", "destructive", "secondary", "brand"] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      const classes = screen.getByRole("button").className.split(/\s+/)
      expect(classes).toEqual(expect.arrayContaining([...expected[variant]]))
      expect(classes).not.toContain("shadow-control")
      expect(classes).not.toContain("shadow-xs")
      unmount()
    }
  })

  it("leaves outline, ghost, link, lavender and neutral flat", () => {
    for (const variant of ["outline", "ghost", "link", "lavender", "neutral"] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole("button").className).not.toMatch(/btn-depth/)
      unmount()
    }
  })

  it("keeps the depth classes on asChild links and disables loading buttons", () => {
    render(
      <Button asChild variant="brand">
        <a href="#support">Get support</a>
      </Button>
    )
    expect(screen.getByRole("link").className.split(/\s+/)).toContain("btn-depth")

    render(<Button loading>Save</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
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
