import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { useState } from "react"

const push = vi.fn()
let currentPathname = "/settings"
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => currentPathname,
}))

import { UnsavedChangesProvider, useUnsavedChangesGuard } from "../unsaved-changes-context"

function Form({ initiallyDirty = false }: { initiallyDirty?: boolean }) {
  const [dirty, setDirty] = useState(initiallyDirty)
  useUnsavedChangesGuard(dirty)
  return (
    <div>
      <button type="button" onClick={() => setDirty(true)}>
        Make dirty
      </button>
      <button type="button" onClick={() => setDirty(false)}>
        Make clean
      </button>
    </div>
  )
}

function Page({ initiallyDirty = false }: { initiallyDirty?: boolean }) {
  return (
    <UnsavedChangesProvider>
      <a href="/tickets" data-testid="link">
        Tickets
      </a>
      <Form initiallyDirty={initiallyDirty} />
    </UnsavedChangesProvider>
  )
}

function clickLink() {
  const link = screen.getByTestId("link")
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  act(() => {
    link.dispatchEvent(event)
  })
  return event
}

describe("UnsavedChangesProvider", () => {
  beforeEach(() => {
    push.mockReset()
    currentPathname = "/settings"
    window.history.replaceState({}, "", "/settings")
  })

  it("lets a link click through when the page is clean", () => {
    render(<Page />)
    const event = clickLink()
    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("blocks the click and opens the dialog when dirty", async () => {
    render(<Page initiallyDirty />)
    const event = clickLink()
    expect(event.defaultPrevented).toBe(true)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("'Stay on page' closes the dialog without navigating", async () => {
    render(<Page initiallyDirty />)
    clickLink()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: /stay on page/i }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(push).not.toHaveBeenCalled()
  })

  it("'Leave without saving' navigates to the stored href", async () => {
    render(<Page initiallyDirty />)
    clickLink()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: /leave without saving/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tickets"))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("sets beforeunload returnValue only when dirty", () => {
    render(<Page />)

    const fire = () => {
      const event = new Event("beforeunload", { cancelable: true })
      // jsdom exposes the legacy boolean `returnValue`; replace it with a plain
      // writable slot so we can observe exactly what the handler assigns.
      Object.defineProperty(event, "returnValue", { value: undefined, writable: true, configurable: true })
      window.dispatchEvent(event)
      return event as BeforeUnloadEvent
    }

    expect(fire().returnValue).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: /make dirty/i }))
    const dirtyEvent = fire()
    expect(dirtyEvent.defaultPrevented).toBe(true)
    expect(dirtyEvent.returnValue).toBe("")

    fireEvent.click(screen.getByRole("button", { name: /make clean/i }))
    expect(fire().returnValue).toBeUndefined()
  })

  it("deregisters the guard on unmount", () => {
    const { rerender } = render(<Page initiallyDirty />)
    expect(clickLink().defaultPrevented).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: /stay on page/i }))

    rerender(
      <UnsavedChangesProvider>
        <a href="/tickets" data-testid="link">
          Tickets
        </a>
      </UnsavedChangesProvider>,
    )
    expect(clickLink().defaultPrevented).toBe(false)
  })
})
