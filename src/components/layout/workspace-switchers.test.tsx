import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
const useProjectAvailableRoles = vi.fn()
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectAvailableRoles: () => useProjectAvailableRoles(),
  projectAvailableRolesQueryOptions: vi.fn(),
  roleProjectIdsQueryOptions: vi.fn(),
  useUserRoles: () => useUserRoles(),
}))

vi.mock("@/lib/supabase/auth", () => ({
  logoutUser: vi.fn(),
}))

import { RoleSwitcher, ProjectSwitcher } from "./workspace-switchers"

const signedInUser = {
  id: "user-1",
  name: "Test User",
  role: "user" as const,
  avatar: "T",
  avatarUrl: null,
}

const alpha = { project_id: "p1", name: "Alpha", slug: "alpha", logo_url: null }
const beta = { project_id: "p2", name: "Beta", slug: "beta", logo_url: null }

// The collapsed trigger and the "Add employer" row use the shared Tooltip,
// which needs the root layout's provider.
const renderWithTooltips = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>)

const actAs = (role: "admin" | "helper" | "user") => {
  const switchRole = vi.fn()
  useUser.mockReturnValue({ user: { ...signedInUser, role }, switchRole })
  return switchRole
}

beforeEach(() => {
  vi.clearAllMocks()
  actAs("user")
  useUserRoles.mockReturnValue({ data: undefined, isSuccess: false })
  useUserProjects.mockReturnValue({ data: [], isLoading: false })
  useProjectAvailableRoles.mockReturnValue({ data: undefined, isSuccess: false })
})

describe("RoleSwitcher", () => {
  it("shows the current role on the trigger", () => {
    actAs("helper")
    render(<RoleSwitcher />)
    expect(screen.getByRole("button", { name: "Helper" })).toBeInTheDocument()
  })

  it("row variant: flat, content-width trigger with the role name and one chevron, no role tile", () => {
    actAs("helper")
    render(<RoleSwitcher variant="row" />)

    const trigger = screen.getByRole("button", { name: "Switch role, current: Helper" })
    expect(screen.getByText("Helper")).toBeInTheDocument()
    expect(trigger).toHaveTextContent("Helper")
    expect(trigger.querySelectorAll(".fi-rr-angle-small-down")).toHaveLength(1)
    expect(trigger.querySelector('[data-slot="role-icon"]')).toBeNull()

    const classes = trigger.className.split(/\s+/)
    expect(classes).toEqual(
      expect.arrayContaining(["h-8", "rounded-md", "hover:bg-sidebar-control-hover"]),
    )
    expect(classes.filter((c) => /(^|:)border(-|$)/.test(c))).toEqual([])
  })

  it("in the private User context lists every held role plus 'New role'", () => {
    useUserRoles.mockReturnValue({ data: ["helper", "user"], isSuccess: true })
    render(<RoleSwitcher />)

    fireEvent.keyDown(screen.getByRole("button", { name: "User" }), { key: "Enter" })
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent?.trim())).toEqual([
      "Helper",
      "User",
      "New role",
    ])
  })

  it("in a project lists the roles held there, without 'New role', and switches role", () => {
    const switchRole = actAs("admin")
    useUserRoles.mockReturnValue({ data: ["admin", "helper"], isSuccess: true })
    useUserProjects.mockReturnValue({ data: [alpha], isLoading: false })
    useProjectAvailableRoles.mockReturnValue({ data: ["admin", "helper"], isSuccess: true })
    render(<RoleSwitcher />)

    fireEvent.keyDown(screen.getByRole("button", { name: "Admin" }), { key: "Enter" })
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent?.trim())).toEqual([
      "Admin",
      "Helper",
      "User",
    ])

    fireEvent.click(screen.getByRole("menuitem", { name: "Helper" }))
    expect(switchRole).toHaveBeenCalledWith("helper")
    expect(push).toHaveBeenCalledTimes(1)
  })
})

describe("ProjectSwitcher — Private context (acting as User)", () => {
  it("shows the Private context dropdown for a user-only account", () => {
    useUserRoles.mockReturnValue({ data: ["user"], isSuccess: true })
    renderWithTooltips(<ProjectSwitcher />)
    expect(screen.getByRole("button", { name: /private/i })).not.toBeDisabled()
  })

  it("shows Private, not the project, when acting as User with projects", () => {
    useUserRoles.mockReturnValue({ data: ["helper", "user"], isSuccess: true })
    useUserProjects.mockReturnValue({ data: [alpha], isLoading: false })
    renderWithTooltips(<ProjectSwitcher />)

    const trigger = screen.getByRole("button", { name: /private/i })
    expect(trigger).not.toBeDisabled()
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()

    // The menu lists the Private context and the employer placeholder: no projects, no "Add new".
    fireEvent.keyDown(trigger, { key: "Enter" })
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent?.trim())).toEqual([
      "Private",
      "Add employer",
    ])
  })

  it("does not show the Private placeholder when acting as Admin", () => {
    actAs("admin")
    useUserRoles.mockReturnValue({ data: ["admin"], isSuccess: true })
    useUserProjects.mockReturnValue({ data: [alpha], isLoading: false })
    renderWithTooltips(<ProjectSwitcher />)
    expect(screen.queryByText("Private")).not.toBeInTheDocument()
  })

  it("collapsed: icon-only trigger that keeps 'Private' as its accessible name", () => {
    renderWithTooltips(<ProjectSwitcher collapsed />)
    expect(screen.getByRole("button", { name: "Private" })).toBeInTheDocument()
    expect(screen.queryByText("Private")).not.toBeInTheDocument()
  })
})

