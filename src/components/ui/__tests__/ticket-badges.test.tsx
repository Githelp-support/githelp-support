import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "../badge"
import { CategoryBadge, TicketPriority, TicketStatusBadge } from "../ticket-badges"
import {
  BADGE_SHAPE_CLASS,
  getCategoryDotClass,
  getPriorityStyle,
  getTicketStatusBadge,
} from "@/lib/status-colors"

describe("Badge variants", () => {
  it.each([
    ["type", ["border-transparent", "bg-badge-neutral-bg", "text-badge-neutral-text"]],
    ["category", ["border-badge-outline-border", "bg-badge-outline-bg", "text-badge-outline-text"]],
    ["info", ["border-transparent", "bg-badge-info-bg", "text-badge-info-text"]],
    ["success", ["border-transparent", "bg-badge-success-bg", "text-badge-success-text"]],
    ["neutral", ["border-transparent", "bg-badge-neutral-bg", "text-badge-neutral-text"]],
    ["subdued", ["border-transparent", "bg-badge-neutral-bg", "text-badge-muted-text"]],
    ["urgent", ["border-transparent", "bg-badge-strong-bg", "text-badge-strong-text", "font-semibold"]],
  ] as const)("%s uses its badge tokens", (variant, tokens) => {
    render(<Badge variant={variant}>Label</Badge>)
    const classes = screen.getByText("Label").className.split(/\s+/)
    for (const t of tokens) expect(classes, t).toContain(t)
  })

  it("urgent is semibold, everything else regular", () => {
    render(
      <>
        <Badge variant="urgent">Urgent</Badge>
        <Badge variant="type">Bug</Badge>
      </>
    )
    const urgent = screen.getByText("Urgent").className.split(/\s+/)
    expect(urgent).toContain("font-semibold")
    expect(urgent).not.toContain("font-normal")
    expect(screen.getByText("Bug").className.split(/\s+/)).toContain("font-normal")
  })

  it("BADGE_SHAPE_CLASS is text-xs/400", () => {
    expect(BADGE_SHAPE_CLASS).toContain("font-normal")
    expect(BADGE_SHAPE_CLASS).not.toContain("font-medium")
  })
})

describe("getTicketStatusBadge", () => {
  it.each([
    ["available", "info", "fi-rr-circle-dashed"],
    ["Unclaimed", "info", "fi-rr-circle-dashed"],
    ["claimed", "neutral", "fi-rr-circle-half-stroke"],
    ["in-progress", "neutral", "fi-rr-circle-half-stroke"],
    ["In Progress", "neutral", "fi-rr-circle-half-stroke"],
    ["completed", "success", "fi-rr-check-circle"],
    ["Completed", "success", "fi-rr-check-circle"],
    ["cancelled", "subdued", "fi-rr-cross-circle"],
    ["CANCELLED", "subdued", "fi-rr-cross-circle"],
  ])("%s → %s with %s", (status, variant, icon) => {
    expect(getTicketStatusBadge(status)).toEqual({ variant, icon })
  })

  it("falls back to the grey type variant without an icon", () => {
    expect(getTicketStatusBadge("archived")).toEqual({ variant: "type" })
    expect(getTicketStatusBadge("").icon).toBeUndefined()
  })
})

describe("getPriorityStyle", () => {
  it("low and medium are muted plain text", () => {
    for (const p of ["low", "medium", "Medium"]) {
      expect(getPriorityStyle(p)).toEqual({
        kind: "text",
        className: "text-xs font-normal text-badge-muted-text",
      })
    }
  })

  it("high is semibold plain text and urgent is the urgent badge", () => {
    expect(getPriorityStyle("high")).toEqual({
      kind: "text",
      className: "text-xs font-semibold text-badge-emphasis-text",
    })
    expect(getPriorityStyle("urgent")).toEqual({ kind: "badge", variant: "urgent" })
  })
})

describe("getCategoryDotClass", () => {
  it.each([
    ["core", "bg-badge-dot-core"],
    ["Core team", "bg-badge-dot-core"],
    ["community", "bg-badge-dot-community"],
    ["Community", "bg-badge-dot-community"],
    ["extended", "bg-badge-dot-extended"],
    ["Extended team", "bg-badge-dot-extended"],
  ])("%s → %s", (category, dot) => {
    expect(getCategoryDotClass(category)).toBe(dot)
  })

  it("has no dot colour for an unknown category", () => {
    expect(getCategoryDotClass("other")).toBeUndefined()
  })
})

describe("TicketStatusBadge", () => {
  it("renders the variant with an aria-hidden icon before the label", () => {
    render(<TicketStatusBadge status="available" label="Unclaimed" />)
    const badge = screen.getByText("Unclaimed")
    expect(badge).toHaveAttribute("data-slot", "badge")
    expect(badge.className).toContain("bg-badge-info-bg")
    const icon = badge.querySelector("i")
    expect(icon).not.toBeNull()
    expect(icon).toHaveClass("fi-rr-circle-dashed")
    expect(icon).toHaveAttribute("aria-hidden", "true")
    expect(badge.firstElementChild).toBe(icon)
  })

  it("renders an unknown status grey, without an icon, using the status as label", () => {
    render(<TicketStatusBadge status="archived" />)
    const badge = screen.getByText("archived")
    expect(badge.className).toContain("bg-badge-neutral-bg")
    expect(badge.querySelector("i")).toBeNull()
  })
})

describe("TicketPriority", () => {
  it("medium is plain text with no fill (no yellow)", () => {
    render(<TicketPriority priority="medium" />)
    const el = screen.getByText("Medium")
    expect(el).not.toHaveAttribute("data-slot", "badge")
    expect(el.className).toContain("text-badge-muted-text")
    expect(el.className).not.toMatch(/\bbg-/)
    expect(el.className).not.toContain("status-warning")
  })

  it("high is semibold plain text", () => {
    render(<TicketPriority priority="high" />)
    const el = screen.getByText("High")
    expect(el).not.toHaveAttribute("data-slot", "badge")
    expect(el.className).toContain("font-semibold")
    expect(el.className).toContain("text-badge-emphasis-text")
  })

  it("urgent is the urgent Badge", () => {
    render(<TicketPriority priority="urgent" />)
    const el = screen.getByText("Urgent")
    expect(el).toHaveAttribute("data-slot", "badge")
    expect(el.className).toContain("bg-badge-strong-bg")
  })
})

describe("CategoryBadge", () => {
  it("renders the outlined badge with an aria-hidden tier dot before the label", () => {
    render(<CategoryBadge category="core" label="Core team" />)
    const badge = screen.getByText("Core team")
    expect(badge.className).toContain("border-badge-outline-border")
    const dot = badge.firstElementChild
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(dot).toHaveClass("size-2", "rounded-full", "shrink-0", "bg-badge-dot-core")
  })

  it("renders no dot for an unknown category", () => {
    render(<CategoryBadge category="mystery" label="Mystery" />)
    expect(screen.getByText("Mystery").firstElementChild).toBeNull()
  })
})
