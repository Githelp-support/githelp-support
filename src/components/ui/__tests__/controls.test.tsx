import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "../button"
import { Input } from "../input"
import { Card } from "../card"
import { Badge } from "../badge"
import { ListHeader, ListRow, listRowClass } from "../list"

describe("Button sizes", () => {
  it("uses h-7 / h-8 / h-10 for sm / default / lg", () => {
    const { rerender } = render(<Button size="sm">A</Button>)
    expect(screen.getByRole("button").className).toMatch(/\bh-7\b/)
    rerender(<Button>A</Button>)
    expect(screen.getByRole("button").className).toMatch(/\bh-8\b/)
    rerender(<Button size="lg">A</Button>)
    expect(screen.getByRole("button").className).toMatch(/\bh-10\b/)
  })

  it("has active and focus-visible styles", () => {
    render(<Button>A</Button>)
    const cls = screen.getByRole("button").className
    expect(cls).toMatch(/active:scale-/)
    expect(cls).toMatch(/focus-visible:ring/)
  })
})

describe("Input", () => {
  it("is h-8 by default with a visible focus ring", () => {
    render(<Input aria-label="Name" />)
    const cls = screen.getByRole("textbox").className
    expect(cls).toMatch(/\bh-8\b/)
    expect(cls).toMatch(/focus-visible:ring/)
  })
})

describe("Card", () => {
  it("defaults to a flat bordered card: bg-card, border-subtle, rounded-lg, no shadow, gap-4, py-5", () => {
    render(<Card data-testid="card" />)
    const cls = screen.getByTestId("card").className
    for (const t of ["bg-card", "border-border-subtle", "rounded-lg", "shadow-none", "gap-4", "py-5"]) {
      expect(cls, t).toMatch(new RegExp(`\\b${t.replace("/", "\\/")}\\b`))
    }
  })
})

describe("Badge", () => {
  it("is h-5 px-2 text-xs/500 with the rounded-md shape", () => {
    render(<Badge>Open</Badge>)
    const cls = screen.getByText("Open").className
    for (const t of ["h-5", "px-2", "text-xs", "font-medium", "rounded-md"]) {
      expect(cls, t).toMatch(new RegExp(`\\b${t}\\b`))
    }
  })
})

describe("List", () => {
  it("ListHeader keeps the lavender tint with text-xs/500 text-muted and a hairline", () => {
    render(<ListHeader data-testid="h">Ticket</ListHeader>)
    const cls = screen.getByTestId("h").className
    for (const t of ["bg-brand-primary/10", "min-h-10", "px-6", "text-xs", "font-medium", "text-text-muted", "border-b"]) {
      expect(cls, t).toContain(t)
    }
  })

  it("ListRow is min-h-12 px-6 text-ui with a hover surface and a focus ring when interactive", () => {
    render(<ListRow interactive data-testid="r">Row</ListRow>)
    const cls = screen.getByTestId("r").className
    for (const t of ["min-h-12", "px-6", "text-ui", "hover:bg-surface-hover", "focus-visible:ring"]) {
      expect(cls, t).toContain(t)
    }
  })

  it("listRowClass offers the subtle tone used by unclaimed tickets", () => {
    expect(listRowClass({ tone: "subtle" })).toContain("bg-bg-subtle")
    expect(listRowClass({ bordered: true })).toContain("border-b")
    expect(listRowClass()).not.toContain("border-b")
  })
})