describe("ProjectSwitcher — project context (admin / helper)", () => {
  beforeEach(() => {
    actAs("admin")
    useUserRoles.mockReturnValue({ data: ["admin"], isSuccess: true })
    useUserProjects.mockReturnValue({ data: [alpha, beta], isLoading: false })
  })

  it("expanded: shows the selected project's name and lists the projects plus 'Add new'", () => {
    renderWithTooltips(<ProjectSwitcher />)

    const trigger = screen.getByRole("button", { name: /alpha/i })
    expect(screen.getByText("Alpha")).toBeInTheDocument()

    fireEvent.keyDown(trigger, { key: "Enter" })
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent?.trim())).toEqual([
      "AAlpha",
      "BBeta",
      "Add new",
    ])
  })

  it("collapsed: logo-only trigger with no project-name text", () => {
    renderWithTooltips(<ProjectSwitcher collapsed />)

    // The name survives only as the accessible name (and the tooltip on hover).
    const trigger = screen.getByRole("button", { name: "Alpha" })
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(trigger).toHaveTextContent(/^A$/)
    expect(trigger.querySelector(".fi-rr-angle-small-down")).toBeNull()
  })

  it("row variant: flat, borderless triggers with a single down arrow", () => {
    renderWithTooltips(
      <>
        <RoleSwitcher variant="row" />
        <ProjectSwitcher variant="row" />
      </>,
    )

    const role = screen.getByRole("button", { name: "Switch role, current: Admin" })
    const project = screen.getByRole("button", { name: /alpha/i })
    for (const trigger of [role, project]) {
      expect(trigger.className).toContain("hover:bg-sidebar-control-hover")
      expect(trigger.className).toContain("data-[state=open]:bg-sidebar-control-hover")
      expect(trigger.className).not.toContain("border")
      expect(trigger.className).not.toContain("bg-sidebar ")
      expect(trigger.querySelectorAll(".fi-rr-angle-small-down")).toHaveLength(1)
    }

    // Role: content-width button with the name and the chevron, no role tile.
    expect(role.className).toContain("h-8")
    expect(role.className).toContain("w-auto")
    expect(role).toHaveTextContent("Admin")
    expect(role.children).toHaveLength(2)
    expect(role.querySelector('[data-slot="role-icon"]')).toBeNull()

    // Project: 40px row, 28px image 6px from the edges, truncated name, chevron.
    const projectClasses = project.className.split(/\s+/)
    expect(projectClasses).toEqual(
      expect.arrayContaining(["h-10", "rounded-lg", "px-1.5", "gap-2.5", "hover:bg-sidebar-control-hover"]),
    )
    expect(projectClasses).not.toContain("border-border-subtle")
    expect(projectClasses).not.toContain("bg-sidebar")
    expect(project.children).toHaveLength(3)
    expect(project.children[0].className).toContain("w-7 h-7")
    expect(project.children[1]).toHaveTextContent("Alpha")
    expect(project.children[1].className).toContain("font-medium")
    expect(project.children[1].className).toContain("truncate")
    expect(project.children[1].className).toContain("text-foreground")

    // The role menu lists names only, with a checkmark on the current role.
    fireEvent.keyDown(role, { key: "Enter" })
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.querySelector('[data-slot="role-icon"]')).toBeNull()
      expect(item.querySelector("svg")).toBeNull()
    }
    expect(screen.getByRole("menuitem", { name: "Admin" }).querySelector(".fi-rr-check")).not.toBeNull()
    const roleItems = screen.getAllByRole("menuitem")
    expect(roleItems.length).toBeGreaterThan(1)
    expect(roleItems.filter((item) => item.querySelector(".fi-rr-check"))).toHaveLength(1)
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })

    // The project menu: 28px images, a checkmark on the current project, no brand tint.
    fireEvent.keyDown(project, { key: "Enter" })
    const [current, other] = screen.getAllByRole("menuitem")
    expect(current).toHaveTextContent("Alpha")
    expect(other).toHaveTextContent("Beta")
    for (const item of [current, other]) {
      expect(item.children[0].className).toContain("w-7 h-7")
      expect(item.className).not.toContain("bg-brand-primary")
    }
    expect(current.querySelector(".fi-rr-check")).not.toBeNull()
    expect(other.querySelector(".fi-rr-check")).toBeNull()
  })

  it("row variant, collapsed: 28px logo-only trigger; the TopBar path keeps its size", () => {
    const { rerender } = renderWithTooltips(<ProjectSwitcher variant="row" collapsed />)
    const trigger = screen.getByRole("button", { name: "Alpha" })
    expect(trigger.children).toHaveLength(1)
    expect(trigger.children[0].className).toContain("w-7 h-7")
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(trigger.querySelector(".fi-rr-angle-small-down")).toBeNull()

    rerender(
      <TooltipProvider>
        <ProjectSwitcher collapsed />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: "Alpha" }).children[0].className).toContain("w-6 h-6")
  })

  it("shows a loading placeholder while the projects load", () => {
    useUserProjects.mockReturnValue({ data: undefined, isLoading: true })
    const { container, rerender } = renderWithTooltips(<ProjectSwitcher />)
    expect(screen.getByText("Loading projects...")).toBeInTheDocument()

    rerender(
      <TooltipProvider>
        <ProjectSwitcher collapsed />
      </TooltipProvider>,
    )
    expect(screen.queryByText("Loading projects...")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("renders nothing without projects", () => {
    useUserProjects.mockReturnValue({ data: [], isLoading: false })
    const { container } = renderWithTooltips(<ProjectSwitcher />)
    expect(container).toBeEmptyDOMElement()
  })
})
