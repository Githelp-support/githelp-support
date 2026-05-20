"use client"

import { Bell, ChevronDown, ArrowLeft, Info } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { NotificationsPanel, type Notification } from "./notifications-panel"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { logoutUser } from "@/lib/supabase/auth"
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format"
import type { UserRole } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { useProjectRole } from "@/hooks/useProjectRole"

interface HeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backButtonText?: string
  backButtonHref?: string
  info?: string
}

export function Header({ title, subtitle, showBackButton = false, backButtonText, backButtonHref, info }: HeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const pathname = usePathname()
  const { selectedProjectId } = useProjectSelection()
  const { data: projectRoleFromProject } = useProjectRole(selectedProjectId ?? undefined)
  const { user, switchRole, setProjectRole } = useUser()
  const router = useRouter()

  // Sync project role from selected project when on project-scoped pages (not support).
  // Support pages set their own projectRole from the support project.
  useEffect(() => {
    if (pathname?.startsWith("/support")) return
    if (selectedProjectId && projectRoleFromProject) {
      setProjectRole(projectRoleFromProject)
    } else if (!selectedProjectId) {
      setProjectRole(null)
    }
  }, [pathname, selectedProjectId, projectRoleFromProject, setProjectRole])

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

  const handleBackClick = () => {
    if (backButtonHref) {
      router.push(backButtonHref)
    } else {
      router.back()
    }
  }

  const getRoleDisplayName = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  const getAvailableRoles = (): UserRole[] => {
    const projectRole = user.projectRole
    
    // If no project role, only allow "user" role (support users without projects)
    if (!projectRole) {
      // Only show "user" if current role is not already "user"
      if (user.role !== "user") {
        return ["user"]
      }
      return []
    }

    // Define role hierarchy: admin > helper > user
    const roleHierarchy: Record<UserRole, number> = {
      admin: 2,
      helper: 1,
      user: 0,
    }

    const projectRoleLevel = roleHierarchy[projectRole] || 0
    const currentRoleLevel = roleHierarchy[user.role] || 0

    // Get all roles at or below the project role level
    // Allow "user" role (level 0) for all project roles
    const allowedRoles: UserRole[] = []
    if (projectRoleLevel >= 2) allowedRoles.push("admin")
    if (projectRoleLevel >= 1) allowedRoles.push("helper")
    // Always allow "user" role (level 0) regardless of project role
    allowedRoles.push("user")

    // Filter out current role and return
    return allowedRoles.filter((role) => role !== user.role)
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-background px-8 pt-5 pb-6">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-start gap-4">
            {showBackButton && (
              <button
                onClick={handleBackClick}
                className="mt-1 p-1 hover:bg-muted rounded-md transition-colors cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                {backButtonText && (
                  <span className="text-sm text-muted-foreground hover:text-foreground font-medium">{backButtonText}</span>
                )}
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-[0.005em] text-foreground">{title}</h1>
                {info && (
                  <div className="relative group">
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-2 bg-foreground text-background text-sm rounded-md shadow-lg pointer-events-none">
                      {info}
                      <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-foreground" />
                    </div>
                  </div>
                )}
              </div>
              {subtitle && <p className="mt-0.5 text-[13px] font-normal text-muted-foreground/80">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-1 hover:bg-muted rounded-md transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#55555E]" strokeWidth={1.95} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 rounded-[11px]">
                <AvatarFallback className="bg-brand-primary text-white text-sm rounded-[11px] font-medium">{user.avatar}</AvatarFallback>
              </Avatar>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer">
                  <span className="text-sm text-muted-foreground">Role: {getRoleDisplayName(user.role)}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {getAvailableRoles().length > 0 ? (
                    <>
                      {getAvailableRoles().map((role) => (
                        <DropdownMenuItem key={role} onClick={() => switchRole(role)} className="cursor-pointer">
                          {getRoleDisplayName(role)}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await logoutUser()
                        router.push("/auth/signin")
                      } catch (error) {
                        console.error("Logout error:", error)
                      }
                    }}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotificationClick={handleNotificationClick}
      />
    </>
  )
}
