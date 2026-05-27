"use client"

import { Bell, ChevronDown, Check, Plus } from "lucide-react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logoutUser } from "@/lib/supabase/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/brand/logo"
import { NotificationsPanel, type Notification } from "./notifications-panel"
import { useUser, type UserRole } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { useUserProjects, useProjectBranding } from "@/hooks/useProject"
import { useUserMaxRole } from "@/hooks/useProjectRole"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format"
import type { Database } from "@/types/database"

type Project = Database["public"]["Tables"]["projects"]["Row"]

// Corner radius map: 11/32 of the element pixel size (matches sidebar avatar sizing)
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": "rounded-[7px]",
  "w-[22px] h-[22px]": "rounded-[8px]",
  "w-6 h-6": "rounded-[8px]",
  "w-8 h-8": "rounded-[11px]",
}

// Project Logo Component with Avatar Placeholder.
// See sidebar.tsx for the full rationale on keying the Radix Avatar Root.
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

export function TopBar() {
  const router = useRouter()
  const { user, switchRole } = useUser()
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection()
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjects()
  const { data: maxUserRole } = useUserMaxRole()

  const selectedProject = userProjects.find((p) => p.project_id === selectedProjectId) || userProjects[0]
  const { data: selectedProjectBranding } = useProjectBranding(selectedProject?.project_id || "")

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const bellButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch notifications
  const { data: notificationsData } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  // Transform notifications to UI format
  const notifications: Notification[] = (notificationsData || []).map((notif) => ({
    id: notif.id,
    title: notif.title,
    type: (notif.metadata?.type || "INFO") as "SUPPORT_TICKET" | "HELPER_REQUEST" | "NEW_PAYOUT" | "INFO",
    content: notif.content,
    route: notif.route || "#",
    timestamp: formatRelativeTime(notif.created_at),
    isRead: notif.is_read,
  }))

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleMarkAllAsRead = async () => {
    await markAllRead.mutateAsync()
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markNotificationRead.mutateAsync(notification.id)
    }
    if (notification.route && notification.route !== "#") {
      router.push(notification.route)
    }
  }

  const getProjectLogo = (
    project: Project | undefined,
    branding: { logo_url?: string | null } | null | undefined,
  ) => {
    if (!project) return null
    return branding?.logo_url ?? null
  }

  const handleProjectSelect = (project: Project) => {
    const isDifferentProject = project.project_id !== selectedProjectId
    setSelectedProjectId(project.project_id)
    if (isDifferentProject) {
      if (user.role === "admin") {
        router.push("/")
      } else if (user.role === "helper") {
        router.push("/helper/overview")
      } else if (user.role === "user") {
        router.push("/support/tickets")
      }
    }
  }

  const getRoleDisplayName = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  const handleSwitchRole = (role: UserRole) => {
    switchRole(role)
    if (role === "admin") {
      router.push("/")
    } else if (role === "helper") {
      router.push("/helper/overview")
    } else if (role === "user") {
      router.push("/support/tickets")
    }
  }

  const isSignedIn = Boolean(user.id)

  const handleAuthClick = async () => {
    if (isSignedIn) {
      try {
        await logoutUser()
      } catch (error) {
        console.error("Sign out failed:", error)
      }
    } else {
      router.push("/auth/signin")
    }
  }

  const getAvailableRoles = (): UserRole[] => {
    // Available roles must reflect what the profile is permitted to assume
    // across ALL of their projects — not the role for the currently selected
    // project (which can be cleared/lowered when navigating, e.g. to /support
    // pages where the user is acting as "user"). Using a per-page projectRole
    // here previously caused other roles to disappear after switching to user,
    // making it impossible to switch back.
    const profileMaxRole: UserRole | null = maxUserRole ?? user.projectRole ?? null

    // If the profile has no project membership at all, only "user" is offered
    // (support users without projects).
    if (!profileMaxRole) {
      return ["user"]
    }

    // Define role hierarchy: admin > helper > user
    const roleHierarchy: Record<UserRole, number> = {
      admin: 2,
      helper: 1,
      user: 0,
    }

    const profileRoleLevel = roleHierarchy[profileMaxRole] || 0

    const allowedRoles: UserRole[] = []
    if (profileRoleLevel >= 2) allowedRoles.push("admin")
    if (profileRoleLevel >= 1) allowedRoles.push("helper")
    allowedRoles.push("user")

    return allowedRoles
  }

  return (
    <>
      <div className="sticky top-0 z-40 w-full bg-[#FAFAFA] border-b border-border px-8 py-3 flex items-center justify-between">
        {/* Left cluster: Logo, Role dropdown, Project dropdown */}
        <div className="flex items-center gap-4">
          <Logo />

          {/* Role dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer font-sans">
              <span className="font-sans text-[14px] text-muted-foreground">{getRoleDisplayName(user.role)}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {getAvailableRoles().length > 0 ? (
                <>
                  {getAvailableRoles().map((role) => {
                    const isCurrent = role === user.role
                    return (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => handleSwitchRole(role)}
                        className="cursor-pointer flex items-center justify-between"
                      >
                        <span>{getRoleDisplayName(role)}</span>
                        {isCurrent && <Check className="w-4 h-4 text-muted-foreground" />}
                      </DropdownMenuItem>
                    )
                  })}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Project dropdown — only available to Admin and Helper roles.
              Users don't have a project context, so we hide it for the User role. */}
          {user.role === "user" ? null : projectsLoading ? (
            <div className="flex items-center justify-center px-3 h-9 bg-bg-subtle border border-sidebar-border rounded-lg">
              <div className="font-sans text-[14px] text-muted-foreground">Loading projects...</div>
            </div>
          ) : userProjects.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 px-3 h-9 bg-bg-subtle border border-sidebar-border hover:border-brand-primary/30 hover:bg-muted rounded-lg transition-colors focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProjectLogo
                      logoUrl={getProjectLogo(selectedProject, selectedProjectBranding)}
                      projectName={selectedProject?.name || ""}
                      size="w-[22px] h-[22px]"
                    />
                    <span className="font-sans text-[14px] font-[550] text-sidebar-foreground truncate">
                      {selectedProject?.name || "Select Project"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 font-sans"
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
                  className="font-sans text-[14px] text-brand-primary"
                  onClick={() => {
                    if (typeof window !== "undefined") window.location.href = "/onboarding"
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add new
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Right cluster: Sign in/out, Bell, Avatar */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={handleAuthClick}
            className="font-sans text-[14px] text-muted-foreground hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer"
          >
            {isSignedIn ? "Sign out" : "Sign in"}
          </button>
          <button
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="relative p-1 mt-[2px] hover:bg-muted rounded-md transition-colors cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px] text-[#55555E]" strokeWidth={1.95} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-destructive text-white text-[11.25px] rounded-full w-[18px] h-[18px] flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <Avatar className="w-7 h-7 rounded-[10px]">
            <AvatarFallback className="bg-brand-primary text-white text-sm rounded-[10px] font-medium">{user.avatar}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotificationClick={handleNotificationClick}
        anchorRef={bellButtonRef}
      />
    </>
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
      className={`group gap-2 ${isSelected ? "bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary" : ""}`}
    >
      <ProjectLogo logoUrl={logoUrl} projectName={project.name} size="w-5 h-5" />
      <span
        className={`font-sans truncate text-[14px] ${
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
