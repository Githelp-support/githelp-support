"use client"

import { Bell, ChevronDown, Check, Plus, Lock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { logoutUser } from "@/lib/supabase/auth"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/brand/logo"
import { MobileNavToggle } from "@/components/layout/mobile-nav"
import { NotificationsPanel } from "./notifications-panel"
import type { Notification } from "@/hooks/useNotifications"
import { useUser, type UserRole } from "@/contexts/user-context"
import { getSupportSignInRedirect } from "@/lib/support-sign-in-redirect"
import { saveRegisteredSupportDraft } from "@/lib/support-draft"
import { isSupportRoute } from "@/lib/sign-in-href"
import { useProjectSelection } from "@/contexts/project-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { useUserProjects, useProjectBranding } from "@/hooks/useProject"
import {
  useProjectAvailableRoles,
  projectAvailableRolesQueryOptions,
  roleProjectIdsQueryOptions,
  useUserRoles,
} from "@/hooks/useProjectRole"
import {
  homeRouteForRole,
  getLastProjectForRole,
  pickProjectForRole,
  rememberLastProjectForRole,
  clearAccountUiState,
} from "@/lib/roles"
import { toast } from "sonner"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications"
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications"
import type { Database } from "@/types/database"
import { SQUIRCLE_RADIUS, squircleRadiusClass } from "@/lib/constants"

type Project = Database["public"]["Tables"]["projects"]["Row"]

// Corner radius per size class, from the shared squircle map (about 34% of the size).
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": SQUIRCLE_RADIUS[20],
  "w-[22px] h-[22px]": SQUIRCLE_RADIUS[22],
  "w-6 h-6": SQUIRCLE_RADIUS[24],
  "w-8 h-8": SQUIRCLE_RADIUS[32],
}

// Project Logo Component with Avatar Placeholder.
// See sidebar.tsx for the full rationale on keying the Radix Avatar Root.
const ProjectLogo = ({
  logoUrl,
  projectName,
  size = "w-6 h-6",
  primaryColor,
}: {
  logoUrl: string | null | undefined
  projectName: string
  size?: string
  primaryColor?: string | null
}) => {
  const firstLetter = projectName?.[0]?.toUpperCase() || "?"
  const radius = sizeRadiusMap[size] || squircleRadiusClass(0)
  const hasLogo = typeof logoUrl === "string" && logoUrl.length > 0

  return (
    <Avatar key={`${logoUrl ?? ""}|${projectName}`} className={`${size} ${radius}`}>
      {hasLogo ? <AvatarImage src={logoUrl as string} alt={projectName} /> : null}
      <AvatarFallback
        className={`${primaryColor ? "" : "bg-brand-primary"} text-brand-foreground text-xs ${radius} font-[family-name:var(--font-outfit)]`}
        style={primaryColor ? { backgroundColor: primaryColor } : undefined}
      >
        {firstLetter}
      </AvatarFallback>
    </Avatar>
  )
}

