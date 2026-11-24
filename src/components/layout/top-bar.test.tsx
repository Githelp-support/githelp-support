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

const useUserProjects = vi.fn()
vi.mock("@/hooks/useProject", () => ({
  useUserProjects: () => useUserProjects(),
  useProjectBranding: () => ({ data: null }),
}))

const useUserRoles = vi.fn()
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectAvailableRoles: () => ({ data: undefined }),
  projectAvailableRolesQueryOptions: vi.fn(),
  roleProjectIdsQueryOptions: vi.fn(),
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

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUser.mockReturnValue({ user: signedInUser, switchRole: vi.fn() })
    useUserRoles.mockReturnValue({ data: undefined, isSuccess: false })
    useUserProjects.mockReturnValue({ data: [], isLoading: false })
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

  it("shell variant: a mobile-only bar without the bell, avatar, switchers or Sign out", () => {
    usePathname.mockReturnValue("/tickets")
    const { container } = render(<TopBar variant="shell" />)
    expect(container.firstChild).not.toBeNull()
    // Hidden on desktop: the page uses the full height there.
    expect((container.firstChild as HTMLElement).className).toContain("lg:hidden")
    // The bell (now the sidebar's Inbox) and the avatar are gone.
    expect(container.querySelector(".fi-rr-bell")).toBeNull()
    expect(container.querySelector("[data-slot='avatar']")).toBeNull()
    expect(screen.queryByText("T")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument()
    // No role dropdown and no Private context dropdown.
    expect(screen.queryByText("User")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /private/i })).not.toBeInTheDocument()
  })

  it("renders the bell in the default variant too", () => {
    usePathname.mockReturnValue("/tickets")
    const { container } = render(<TopBar />)
    expect(container.querySelector("button .fi-rr-bell")).not.toBeNull()
  })

  it("shows no project dropdown in the shell variant when acting as Admin in a project", () => {
    usePathname.mockReturnValue("/tickets")
    useUser.mockReturnValue({ user: { ...signedInUser, role: "admin" as const }, switchRole: vi.fn() })
    useUserRoles.mockReturnValue({ data: ["admin"], isSuccess: true })
    useUserProjects.mockReturnValue({
      data: [{ project_id: "p1", name: "Alpha", slug: "alpha", logo_url: null }],
      isLoading: false,
    })
    render(<TopBar variant="shell" />)
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(screen.queryByText("Admin")).not.toBeInTheDocument()
  })

  it("shows the Private context dropdown for a user-only account", () => {
    usePathname.mockReturnValue("/support/chat")
    useUserRoles.mockReturnValue({ data: ["user"], isSuccess: true })
    render(<TopBar />)
    expect(screen.getByRole("button", { name: /private/i })).not.toBeDisabled()
  })

  it("shows Private as the current context when acting as User with projects", () => {
    usePathname.mockReturnValue("/support/chat")
    useUserRoles.mockReturnValue({ data: ["helper", "user"], isSuccess: true })
    useUserProjects.mockReturnValue({
      data: [{ project_id: "p1", name: "Alpha", slug: "alpha", logo_url: null }],
      isLoading: false,
    })
    render(<TopBar />)
    const trigger = screen.getByRole("button", { name: /private/i })
    expect(trigger).not.toBeDisabled()
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
  })

  it("hides the role and project switchers on a public support page but not elsewhere", () => {
    useUserRoles.mockReturnValue({ data: ["user"], isSuccess: true })

    usePathname.mockReturnValue("/support/some-slug")
    const { unmount } = render(<TopBar />)
    // Still the default bar for a signed-in user …
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
    // … but without the role dropdown and the project (Private) dropdown.
    expect(screen.queryByText("User")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /private/i })).not.toBeInTheDocument()
    unmount()

    usePathname.mockReturnValue("/projects/1")
    render(<TopBar />)
    expect(screen.getByText("User")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /private/i })).toBeInTheDocument()
  })

  it("does not show the Private placeholder when acting as Admin", () => {
    usePathname.mockReturnValue("/tickets")
    useUser.mockReturnValue({ user: { ...signedInUser, role: "admin" as const }, switchRole: vi.fn() })
    useUserRoles.mockReturnValue({ data: ["admin"], isSuccess: true })
    render(<TopBar />)
    expect(screen.queryByText("Private")).not.toBeInTheDocument()
  })
})
