import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "../button"
import { DrawerPanel } from "../drawer-panel"

describe("Button loading", () => {
  it("keeps the label in the layout and shows a spinner while loading", () => {
    render(<Button loading>Confirm hold</Button>)
    const btn = screen.getByRole("button", { name: /confirm hold/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute("aria-busy", "true")
    // The label stays rendered (invisible) so the button keeps its width.
    expect(screen.getByText("Confirm hold").className).toMatch(/invisible/)
    expect(btn.querySelector("[data-slot='button-spinner']")).not.toBeNull()
  })

  it("renders normally when not loading", () => {
    render(<Button loading={false}>Confirm hold</Button>)
    const btn = screen.getByRole("button", { name: "Confirm hold" })
    expect(btn).not.toBeDisabled()
    expect(btn.querySelector("[data-slot='button-spinner']")).toBeNull()
  })
})

describe("DrawerPanel", () => {
  it("renders nothing while closed and a dialog with the title while open", () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <DrawerPanel isOpen={false} onClose={onClose} title="Log time">
        <p>Body</p>
      </DrawerPanel>,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    rerender(
      <DrawerPanel isOpen onClose={onClose} title="Log time" footer={<button type="button">Save</button>}>
        <p>Body</p>
      </DrawerPanel>,
    )
    const dialog = screen.getByRole("dialog", { name: "Log time" })
    expect(dialog).toContainElement(screen.getByText("Body"))
    expect(dialog).toContainElement(screen.getByRole("button", { name: "Save" }))
  })

  it("closes with Escape and with the close button", () => {
    const onClose = vi.fn()
    render(
      <DrawerPanel isOpen onClose={onClose} title="Log time">
        <p>Body</p>
      </DrawerPanel>,
    )
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("slides in from the right as a side sheet", () => {
    render(
      <DrawerPanel isOpen onClose={() => {}} title="Log time" width="w-[440px]">
        <p>Body</p>
      </DrawerPanel>,
    )
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toMatch(/animate-sheet-in/)
    expect(dialog.className).toMatch(/w-\[440px\]/)
  })
})
