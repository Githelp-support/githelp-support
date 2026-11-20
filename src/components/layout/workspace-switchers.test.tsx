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
  it("collapsed: role-tile-only trigger that keeps the role as its accessible name", () => {
    actAs("helper")
    renderWithTooltips(<RoleSwitcher variant="row" collapsed />)

    const trigger = screen.getByRole("button", { name: "Helper" })
    expect(trigger).not.toHaveTextContent("Helper")
    expect(trigger.querySelector('[data-slot="role-icon"] [data-role-glyph="helper"]')).not.toBeNull()
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

  it("row variant: the role tile and the Private tile are the same white bordered tile", () => {
    renderWithTooltips(
      <>
        <RoleSwitcher variant="row" />
        <ProjectSwitcher variant="row" />
      </>,
    )

    const roleTile = screen
      .getByRole("button", { name: /user/i })
      .querySelector('[data-slot="role-icon"]')!
    const privateTrigger = screen.getByRole("button", { name: /private/i })
    const privateTile = privateTrigger.querySelector('[data-slot="private-context-icon"]')!

    for (const tile of [roleTile, privateTile]) {
      const classes = tile.className.split(/\s+/)
      for (const expected of ["bg-card", "border", "border-border-subtle", "rounded-md", "w-6", "h-6"]) {
        expect(classes).toContain(expected)
      }
    }
    // Identical container: only the glyph inside differs.
    expect(privateTile.className).toBe(roleTile.className)
    // The lock no longer sits on the grey fill.
    expect(privateTile.className).not.toContain("bg-muted")
    expect(privateTile.querySelector(".fi-rr-lock")).not.toBeNull()

    // The Private row has the same geometry as the role row.
    expect(privateTrigger.className).toContain("h-10")
    expect(privateTrigger.className).toContain("bg-card")
    expect(privateTrigger.className).toContain("rounded-lg")
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

  it("row variant: outlined nav-style rows with a single down arrow and a role tile", () => {
    renderWithTooltips(
      <>
        <RoleSwitcher variant="row" />
        <ProjectSwitcher variant="row" />
      </>,
    )

    const role = screen.getByRole("button", { name: /admin/i })
    const project = screen.getByRole("button", { name: /alpha/i })
    for (const trigger of [role, project]) {
      expect(trigger.className).toContain("h-10")
      expect(trigger.className).toContain("rounded-lg")
      expect(trigger.className).toContain("hover:bg-surface-hover")
      // Subtle stroke on a white (card) fill.
      expect(trigger.className).toContain("border-border-subtle")
      expect(trigger.className).toContain("bg-card")
      expect(trigger.querySelector(".fi-rr-angles-up-down")).toBeNull()
      expect(trigger.querySelectorAll(".fi-rr-angle-small-down")).toHaveLength(1)
      // Icon slot, label, selector: the selector is the last child (right-aligned).
      expect(trigger.children).toHaveLength(3)
      expect(trigger.children[0].className).toContain("w-6")
      expect(trigger.children[1].className).toContain("font-medium")
      expect(trigger.children[1].className).toContain("text-sm")
      expect(trigger.children[1].className).toContain("text-foreground")
    }
    // The role tile: white bordered 24px tile with the role's icon in the foreground colour.
    const tile = role.querySelector('[data-slot="role-icon"]')!
    expect(tile.className).toContain("bg-card")
    expect(tile.className).toContain("rounded-md")
    expect(tile.className).toContain("border-border-subtle")
    expect(tile.className).toContain("text-foreground")
    // The Githelp maintainer glyph, not a Flaticon stand-in.
    expect(tile.querySelector('svg[data-role-glyph="admin"]')).not.toBeNull()
    expect(tile.querySelector(".fi")).toBeNull()

    // Each role in the menu gets its tile too.
    fireEvent.keyDown(role, { key: "Enter" })
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.querySelector('[data-slot="role-icon"]')).not.toBeNull()
    }
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })

    // The dropdown still opens from the keyboard.
    fireEvent.keyDown(project, { key: "Enter" })
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0)
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
