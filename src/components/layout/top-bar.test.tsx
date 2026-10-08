import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// Radix DropdownMenu relies on DOM APIs jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()

const usePathname = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ fetchQuery: vi.fn() }),
}))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({
  useUser: () => useUser(),
}))

vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({ selectedProjectId: null, setSelectedProjectId: vi.fn() }),
}))

vi.mock("@/hooks/useProject", () => ({
  useUserProjects: () => ({ data: [], isLoading: false }),
  useProjectBranding: () => ({ data: null }),
}))

const useUserRoles = vi.fn()
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectAvailableRoles: () => ({ data: undefined }),
  projectAvailableRolesQueryOptions: vi.fn(),
  useUserRoles: () => useUserRoles(),
}))

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: [] }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock("@/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: vi.fn(),
}))

vi.mock("@/lib/supabase/auth", () => ({
  logoutUser: vi.fn(),
}))

import { TopBar } from "./top-bar"

const signedInUser = {
  id: "user-1",
  name: "Test User",
  role: "user" as const,
  avatar: "T",
  avatarUrl: null,
}

// Radix DropdownMenu opens on a primary-button pointerdown on its trigger.
function openRoleDropdown(triggerLabel: string) {
  const trigger = screen.getByText(triggerLabel).closest("button")!
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
}

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUser.mockReturnValue({ user: signedInUser, switchRole: vi.fn() })
    useUserRoles.mockReturnValue({ data: undefined, isSuccess: false })
  })

  it("renders null on the invite acceptance route", () => {
    usePathname.mockReturnValue("/invite/some-token")
    const { container } = render(<TopBar />)
    expect(container.firstChild).toBeNull()
  })

  it("renders null on the role chooser route", () => {
    usePathname.mockReturnValue("/auth/role")
    const { container } = render(<TopBar />)
    expect(container.firstChild).toBeNull()
  })

  it("renders normally for a signed-in user on a non-invite route", () => {
    usePathname.mockReturnValue("/tickets")
    const { container } = render(<TopBar />)
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByText("User")).toBeInTheDocument()
  })

  describe("role dropdown 'Add new role' item", () => {
    beforeEach(() => {
      usePathname.mockReturnValue("/tickets")
    })

    it("is shown when the profile is registered as User only", () => {
      useUserRoles.mockReturnValue({ data: ["user"], isSuccess: true })
      render(<TopBar />)

      openRoleDropdown("User")

      expect(screen.getByText("Add new role")).toBeInTheDocument()
    })

    it("is hidden when the profile holds more than one role", () => {
      useUserRoles.mockReturnValue({ data: ["helper", "user"], isSuccess: true })
      render(<TopBar />)

      openRoleDropdown("User")

      expect(screen.getByRole("menu")).toBeInTheDocument()
      expect(screen.queryByText("Add new role")).toBeNull()
    })

    it("is hidden when the profile is registered as Admin", () => {
      useUserRoles.mockReturnValue({ data: ["admin"], isSuccess: true })
      useUser.mockReturnValue({
        user: { ...signedInUser, role: "admin" as const },
        switchRole: vi.fn(),
      })
      render(<TopBar />)

      openRoleDropdown("Admin")

      expect(screen.getByRole("menu")).toBeInTheDocument()
      expect(screen.queryByText("Add new role")).toBeNull()
    })
  })
})