// Avatar-sized stand-in for the private user context in the project control.
const PrivateContextIcon = ({ size }: { size: string }) => (
  <span
    className={`${size} ${sizeRadiusMap[size] || squircleRadiusClass(0)} shrink-0 flex items-center justify-center bg-muted text-muted-foreground`}
  >
    <Lock className="w-3 h-3" strokeWidth={2.2} />
  </span>
)

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { user, switchRole } = useUser()
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection()
  const { confirmNavigation } = useUnsavedChanges()
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjects()
  const { data: userRoles, isSuccess: userRolesLoaded } = useUserRoles()

  const selectedProject = userProjects.find((p) => p.project_id === selectedProjectId) || userProjects[0]
  const { data: projectAvailableRoles, isSuccess: projectRolesLoaded } = useProjectAvailableRoles(
    selectedProject?.project_id,
  )
  const { data: selectedProjectBranding } = useProjectBranding(selectedProject?.project_id || "")

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const bellButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch notifications; the realtime subscription keeps the bell live and
  // fires a toast on new rows.
  useRealtimeNotifications()
  const { data: notificationsData } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications: Notification[] = notificationsData || []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleMarkAllAsRead = async () => {
    await markAllRead.mutateAsync()
  }

  // Navigation on click is handled inside NotificationsPanel (it owns the
  // per-type route overrides); this callback only marks the row read.
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationRead.mutateAsync(notification.id)
    }
  }

  const getProjectLogo = (
    project: Project | undefined,
    branding: { logo_url?: string | null } | null | undefined,
  ) => {
    if (!project) return null
    return branding?.logo_url ?? null
  }

  const routeForRole = (role: UserRole) => {
    router.push(homeRouteForRole(role))
  }

  const handleProjectSelect = async (project: Project) => {
    const isDifferentProject = project.project_id !== selectedProjectId
    setSelectedProjectId(project.project_id)
    if (!isDifferentProject) return

    // Always land in the HIGHEST role the user holds in the newly selected
    // project (e.g. helper in A → admin in B switches to admin; admin in A →
    // helper-only in B switches to helper). Roles come back ordered
    // admin > helper > user, and fetchQuery shares the switcher's cache.
    let nextRole: UserRole = "user"
    try {
      const roles = await queryClient.fetchQuery(projectAvailableRolesQueryOptions(project.project_id))
      nextRole = roles[0] ?? "user"
    } catch (error) {
      console.error("Failed to resolve roles for project:", error)
    }
    if (nextRole !== user.role) switchRole(nextRole)
    routeForRole(nextRole)
  }

  const getRoleDisplayName = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  // Both the role change and the redirect run inside the unsaved-changes
  // guard so choosing "Stay" leaves the current role and page untouched.
  const handleSwitchRole = (role: UserRole) => {
    confirmNavigation(() => {
      // Leaving the private User context for admin/helper: open the project
      // last used in that role (see pickProjectForRole for the fallbacks).
      if (user.role === "user" && role !== "user") {
        void enterRoleFromPrivate(role)
        return
      }
      switchRole(role)
      routeForRole(role)
    })
  }

  const enterRoleFromPrivate = async (role: "admin" | "helper") => {
    try {
      const ids = await queryClient.fetchQuery(roleProjectIdsQueryOptions())
      // Keep the project list's order and drop projects it doesn't contain
      // (deleted ones) — ProjectProvider rejects selections outside the list.
      const candidates = userProjects
        .map((p) => p.project_id)
        .filter((id) => ids[role].includes(id))
      const projectId = pickProjectForRole(candidates, getLastProjectForRole(role), selectedProjectId)
      if (!projectId) {
        toast.error(`You don't have the ${getRoleDisplayName(role)} role in any project.`)
        return
      }
      setSelectedProjectId(projectId)
      switchRole(role)
      routeForRole(role)
    } catch (error) {
      console.error("Failed to resolve project for role:", error)
      toast.error("Couldn't switch role. Please try again.")
    }
  }

  const isSignedIn = Boolean(user.id)

  const signOut = async () => {
    try {
      await logoutUser()
      // Drop per-account UI state (role, selected project, last project per
      // role, pending redirect) so the next account on this browser starts
      // clean instead of flashing the previous user's navigation.
      clearAccountUiState()
      // Force a clean reload to /auth/signin so no partially-viewable
      // portal remains, regardless of the user's role. The hard redirect is
      // covered by the guard's beforeunload handler.
      if (typeof window !== "undefined") {
        window.location.href = "/auth/signin"
      } else {
        router.push("/auth/signin")
      }
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  // Guarded so an unsaved page prompts before the session is torn down or
  // the user is sent to the sign-in page.
  const handleAuthClick = () => {
    if (isSignedIn) {
      confirmNavigation(() => {
        void signOut()
      })
    } else if (isSupportRoute(pathname)) {
      // Visitor on a support page: come back to it (or its conversation, the
      // same target as the guest banner). startGuestSignIn saves the guest
      // session for adoption when the session is this browser's own guest —
      // checked on the session itself, not user.guestId, which can lag.
      const here =
        getSupportSignInRedirect() ??
        (typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname ?? "/support")
      confirmNavigation(() => {
        saveRegisteredSupportDraft()
        // Loaded lazily: it pulls in the Supabase client.
        void import("@/lib/guest-adoption").then(({ startGuestSignIn }) =>
          startGuestSignIn(here, (href) => router.push(href)),
        )
      })
    } else {
      confirmNavigation(() => router.push("/auth/signin"))
    }
  }

  // Admin/helper are scoped to the SELECTED project (keyed by the persisted
  // selected project id — not the per-page projectRole, which gets
  // cleared/lowered on /support pages), and limited to the role categories
  // the profile is ACTUALLY registered for. "User" is always offered: every
  // account has a private user context to act in. Ordered admin → helper → user.
  const availableRoles: UserRole[] = useMemo(() => {
    const registered = userRolesLoaded && userRoles && userRoles.length > 0 ? userRoles : null
    let roles: UserRole[]
    if (!projectAvailableRoles) {
      // No projects at all (support-only users) or queries still loading:
      // fall back to the global registrations, then to the active role so
      // the dropdown is never empty.
      roles = registered ?? [user.role]
    } else if (!registered) {
      roles = projectAvailableRoles
    } else {
      const scoped = projectAvailableRoles.filter((role) => registered.includes(role))
      roles = scoped.length > 0 ? scoped : projectAvailableRoles
    }
    return roles.includes("user") ? roles : [...roles, "user"]
  }, [userRolesLoaded, userRoles, projectAvailableRoles, user.role])

  const rolesResolved =
    userRolesLoaded && !projectsLoading && (!selectedProject || projectRolesLoaded)

  // Acting as User = acting in the private user context, whatever projects the
  // account belongs to. Users get a context dropdown ("Private" today; later
  // also employers they are verified to operate under) instead of the project
  // dropdown, and it lists no projects. The role dropdown is therefore the
  // way back to a project: it keeps offering the admin/helper roles held in
  // the remembered project, plus "+ New role" (User role only).
  const isPrivateContext = user.role === "user"
  const [employerTipOpen, setEmployerTipOpen] = useState(false)

  // Role dropdown contents. In a project (admin/helper) it lists the roles
  // held in that project. In the private User context there is no project, so
  // it lists every role the account holds in ANY project; picking one opens
  // the project last used in that role.
  const visibleRoles: UserRole[] = useMemo(() => {
    if (!isPrivateContext) return availableRoles
    const held = userRolesLoaded && userRoles ? userRoles : []
    return [...(["admin", "helper"] as const).filter((r) => held.includes(r)), "user"]
  }, [isPrivateContext, availableRoles, userRolesLoaded, userRoles])

  // Remember, per role, the project the account last worked in.
  useEffect(() => {
    if (user.role === "user" || !selectedProjectId || !projectRolesLoaded) return
    if (projectAvailableRoles?.includes(user.role)) {
      rememberLastProjectForRole(user.role, selectedProjectId)
    }
  }, [user.role, selectedProjectId, projectRolesLoaded, projectAvailableRoles])

  const goToAddRole = () => {
    if (typeof window !== "undefined") window.location.href = "/onboarding?new=1"
  }

  // Once roles are resolved, if the current role isn't one the profile holds,
  // switch to the first available role (e.g. a freshly registered helper
  // lands in the Helper view instead of the default User view).
  useEffect(() => {
    if (!isSignedIn || !rolesResolved || availableRoles.length === 0) return
    if (!availableRoles.includes(user.role)) {
      handleSwitchRole(availableRoles[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, rolesResolved, availableRoles, user.role])

  if (!isSignedIn) return null

  // The "I am acting as" role chooser is part of the login flow — the user
  // has not picked a role yet, so the nav banner must not be shown there.
  if (pathname === "/auth/role" || pathname?.startsWith("/auth/role/")) return null

  // Hide the top bar on the invite acceptance flow (/invite/[token]) so its
  // full-screen centered cards render without the role/project/notifications
  // banner.
  if (pathname?.startsWith("/invite")) return null

  return (
    <>
      <div className="sticky top-0 z-40 w-full min-h-[60px] bg-sidebar border-b border-border px-4 md:px-8 py-3 flex items-center justify-between gap-2">
        {/* Left cluster: menu (below lg), Logo, Role dropdown, Project dropdown */}
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <MobileNavToggle />
          <Logo />

          {/* Role dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer font-sans">
              <span className="font-sans text-sm text-muted-foreground">{getRoleDisplayName(user.role)}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {visibleRoles.length > 0 ? (
                <>
                  {visibleRoles.map((role) => {
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
              {isPrivateContext && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer font-sans text-sm text-brand-primary"
                    onClick={goToAddRole}
                  >
                    <Plus className="w-4 h-4" />
                    New role
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User context dropdown (User role) — styled like the project
              dropdown. "Private" is the only context today; in time the user
              will be able to switch to an employer they are verified to operate
              under ("Add employer" is a placeholder that explains this on
              hover/tap). No projects and no "Add new" here: projects belong to
              the admin/helper roles. */}
          {isPrivateContext ? (
            <DropdownMenu onOpenChange={(open) => !open && setEmployerTipOpen(false)}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 px-3 h-9 bg-bg-subtle border border-sidebar-border hover:border-brand-primary/30 hover:bg-muted rounded-lg transition-colors focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PrivateContextIcon size="w-[22px] h-[22px]" />
                    <span className="font-sans text-sm font-medium text-sidebar-foreground truncate max-w-[32vw] md:max-w-[16rem]">Private</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 font-sans"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenuItem className="group gap-2 bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary">
                  <PrivateContextIcon size="w-5 h-5" />
                  <span className="font-sans truncate text-sm font-medium">Private</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                  <Tooltip open={employerTipOpen} onOpenChange={setEmployerTipOpen}>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        className="font-sans text-sm text-brand-primary"
                        // Keep the menu open and show the explanation on tap as
                        // well as on hover.
                        onSelect={(e) => {
                          e.preventDefault()
                          setEmployerTipOpen(true)
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add employer
                      </DropdownMenuItem>
                    </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                      >
                        We do not support the possibility to connect your account to an employer at the moment.
                        This functionality will be released in the coming months.
                      </TooltipContent>
                  </Tooltip>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : projectsLoading ? (
            <div className="flex items-center justify-center px-3 h-9 bg-bg-subtle border border-sidebar-border rounded-lg">
              <div className="font-sans text-sm text-muted-foreground">Loading projects...</div>
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
                      primaryColor={selectedProjectBranding?.primary_color}
                    />
                    <span className="font-sans text-sm font-medium text-sidebar-foreground truncate max-w-[32vw] md:max-w-[16rem]">
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
                {/* Scrollable project list — capped at three rows (3 × 32px) so the
                    separator and "Add new" below always stay visible. */}
                <div className={cn("max-h-24 overflow-y-auto")}>
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
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="font-sans text-sm text-brand-primary"
                  onClick={goToAddRole}
                >
                  <Plus className="w-4 h-4" />
                  Add new
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Right cluster: Sign in/out, Bell, Avatar */}
        <div className="flex shrink-0 items-center gap-2 md:gap-5">
          <button
            type="button"
            onClick={handleAuthClick}
            className="font-sans text-ui text-muted-foreground hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer"
          >
            {isSignedIn ? "Sign out" : "Sign in"}
          </button>
          <button
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="relative p-1 mt-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px] text-text-muted" strokeWidth={1.95} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-destructive text-white text-[11.25px] rounded-full w-[18px] h-[18px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <ProfileAvatar
            id={user.id}
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="sm"
          />
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
      <ProjectLogo
        logoUrl={logoUrl}
        projectName={project.name}
        size="w-5 h-5"
        primaryColor={branding?.primary_color}
      />
      <span
        className={`font-sans truncate text-sm ${
          isSelected
            ? "font-medium"
            : "font-medium text-text-muted group-focus:text-sidebar-foreground"
        }`}
      >
        {project.name}
      </span>
    </DropdownMenuItem>
  )
}
