import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

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

vi.mock("@/hooks/useProjectRole", () => ({
  useProjectAvailableRoles: () => ({ data: undefined }),
  projectAvailableRolesQueryOptions: vi.fn(),
}))

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: [] }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: vi.fn() }),
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

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUser.mockReturnValue({ user: signedInUser, switchRole: vi.fn() })
  })

  it("renders null on the invite acceptance route", () => {
    usePathname.mockReturnValue("/invite/some-token")
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
})
