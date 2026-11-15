"use client"

import { Icon } from "@/components/ui/icon"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { Logo } from "@/components/brand/logo"
import { MobileNavToggle } from "@/components/layout/mobile-nav"
import { RoleSwitcher, ProjectSwitcher } from "@/components/layout/workspace-switchers"
import { NotificationsPanel } from "./notifications-panel"
import type { Notification } from "@/hooks/useNotifications"
import { getSupportSignInRedirect } from "@/lib/support-sign-in-redirect"
import { saveRegisteredSupportDraft } from "@/lib/support-draft"
import { isSupportRoute } from "@/lib/sign-in-href"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { useWorkspaceSwitcher } from "@/hooks/useWorkspaceSwitcher"
import { rememberLastProjectForRole } from "@/lib/roles"
import { cn } from "@/lib/utils"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications"
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications"

interface TopBarProps {
  /**
   * `default`: the full bar (logo, role, project, Sign out, bell, avatar) for
   * routes outside the app shell. `shell`: the bar at the top of the shell's
   * content column, beside the full-height sidebar. It omits the role and
   * project switchers and Sign out, keeping the bell and avatar, plus the menu
   * button and logo below `lg`, where the sidebar is an off-canvas sheet (on
   * desktop the logo belongs to the sidebar).
   */
  variant?: "default" | "shell"
}

export function TopBar({ variant = "default" }: TopBarProps) {
  const isShell = variant === "shell"
  const router = useRouter()
  const pathname = usePathname()
  const { confirmNavigation } = useUnsavedChanges()
  const {
    user,
    isSignedIn,
    selectedProjectId,
    projectAvailableRoles,
    projectRolesLoaded,
    availableRoles,
    rolesResolved,
    handleSwitchRole,
    signOut,
  } = useWorkspaceSwitcher()

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

  // Sign-out is guarded inside the hook so an unsaved page prompts before the
  // session is torn down or the user is sent to the sign-in page.
  const handleAuthClick = () => {
    if (isSignedIn) {
      signOut()
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

  // Remember, per role, the project the account last worked in.
  useEffect(() => {
    if (user.role === "user" || !selectedProjectId || !projectRolesLoaded) return
    if (projectAvailableRoles?.includes(user.role)) {
      rememberLastProjectForRole(user.role, selectedProjectId)
    }
  }, [user.role, selectedProjectId, projectRolesLoaded, projectAvailableRoles])

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
      <div
        className={cn(
          "sticky top-0 z-40 w-full min-h-[60px] bg-sidebar border-b border-border px-4 md:px-8 py-3 flex items-center justify-between gap-2",
          // In the shell the left cluster is hidden on desktop, so the right one is pushed to the end.
          isShell && "lg:justify-end",
        )}
      >
        {isShell ? (
          // Left cluster (below lg only): menu, Logo. On desktop the logo lives in the sidebar.
          <div className="flex min-w-0 items-center gap-2 md:gap-4 lg:hidden">
            <MobileNavToggle />
            <Logo />
          </div>
        ) : (
          // Left cluster: menu (below lg), Logo, Role dropdown, Project dropdown
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <MobileNavToggle />
            <Logo />

            <RoleSwitcher />
            <ProjectSwitcher />
          </div>
        )}

        {/* Right cluster: Sign in/out (default variant only), Bell, Avatar */}
        <div className="flex shrink-0 items-center gap-2 md:gap-5">
          {!isShell && (
            <button
              type="button"
              onClick={handleAuthClick}
              className="font-sans text-ui text-muted-foreground hover:bg-surface-hover rounded-md px-2 py-1 transition-colors duration-fast ease-out cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            >
              {isSignedIn ? "Sign out" : "Sign in"}
            </button>
          )}
          <button
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="relative p-1 mt-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
          >
            <Icon name="fi-rr-bell" className="[--icon-size:18px] text-text-muted" />
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
