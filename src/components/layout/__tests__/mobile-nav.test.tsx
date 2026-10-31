import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

const usePathname = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => new URLSearchParams(),
}))

import { MobileNavProvider, MobileNavToggle, MobileSidebarSheet } from "../mobile-nav"

beforeEach(() => {
  vi.clearAllMocks()
  usePathname.mockReturnValue("/tickets")
})

function App() {
  return (
    <MobileNavProvider>
      <MobileNavToggle />
      <MobileSidebarSheet label="Main menu">
        <nav aria-label="Main">
          <a href="/tickets">Tickets</a>
        </nav>
      </MobileSidebarSheet>
    </MobileNavProvider>
  )
}

describe("Mobile navigation sheet", () => {
  it("renders the menu button only while a sheet is registered", () => {
    render(
      <MobileNavProvider>
        <MobileNavToggle />
      </MobileNavProvider>,
    )
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument()
  })

  it("opens the sheet from the menu button and closes it with Escape", () => {
    render(<App />)
    const button = screen.getByRole("button", { name: "Open menu" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(button)
    const dialog = screen.getByRole("dialog", { name: "Main menu" })
    expect(dialog).toContainElement(screen.getByRole("link", { name: "Tickets" }))

    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes when the route changes", () => {
    const { rerender } = render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    usePathname.mockReturnValue("/helpers")
    act(() => {
      rerender(<App />)
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
