"use client"

import {
  ChevronDown,
  ChevronsLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useUserProjects, useProjectBranding } from "@/hooks/useProject"
import { useProjectSelection } from "@/contexts/project-context"
import { Logo } from "@/components/brand/logo"
import type { Database } from "@/types/database"

interface SidebarProps {
  className?: string
}

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface NavigationItem {
  name: string
  href: string
  icon: string
  subItems?: NavigationItem[]
}

// Flaticon Icon Component
const FlaticonIcon = ({ iconClass, className }: { iconClass: string; className?: string }) => {
  return (
    <i
      className={`fi ${iconClass} inline-flex items-center justify-center leading-none ${className || ""}`}
    />
  )
}

// Corner radius map: 11/32 of the element pixel size (matches Helpers table avatar on Overview page)
// w-5=20px→7px, w-6=24px→8px, w-8=32px→11px
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": "rounded-[7px]",
  "w-6 h-6": "rounded-[8px]",
  "w-8 h-8": "rounded-[11px]",
}

// Project Logo Component with Avatar Placeholder.
// The AvatarFallback (colored shape with first letter) is ALWAYS rendered,
// so the default "DP" icon shows whenever the project has no logo or while
// branding is still loading. AvatarImage is only mounted when we actually
// have a non-empty logo URL, ensuring the fallback never gets gated behind
// the branding fetch.
//
// We key the Radix Avatar Root on `logoUrl|projectName` so it fully remounts
// whenever the project changes. Radix's Avatar keeps an internal
// `imageLoadingStatus` state on the Root; without remounting, transitioning
// from a project with a logo to one without (or between logos that resolve
// at different speeds) can leave the state stuck at "loaded" — at which
// point AvatarFallback won't render and the icon visually disappears.
const ProjectLogo = ({
  logoUrl,
  projectName,
  size = "w-6 h-6",
}: {
  logoUrl: string | null | undefined
  projectName: string
  size?: string
}) => {
  const firstLetter = projectName?.[0]?.toUpperCase() || "?"
  const radius = sizeRadiusMap[size] || "rounded-[9px]"
  const hasLogo = typeof logoUrl === "string" && logoUrl.length > 0

  return (
    <Avatar key={`${logoUrl ?? ""}|${projectName}`} className={`${size} ${radius}`}>
      {hasLogo ? <AvatarImage src={logoUrl as string} alt={projectName} /> : null}
      <AvatarFallback className={`bg-brand-primary text-white text-xs ${radius} font-[family-name:var(--font-outfit)]`}>
        {firstLetter}
      </AvatarFallback>
    </Avatar>
  )
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  // The Sidebar is mounted per-page (not in a shared layout), so its state
  // is wiped on every navigation. Derive the initially-expanded parent from
  // the current path so the active sub-item's parent stays expanded across
  // sub-item clicks and on hard refresh.
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (pathname?.startsWith("/reports/")) return ["Reports"]
    if (pathname?.startsWith("/settings/")) return ["Settings"]
    if (pathname?.startsWith("/helper/settings/")) return ["Settings"]
    if (pathname?.startsWith("/user/settings/")) return ["Settings"]
    return []
  })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { user } = useUser()
  const isAuthenticated = !!user?.id
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjects()
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection()
  
  const selectedProject = userProjects.find((p) => p.project_id === selectedProjectId) || userProjects[0]

  // Fetch branding for selected project
  const { data: selectedProjectBranding } = useProjectBranding(selectedProject?.project_id || "")

  // If we have projects but no selection yet, pick the first project.
  // (ProjectProvider also does this, but this keeps Sidebar resilient if mounted alone somewhere.)
  // Only run when projects finish loading and we have no selection
  useEffect(() => {
    if (projectsLoading) return
    if (userProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(userProjects[0].project_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when length/selection changes, not array reference
  }, [projectsLoading, userProjects.length, selectedProjectId, setSelectedProjectId])

  // Get project logo from branding
  const getProjectLogo = (project: Project | undefined, branding: { logo_url?: string | null } | null | undefined) => {
    if (!project) return null
    return branding?.logo_url ?? null
  }

  const handleProjectSelect = (project: Project) => {
    const isDifferentProject = project.project_id !== selectedProjectId
    setSelectedProjectId(project.project_id)
    if (isDifferentProject) {
      router.push("/")
    }
  }

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName) ? prev.filter((item) => item !== itemName) : [itemName],
    )
  }

  const adminNavigationItems: NavigationItem[] = [
    { name: "Overview", href: "/", icon: "fi-rr-apps" },
    { name: "Helpers", href: "/helpers", icon: "fi-rr-user" },
    { name: "Tickets", href: "/tickets", icon: "fi-rr-comments" },
    { name: "SLAs", href: "/slas", icon: "fi-rr-star-octogram" },
    {
      name: "Reports",
      href: "#",
      icon: "fi-rr-document",
      subItems: [
        { name: "Support", href: "/reports/support", icon: "fi-rr-comments" },
        { name: "SLAs", href: "/reports/slas", icon: "fi-rr-star-octogram" },
      ],
    },
    // { name: "Availability", href: "#", icon: "fi-rr-list-check" },
    { name: "Landing page", href: "/landing-page", icon: "fi-rr-browser" },
    {
      name: "Settings",
      href: "#",
      icon: "fi-rr-settings",
      subItems: [
        { name: "Payment", href: "/settings/payment", icon: "fi-rr-credit-card" },
        { name: "Profile", href: "/settings/profile", icon: "fi-rr-user" },
        { name: "Project", href: "/settings/project", icon: "fi-rr-folder" },
        { name: "Branding", href: "/settings/branding", icon: "fi-rr-paint-brush" },
      ],
    },
  ]

  const helperNavigationItems: NavigationItem[] = [
    { name: "Overview", href: "/helper/overview", icon: "fi-rr-apps" },
    { name: "Tickets", href: "/tickets", icon: "fi-rr-comments" },
    { name: "Reports", href: "/helper/reports", icon: "fi-rr-document" },
    {
      name: "Settings",
      href: "#",
      icon: "fi-rr-settings",
      subItems: [
        { name: "Profile", href: "/helper/settings/profile", icon: "fi-rr-user" },
        { name: "Availability", href: "/helper/settings/availability", icon: "fi-rr-list-check" },
      ],
    },
  ]

  const userNavigationItems: NavigationItem[] = [
    { name: "Tickets", href: "/support/tickets", icon: "fi-rr-list" },
    { name: "Support", href: "/support/chat", icon: "fi-rr-comments" },
    { name: "Reports", href: "/user/reports", icon: "fi-rr-document" },
    {
      name: "Settings",
      href: "#",
      icon: "fi-rr-settings",
      subItems: [
        { name: "Profile", href: "/settings/profile", icon: "fi-rr-user" },
        { name: "Payment", href: "#", icon: "fi-rr-credit-card" },
        { name: "Notifications", href: "/user/settings/notifications", icon: "fi-rr-bell" },
      ],
    },
  ]

  const getNavigationItems = () => {
    if (user.role === "helper") return helperNavigationItems
    if (user.role === "user") return userNavigationItems
    return adminNavigationItems
  }

  const navigationItems = getNavigationItems()

  // When `user.role` changes (e.g., via the header role dropdown), the shape of
  // `navigationItems` changes too. `expandedItems` is only seeded once at mount,
  // so without this effect we could keep a parent expanded that no longer exists
  // in the new role's nav, or miss the active sub-item's parent. Recompute the
  // expansion against the current role's `navigationItems` + `pathname`.
  // The active highlight (`isItemActive` / `isSubItemActive`) is derived from
  // `pathname` on every render via `navigationItems`, so it stays in sync
  // automatically — this effect only fixes the imperative expansion state.
  useEffect(() => {
    let next: string[] = []
    for (const item of navigationItems) {
      if (!item.subItems) continue
      const matched = item.subItems.some(
        (sub) => pathname === sub.href || (pathname?.startsWith(sub.href + "/") ?? false),
      )
      if (matched) {
        next = [item.name]
        break
      }
    }
    setExpandedItems((prev) => {
      // Preserve reference equality when unchanged to avoid an extra re-render
      // (notably on the initial mount where `useState` already seeded the same value).
      if (prev.length === next.length && prev.every((n, i) => n === next[i])) {
        return prev
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-run on role change; navigationItems/pathname are read from the latest render closure
  }, [user.role])

  const bottomItems = [
    { name: "Documentation", href: "#", icon: "fi-rr-book-alt" },
    { name: "Help", href: "/help", icon: "fi-rr-interrogation" },
  ]

  const isItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      // Parent items with sub-items should never receive the active highlight;
      // only the active sub-item itself is marked.
      return false
    }
    return pathname === item.href
  }

  const isSubItemActive = (href: string) => pathname === href

  return (
    <div
      className={`${isCollapsed ? "w-16" : "w-64"} border-r border-sidebar-border flex flex-col transition-all duration-300 h-full overflow-hidden ${className}`}
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-between min-h-[40px]">
        {isCollapsed ? (
          selectedProject ? (
            <ProjectLogo
              logoUrl={getProjectLogo(selectedProject, selectedProjectBranding)}
              projectName={selectedProject.name}
              size="w-8 h-8"
            />
          ) : (
            <Logo className="text-sidebar-foreground" />
          )
        ) : (
          <Logo className="text-sidebar-foreground" />
        )}
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronsLeft className="w-5 h-5" />
          </Button>
        )}
      </div>

      {isCollapsed && (
        <div className="px-3 pb-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}

      {!isCollapsed && (
        <div className="px-3 pb-3">
          {!isAuthenticated ? (
            <div className="w-full px-3 py-2.5 bg-bg-subtle border border-sidebar-border rounded-lg">
              <Button variant="outline" size="sm" className="w-full text-brand-primary" asChild>
                <Link href={`/auth/signin?redirect=${encodeURIComponent(pathname || "/")}`}>
                  Sign in
                </Link>
              </Button>
            </div>
          ) : projectsLoading ? (
            <div className="w-full flex items-center justify-center px-3 py-2.5 min-h-[44px] bg-bg-subtle border border-sidebar-border rounded-lg">
              <div className="text-sm text-muted-foreground">Loading projects...</div>
            </div>
          ) : userProjects.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] bg-bg-subtle border border-sidebar-border hover:border-brand-primary/30 hover:bg-muted rounded-lg transition-colors focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ProjectLogo
                      logoUrl={getProjectLogo(selectedProject, selectedProjectBranding)}
                      projectName={selectedProject?.name || ""}
                      size="w-6 h-6"
                    />
                    <span className="text-sm font-[550] text-sidebar-foreground truncate">
                      {selectedProject?.name || "Select Project"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {userProjects.map((project) => {
                  const isSelected = selectedProject?.project_id === project.project_id
                  return (
                    <ProjectLogoWithBranding
                      key={project.project_id}
                      project={project}
                      isSelected={isSelected}
                      onSelect={handleProjectSelect}
                    />
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-brand-primary"
                  onClick={() => { if (typeof window !== "undefined") window.location.href = "/onboarding" }}
                >
                  <Plus className="w-4 h-4" />
                  Add new
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full px-3 py-2.5 bg-bg-subtle border border-sidebar-border rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">No projects yet</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-brand-primary"
                onClick={() => { if (typeof window !== "undefined") window.location.href = "/onboarding" }}
              >
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 px-3 pb-3 overflow-hidden min-h-0">
        <div className="space-y-0.5">
          {navigationItems.map((item) => {
            const isActive = isItemActive(item)
            const isExpanded = expandedItems.includes(item.name)
            const activeClasses = "bg-brand-primary/10 text-brand-primary"
            const inactiveClasses = "text-[#55555E] hover:bg-bg-subtle hover:text-sidebar-foreground"

            return (
              <div key={item.name}>
                {item.subItems ? (
                  <div>
                    <div
                      className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!isExpanded) setExpandedItems([item.name])
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !isExpanded) {
                            e.preventDefault()
                            setExpandedItems([item.name])
                          }
                        }}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <FlaticonIcon iconClass={item.icon} />
                        </span>
                        {!isCollapsed && <span>{item.name}</span>}
                      </div>
                      {!isCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(item.name)
                          }}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name}`}
                          className="shrink-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                        >
                          <ChevronRight
                            className={`h-4 w-4 opacity-70 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      )}
                    </div>
                    {!isCollapsed && isExpanded && (
                      <div className="relative mt-0.5 space-y-0.5">
                        {/* Vertical guide line, centered under the parent icon column.
                            Clamped to start/end at the center of the first/last dot. */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-[22px] top-[20px] bottom-[20px] w-px -translate-x-1/2 bg-border-subtle"
                        />
                        {item.subItems.map((subItem) => {
                          const isSubActive = isSubItemActive(subItem.href)
                          return (
                            <Link key={subItem.name} href={subItem.href}>
                              <div
                                className={`relative flex items-center pl-11 pr-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors ${
                                  isSubActive ? activeClasses : "text-[#818185] hover:bg-bg-subtle hover:text-sidebar-foreground"
                                }`}
                              >
                                {/* Sub-category marker, centered on the vertical line */}
                                <span
                                  aria-hidden="true"
                                  className={`absolute left-[22px] top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${
                                    isSubActive ? "bg-brand-primary" : "bg-border-subtle"
                                  }`}
                                />
                                {subItem.name}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link href={item.href} onClick={() => setExpandedItems([])}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <FlaticonIcon iconClass={item.icon} />
                      </span>
                      {!isCollapsed && item.name}
                    </div>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      <div className="px-3 py-2.5 border-t border-sidebar-border space-y-0.5">
        {bottomItems.map((item) => {
          const isActive = item.href !== "#" && pathname === item.href
          const className = `flex items-center gap-3 px-3 py-2.5 min-h-[40px] text-sm font-medium rounded-md cursor-pointer transition-colors ${
            isActive ? "bg-bg-subtle text-sidebar-foreground" : "text-[#55555E] hover:bg-bg-subtle hover:text-sidebar-foreground"
          }`
          const content = (
            <>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <FlaticonIcon iconClass={item.icon} />
              </span>
              {!isCollapsed && item.name}
            </>
          )
          return item.href !== "#" ? (
            <Link
              key={item.name}
              href={item.href}
              className={className}
              title={isCollapsed ? item.name : undefined}
            >
              {content}
            </Link>
          ) : (
            <div key={item.name} className={className} title={isCollapsed ? item.name : undefined}>
              {content}
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2.5 border-t border-sidebar-border">
        <div className={`flex items-center gap-4 px-2 py-1.5 rounded-md ${isCollapsed ? "justify-center" : ""}`}>
          <Avatar className="w-8 h-8 rounded-[11px] shrink-0">
            <AvatarFallback className="bg-brand-primary text-white text-sm rounded-[11px] font-medium">{user.avatar}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{user.name}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1 truncate">
                Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Component to render project logo with branding in dropdown
function ProjectLogoWithBranding({ 
  project, 
  isSelected, 
  onSelect 
}: { 
  project: Project
  isSelected: boolean
  onSelect: (project: Project) => void
}) {
  const { data: branding } = useProjectBranding(project.project_id)
  const logoUrl = branding?.logo_url ?? null

  return (
    <DropdownMenuItem
      onClick={() => onSelect(project)}
      className={`group gap-2 ${isSelected ? "bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary" : ""}`}
    >
      <ProjectLogo
        logoUrl={logoUrl}
        projectName={project.name}
        size="w-5 h-5"
      />
      <span
        className={`truncate text-sm ${
          isSelected
            ? "font-[500]"
            : "font-medium text-[#55555E] group-focus:text-sidebar-foreground"
        }`}
      >
        {project.name}
      </span>
    </DropdownMenuItem>
  )
}
