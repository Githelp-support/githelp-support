import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { Skeleton, ListSkeleton, PageSkeleton } from "../skeleton"
import { EmptyState } from "../empty-state"
import { ErrorState } from "../error-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip"
import { TabSelector } from "../tab-selector"

describe("Skeleton", () => {
  it("is a decorative pulse block in the surface-hover colour", () => {
    render(<Skeleton data-testid="sk" className="h-4 w-24" />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveAttribute("aria-hidden", "true")
    expect(el.className).toMatch(/animate-pulse/)
    expect(el.className).toMatch(/bg-surface-hover/)
    expect(el.className).toMatch(/h-4 w-24/)
  })

  it("ListSkeleton renders the requested number of rows and announces loading", () => {
    render(<ListSkeleton rows={4} />)
    const status = screen.getByRole("status", { name: "Loading" })
    expect(status.querySelectorAll("[data-slot='skeleton-row']")).toHaveLength(4)
  })

  it("PageSkeleton renders a header bar and content blocks", () => {
    render(<PageSkeleton />)
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })
})

describe("EmptyState", () => {
  it("renders the icon tile, title, description and action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No tickets to show"
        description="Tickets you open will appear here."
        action={<button type="button">Get support</button>}
      />,
    )
    expect(screen.getByText("No tickets to show")).toBeInTheDocument()
    expect(screen.getByText("Tickets you open will appear here.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Get support" })).toBeInTheDocument()
    const tile = screen.getByTestId("empty-state-icon")
    expect(tile.className).toMatch(/bg-brand-primary\/10/)
  })

  it("works with only a title", () => {
    render(<EmptyState title="No SLAs found" />)
    expect(screen.getByText("No SLAs found")).toBeInTheDocument()
  })
})

describe("ErrorState", () => {
  it("shows a plain message and a Try again button that calls onRetry", () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("keeps existing copy when a title is given", () => {
    render(<ErrorState title="Could not load tickets" onRetry={() => {}} />)
    expect(screen.getByText("Could not load tickets")).toBeInTheDocument()
  })
})

describe("Tooltip", () => {
  it("renders compact inverted content when open", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button type="button">Trigger</button>
          </TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    const content = screen.getAllByText("Helpful hint")[0]
    const box = content.closest("[data-slot='tooltip-content']") as HTMLElement
    expect(box.className).toMatch(/bg-foreground/)
    expect(box.className).toMatch(/text-background/)
    expect(box.className).toMatch(/text-xs/)
    expect(box.className).toMatch(/shadow-popover/)
  })
})

describe("TabSelector", () => {
  it("uses the subtle track and the tab glow on the active item", () => {
    const onChange = vi.fn()
    render(
      <TabSelector
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value="a"
        onChange={onChange}
      />,
    )
    const track = screen.getByRole("tablist")
    expect(track.className).toMatch(/bg-bg-subtle/)
    const active = screen.getByRole("tab", { name: "Alpha" })
    expect(active).toHaveAttribute("aria-selected", "true")
    expect(active.className).not.toMatch(/#|rgba/)
    // The glow lives on the single sliding indicator, not on the items.
    const indicator = track.querySelector("[data-slot='tab-indicator']")
    expect(indicator).not.toBeNull()
    expect(indicator!.className).toMatch(/shadow-tab/)
    fireEvent.click(screen.getByRole("tab", { name: "Beta" }))
    expect(onChange).toHaveBeenCalledWith("b")
  })
})
