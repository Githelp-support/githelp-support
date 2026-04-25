"use client"

import {
  ChevronDown,
  ChevronsLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import { usePathname } from "next/navigation"
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
  return <i className={cn("fi", iconClass, className)} />
}

// Corner radius map: 1/2.55 of the element pixel size
// w-5=20px→8px, w-6=24px→9px, w-[33px]=33px→13px, w-8=32px→13px
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": "rounded-[8px]",
  "w-6 h-6": "rounded-[9px]",
  "w-[33px] h-[33px]": "rounded-[10px]",
  "w-8 h-8": "rounded-[13px]",
}

// Project Logo Component with Avatar Placeholder
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

  if (logoUrl) {
    return (
      <Avatar className={cn(size, radius)}>
        <AvatarImage src={logoUrl} alt={projectName} />
        <AvatarFallback className={cn("bg-brand-primary text-white text-xs font-[family-name:var(--font-outfit)]", radius)}>
          {firstLetter}
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Avatar className={cn(size, radius)}>
      <AvatarFallback className={cn("bg-brand-primary text-white text-xs font-[family-name:var(--font-outfit)]", radius)}>
        {firstLetter}
      </AvatarFallback>
    </Avatar>
  )
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(["Settings"])
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
    setSelectedProjectId(project.project_id)
  }

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName) ? prev.filter((item) => item !== itemName) : [...prev, itemName],
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
    { name: "Profile", href: "/helper/profile", icon: "fi-rr-user" },
    { name: "Support", href: "/helper/support", icon: "fi-rr-comments" },
    { name: "Tickets", href: "/tickets", icon: "fi-rr-comments" },
    { name: "Reports", href: "/helper/reports", icon: "fi-rr-document" },
    { name: "Settings", href: "/helper/settings", icon: "fi-rr-settings" },
  ]

  const userNavigationItems: NavigationItem[] = [
    { name: "Profile", href: "#", icon: "fi-rr-user" },
    { name: "Support", href: "/support/chat", icon: "fi-rr-comments" },
    { name: "Tickets", href: "/support/tickets", icon: "fi-rr-list" },
    { name: "Reports", href: "#", icon: "fi-rr-document" },
    { name: "Settings", href: "#", icon: "fi-rr-settings" },
  ]

  const getNavigationItems = () => {
    if (user.role === "helper") return helperNavigationItems
    if (user.role === "user") return userNavigationItems
    return adminNavigationItems
  }

  const navigationItems = getNavigationItems()

  const bottomItems = [
    { name: "Documentation", href: "#", icon: "fi-rr-book-alt" },
    { name: "Help", href: "/help", icon: "fi-rr-interrogation" },
  ]

  const isItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => pathname === subItem.href)
    }
    return pathname === item.href
  }

  const isSubItemActive = (href: string) => pathname === href

  // Shared row class: 22px tall with 18px gap between icon + label, applies a 14px tracked label
  const navRowBase =
    "flex items-center h-[22px] gap-[18px] text-[14px] tracking-[-0.28px] font-semibold transition-colors"

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border-subtle transition-all duration-300 overflow-hidden",
        isCollapsed ? "w-16" : "w-[280px]",
        className,
      )}
    >
      {/* Top line: Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center pt-6 pb-4",
          isCollapsed ? "justify-center px-3" : "justify-between px-5",
        )}
      >
        {isCollapsed ? (
          selectedProject ? (
            <ProjectLogo
              logoUrl={getProjectLogo(selectedProject, selectedProjectBranding)}
              projectName={selectedProject.name}
              size="w-8 h-8"
            />
          ) : (
            <Logo className="w-8 h-8 text-foreground" />
          )
        ) : (
          <>
            <Logo className="w-8 h-8 text-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto hover:bg-transparent"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="w-6 h-6 text-text-tertiary" />
            </Button>
          </>
        )}
      </div>

      {isCollapsed && (
        <div className="px-3 pb-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto hover:bg-transparent"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-text-tertiary" />
          </Button>
        </div>
      )}

      {/* Project switcher */}
      {!isCollapsed && (
        <div className="px-3 pb-6">
          {!isAuthenticated ? (
            <div className="w-full px-5 py-3.5 bg-bg-subtle rounded-[10px]">
              <Button variant="outline" size="sm" className="w-full text-brand-primary" asChild>
                <Link href={`/auth/signin?redirect=${encodeURIComponent(pathname || "/")}`}>
                  Sign in
                </Link>
              </Button>
            </div>
          ) : projectsLoading ? (
            <div className="w-full flex items-center justify-center h-[63px] bg-bg-subtle rounded-[10px]">
              <div className="text-sm text-text-tertiary">Loading projects...</div>
            </div>
          ) : userProjects.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-[18px] h-[63px] px-5 bg-bg-subtle hover:bg-muted rounded-[10px] transition-colors"
                >
                  <div className="flex items-center gap-[18px] min-w-0 flex-1">
                    <ProjectLogo
                      logoUrl={getProjectLogo(selectedProject, selectedProjectBranding)}
                      projectName={selectedProject?.name || ""}
                      size="w-[33px] h-[33px]"
                    />
                    <span className="text-[16px] font-semibold tracking-[-0.32px] text-text-heading truncate">
                      {selectedProject?.name || "Select Project"}
                    </span>
                  </div>
                  <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
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
                  className="text-brand-primary text-[16px] tracking-[-0.32px]"
                  onClick={() => { if (typeof window !== "undefined") window.location.href = "/onboarding" }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add new
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full px-5 py-3.5 bg-bg-subtle rounded-[10px]">
              <div className="text-sm text-text-tertiary mb-2">No projects yet</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-brand-primary"
                onClick={() => { if (typeof window !== "undefined") window.location.href = "/onboarding" }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {navigationItems.map((item) => {
            const isActive = isItemActive(item)
            const isExpanded = expandedItems.includes(item.name)
            const leafActive = !item.subItems && isActive
            const itemColor = leafActive
              ? "text-brand-primary"
              : isActive
                ? "text-text-heading"
                : "text-text-muted hover:text-text-heading"

            return (
              <div key={item.name} className="flex flex-col gap-6">
                {item.subItems ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.name)}
                    className={cn(
                      navRowBase,
                      "w-full cursor-pointer",
                      isCollapsed ? "justify-center" : "px-5",
                      itemColor,
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <FlaticonIcon iconClass={item.icon} className="text-[22px] leading-none flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.name}</span>
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 flex-shrink-0 text-text-muted transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <Link href={item.href}>
                    <div
                      className={cn(
                        navRowBase,
                        isCollapsed ? "justify-center" : "px-5",
                        itemColor,
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <FlaticonIcon iconClass={item.icon} className="text-[22px] leading-none flex-shrink-0" />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>
                  </Link>
                )}

                {item.subItems && !isCollapsed && isExpanded && (
                  <div className="relative flex flex-col gap-1 px-5">
                    {/* Vertical line connecting bullet points */}
                    <div
                      aria-hidden
                      className="absolute left-[30px] top-[18px] bottom-[18px] w-px bg-border-subtle"
                    />
                    {item.subItems.map((subItem) => {
                      const isSubActive = isSubItemActive(subItem.href)
                      return (
                        <Link key={subItem.name} href={subItem.href} className="block relative">
                          {/* Bullet point — filled for active, hollow for inactive */}
                          <span
                            aria-hidden
                            className={cn(
                              "absolute left-[6px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full z-10",
                              isSubActive
                                ? "bg-brand-primary"
                                : "bg-card border border-text-tertiary",
                            )}
                          />
                          <div
                            className={cn(
                              "flex items-center text-[14px] tracking-[-0.28px] rounded-[10px] pl-[40px] transition-colors",
                              isSubActive
                                ? "bg-brand-primary/10 text-brand-primary font-semibold py-4"
                                : "text-text-tertiary hover:text-text-muted font-normal py-2.5",
                            )}
                          >
                            {subItem.name}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Bottom items: Documentation / Help */}
      <div className="flex flex-col gap-5 px-3 pb-5 pt-4">
        {bottomItems.map((item) => {
          const isActive = item.href !== "#" && pathname === item.href
          const rowClass = cn(
            navRowBase,
            "cursor-pointer",
            isCollapsed ? "justify-center" : "px-5",
            isActive ? "text-brand-primary" : "text-text-muted hover:text-text-heading",
          )
          const content = (
            <>
              <FlaticonIcon iconClass={item.icon} className="text-[22px] leading-none flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </>
          )
          return item.href !== "#" ? (
            <Link
              key={item.name}
              href={item.href}
              className={rowClass}
              title={isCollapsed ? item.name : undefined}
            >
              {content}
            </Link>
          ) : (
            <div key={item.name} className={rowClass} title={isCollapsed ? item.name : undefined}>
              {content}
            </div>
          )
        })}
      </div>

      {/* Profile footer */}
      <div
        className={cn(
          "flex items-center border-t border-border-subtle p-5",
          isCollapsed ? "justify-center gap-0" : "gap-[18px]",
        )}
      >
        <Avatar className="w-12 h-12 rounded-[16px] flex-shrink-0">
          <AvatarFallback className="bg-avatar-5 text-text-heading text-[18px] rounded-[16px] font-[family-name:var(--font-outfit)]">
            {user.avatar}
          </AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.34px] text-text-heading truncate">
              {user.name}
            </div>
            <div className="text-[12px] tracking-[-0.24px] text-text-tertiary truncate">
              Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Component to render project logo with branding in dropdown
function ProjectLogoWithBranding({
  project,
  isSelected,
  onSelect,
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
      className={cn(
        "text-[16px] tracking-[-0.32px]",
        isSelected ? "bg-brand-primary/10 text-brand-primary" : "",
      )}
    >
      <ProjectLogo
        logoUrl={logoUrl}
        projectName={project.name}
        size="w-5 h-5"
      />
      <span className="ml-2 truncate">{project.name}</span>
    </DropdownMenuItem>
  )
}
