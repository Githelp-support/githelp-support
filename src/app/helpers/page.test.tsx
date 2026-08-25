import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * Admin "Remove helper" flow on the Helpers page:
 * 1. Kebab menu (three vertical dots) on a helper row shows "Remove helper".
 * 2. Selecting it opens a confirmation dialog ("Yes" / "Cancel").
 * 3. "Yes" removes the helper and shows a success dialog with "Close".
 * 4. "Cancel" closes the dialog without removing the helper.
 */

const h = vi.hoisted(() => ({
  removeHelperMutateAsync: vi.fn(() => Promise.resolve({ helperId: "helper-1", projectId: "proj-1" })),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

// --- jsdom polyfills required by Radix dropdown/popper ---
beforeAll(() => {
  ;(global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false)
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {})
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {})
})

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}))

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}))

vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/layout/header", () => ({ Header: () => null }))
vi.mock("@/components/drawers/add-helper-drawer", () => ({
  AddHelperDrawer: () => null,
}))
vi.mock("@/components/drawers/accept-request-drawer", () => ({
  AcceptRequestDrawer: () => null,
}))

vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: "proj-1" }),
}))

vi.mock("@/contexts/user-context", () => ({
  useUser: () => ({ user: { id: "admin-1", name: "Admin", role: "admin" } }),
}))

vi.mock("@/hooks/useHelpers", () => ({
  useHelpers: () => ({
    data: [
      {
        helper_id: "helper-1",
        user_id: "user-2",
        project_id: "proj-1",
        category: "core",
        user: { name: "Alice", username: "alice", avatar_url: null },
      },
    ],
    isLoading: false,
  }),
  useCreateHelper: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddSelfAsHelper: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveHelper: () => ({
    mutateAsync: h.removeHelperMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/usePendingRequests", () => ({
  usePendingRequests: () => ({ data: [], isLoading: false }),
  useUpdatePendingRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/useProject", () => ({
  useCreateProjectInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListProjectInvites: () => ({ data: [], isLoading: false }),
  useRevokeProjectInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import HelpersPage from "./page"

function openKebabMenu() {
  const trigger = screen.getByRole("button", { name: /open menu for alice/i })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
  return trigger
}

describe("HelpersPage — remove helper flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a 'Remove helper' option in the helper row kebab menu", async () => {
    render(<HelpersPage />)
    expect(screen.getByText("Alice")).toBeInTheDocument()

    openKebabMenu()

    expect(
      await screen.findByRole("menuitem", { name: /remove helper/i }),
    ).toBeInTheDocument()
  })

  it("removes the helper after confirming, then shows the success dialog", async () => {
    render(<HelpersPage />)

    openKebabMenu()
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove helper/i }))

    // Confirmation popup
    expect(
      await screen.findByText("Are you sure you want to remove this helper?"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Yes" }))

    await waitFor(() => {
      expect(h.removeHelperMutateAsync).toHaveBeenCalledWith({
        helperId: "helper-1",
        projectId: "proj-1",
      })
    })

    // Success popup
    expect(
      await screen.findByText("The helper is now removed from the project"),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(
        screen.queryByText("The helper is now removed from the project"),
      ).not.toBeInTheDocument()
    })
  })

  it("does not remove the helper when cancelling the confirmation", async () => {
    render(<HelpersPage />)

    openKebabMenu()
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove helper/i }))

    expect(
      await screen.findByText("Are you sure you want to remove this helper?"),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() => {
      expect(
        screen.queryByText("Are you sure you want to remove this helper?"),
      ).not.toBeInTheDocument()
    })
    expect(h.removeHelperMutateAsync).not.toHaveBeenCalled()
  })

  it("shows an error toast and no success dialog when removal fails", async () => {
    h.removeHelperMutateAsync.mockRejectedValueOnce(new Error("boom"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<HelpersPage />)

    openKebabMenu()
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove helper/i }))
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }))

    await waitFor(() => {
      expect(h.toastError).toHaveBeenCalledWith(
        "Failed to remove helper. Please try again.",
      )
    })
    expect(
      screen.queryByText("The helper is now removed from the project"),
    ).not.toBeInTheDocument()

    consoleError.mockRestore()
  })
})
