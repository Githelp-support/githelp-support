import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({
  useUser: () => useUser(),
}))

vi.mock("@/contexts/project-context", () => ({
  useProjectSelection: () => ({
    selectedProjectId: "project-1",
    setSelectedProjectId: vi.fn(),
  }),
}))

vi.mock("@/hooks/useProject", () => ({
  useUserProjects: () => ({
    data: [{ project_id: "project-1", name: "Acme" }],
    isLoading: false,
  }),
  useProjectBranding: () => ({ data: null }),
}))

const useProjectAvailableRoles = vi.fn()
const useUserRoles = vi.fn()
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectAvailableRoles: () => useProjectAvailableRoles(),
  useUserRoles: () => useUserRoles(),
  projectAvailableRolesQueryOptions: (projectId: string) => ({
    queryKey: ["project-available-roles", projectId],
    queryFn: async () => [],
  }),
}))

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: [] }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: vi.fn() }),
  notificationType: {},
}))

vi.mock("@/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: vi.fn(),
}))

vi.mock("@/lib/supabase/auth", () => ({
  logoutUser: vi.fn(),
}))

import { TopBar } from "./top-bar"

const renderTopBar = (role: "admin" | "helper") => {
  useUser.mockReturnValue({
    user: { id: "user-1", name: "Test User", role, avatar: "T", avatarUrl: null },
    switchRole: vi.fn(),
  })
  // The active role is one the profile holds, so TopBar's role-correction
  // effect stays idle and never navigates on its own.
  useProjectAvailableRoles.mockReturnValue({ data: [role], isSuccess: true })
  useUserRoles.mockReturnValue({ data: [role], isSuccess: true })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TopBar />
    </QueryClientProvider>,
  )
}

const openProjectDropdown = () => {
  const trigger = screen.getByRole("button", { name: /Acme/ })
  fireEvent.keyDown(trigger, { key: "Enter" })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TopBar — project dropdown bottom option", () => {
  it("shows 'Ask to be validated' for helpers and routes to /onboarding/join", async () => {
    renderTopBar("helper")
    openProjectDropdown()

    const item = await screen.findByRole("menuitem", { name: "Ask to be validated" })
    expect(item).toBeInTheDocument()
    expect(screen.queryByText("Add new")).not.toBeInTheDocument()

    fireEvent.click(item)

    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/onboarding/join")
  })

  it("shows 'Add new' for admins and hides the helper option", async () => {
    renderTopBar("admin")
    openProjectDropdown()

    expect(await screen.findByRole("menuitem", { name: "Add new" })).toBeInTheDocument()
    expect(screen.queryByText("Ask to be validated")).not.toBeInTheDocument()
  })
})
