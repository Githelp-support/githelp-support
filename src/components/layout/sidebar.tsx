"use client"

import { Icon } from "@/components/ui/icon"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useRef, useState } from "react"
import { useUser } from "@/contexts/user-context"
import { SignInLink } from "@/components/auth/sign-in-link"
import { isSupportRoute } from "@/lib/sign-in-href"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Logo } from "@/components/brand/logo"
import { RoleSwitcher, ProjectSwitcher } from "@/components/layout/workspace-switchers"
import { useWorkspaceSwitcher } from "@/hooks/useWorkspaceSwitcher"
import { NotificationsPanel } from "@/components/layout/notifications-panel"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from "@/hooks/useNotifications"
import { cn } from "@/lib/utils"
import { Fragment, type ReactElement } from "react"

interface SidebarProps {
  className?: string
  /** When provided, renders a discrete "Open project page" external link above the bottom items. */
  projectPageHref?: string
  /** Inside the mobile sheet the sidebar is always expanded and has no collapse toggle. */
  forceExpanded?: boolean
}

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

// Menu icons sit one step lighter than their label at rest (`text-tertiary`
// against the `text-muted` label, still above 4.5:1 on the sidebar surface), so
// the label carries the hierarchy. The row sets `--nav-icon`; on hover it
// resolves to `currentColor`, and active rows never set it, so the icon then
// follows the label colour (foreground on hover, brand purple when active).
const NAV_ICON_REST = "[--nav-icon:var(--text-tertiary)] hover:[--nav-icon:currentColor]"
const NAV_ROW_REST = `font-book text-text-muted hover:bg-surface-hover hover:text-foreground ${NAV_ICON_REST}`
const NAV_ICON_CLASS =
  "flex h-4 w-4 shrink-0 items-center justify-center text-base text-[color:var(--nav-icon,currentColor)] transition-colors duration-fast ease-out"

// Sub-pages of the user-role "Support" parent item. Exact paths only —
// /support/tickets belongs to the top-level "Tickets" item and must NOT
// expand "Support".
const SUPPORT_SUB_PATHS = [
  "/support/chat",
  "/support/rates",
  "/support/resources",
  "/support/about",
]

export function Sidebar({ className, projectPageHref, forceExpanded = false }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Preserve the active chat context (project/ticket) when navigating between
  // Support sub-pages so e.g. "Chat" reopens the conversation the user was in.
  const supportQuery = (() => {
    const preserved = new URLSearchParams()
    const project = searchParams?.get("project")
    const ticket = searchParams?.get("ticket")
    if (project) preserved.set("project", project)
    if (ticket) preserved.set("ticket", ticket)
    const qs = preserved.toString()
    return qs ? `?${qs}` : ""
  })()
  // Seed the expanded parent from the current path so the active sub-item's
  // parent is open on first render and on hard refresh. (AppShell mounts the
  // Sidebar once, so this state now survives client-side navigation.)
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (pathname?.startsWith("/reports/")) return ["Reports"]
    if (pathname?.startsWith("/settings/")) return ["Settings"]
    if (pathname?.startsWith("/helper/settings/")) return ["Settings"]
    if (pathname?.startsWith("/user/settings/")) return ["Settings"]
    if (pathname && SUPPORT_SUB_PATHS.includes(pathname)) return ["Support"]
    return []
  })
  // Persist collapsed state across reloads. Read localStorage synchronously
  // in the initializer so the first client render already has the right
  // width. On the server `window` is undefined so we fall back to `false`;
  // the root element uses `suppressHydrationWarning` so the server/client
  // class difference on first paint doesn't warn.
  const [storedCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem("sidebar:collapsed") === "true"
    } catch {
      return false
    }
  })
  const isCollapsed = forceExpanded ? false : storedCollapsed
  const { user } = useUser()
  const isAuthenticated = !!user?.id
  // Guarded sign-out (prompts on unsaved changes), shared with the TopBar.
  const { signOut } = useWorkspaceSwitcher()

  // Inbox (notifications). The realtime subscription and its toasts stay in
  // the TopBar, which is mounted once; the sidebar only reads the list.
  const [isInboxOpen, setIsInboxOpen] = useState(false)
  const inboxButtonRef = useRef<HTMLButtonElement>(null)
  const { data: notificationsData } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications: Notification[] = notificationsData || []
  const unreadCount = notifications.filter((n) => !n.is_read).length
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount)

  const setCollapsed = (next: boolean) => {
    setIsCollapsed(next)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("sidebar:collapsed", String(next))
      } catch {
        // Ignore localStorage write errors.
      }
    }
  }

  // Collapsed rows have no visible label: show it in a tooltip to the right.
  const withTooltip = (label: string, node: ReactElement) =>
    isCollapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    ) : (
      node
    )

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
        { name: "Integrations", href: "/settings/integrations", icon: "fi-rr-plug" },
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
        { name: "Payout", href: "/helper/settings/payout", icon: "fi-rr-credit-card" },
        { name: "Profile", href: "/helper/settings/profile", icon: "fi-rr-user" },
        { name: "Availability", href: "/helper/settings/availability", icon: "fi-rr-list-check" },
        { name: "Notifications", href: "/helper/settings/notifications", icon: "fi-rr-bell" },
      ],
    },
  ]

  const userNavigationItems: NavigationItem[] = [
    { name: "Overview", href: "/user/overview", icon: "fi-rr-apps" },
    {
      name: "Support",
      href: "#",
      icon: "fi-rr-comments",
      subItems: [
        { name: "Chat", href: `/support/chat${supportQuery}`, icon: "fi-rr-comments" },
        { name: "Rates and details", href: `/support/rates${supportQuery}`, icon: "fi-rr-credit-card" },
        { name: "Resources", href: `/support/resources${supportQuery}`, icon: "fi-rr-folder" },
        { name: "About support", href: `/support/about${supportQuery}`, icon: "fi-rr-info" },
      ],
    },
    { name: "Tickets", href: "/support/tickets", icon: "fi-rr-list" },
    { name: "Reports", href: "/user/reports", icon: "fi-rr-document" },
    {
      name: "Settings",
      href: "#",
      icon: "fi-rr-settings",
      subItems: [
        { name: "Payment", href: "/user/settings/payment", icon: "fi-rr-credit-card" },
        { name: "Profile", href: "/settings/profile", icon: "fi-rr-user" },
        { name: "Notifications", href: "/user/settings/notifications", icon: "fi-rr-bell" },
      ],
    },
  ]

  // A guest (anonymous support visitor) only gets the public support
  // routes: protected ones would bounce them to sign-in without saving their
  // guest session for adoption (the Sign in link below does that).
  // No "Tickets" either: a guest has no ticket list.
  const guestNavigationItems = userNavigationItems.filter((item) =>
    item.subItems
      ? item.subItems.every((sub) => sub.href.startsWith("/support"))
      : item.href.startsWith("/support") && item.href !== "/support/tickets",
  )

  const getNavigationItems = () => {
    if (!user.id && user.guestId) return guestNavigationItems
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
  // automatically — this only fixes the imperative expansion state. It runs
  // during render (not in an effect) so the new role's nav never paints with
  // the old role's expansion. It also runs on the first render, since the
  // useState seed above only knows a few path prefixes.
  // The Sidebar is mounted once (AppShell), so the same recompute also runs
  // when the pathname changes: a link elsewhere, a redirect or back/forward
  // into a sub-page must expand its parent like a click on the sub-item does.
  const [expansionKey, setExpansionKey] = useState<{ role: typeof user.role; pathname: string | null } | null>(null)
  if (!expansionKey || expansionKey.role !== user.role || expansionKey.pathname !== pathname) {
    setExpansionKey({ role: user.role, pathname })
    let next: string[] = []
    for (const item of navigationItems) {
      if (!item.subItems) continue
      const matched = item.subItems.some((sub) => {
        // Sub-item hrefs may carry preserved query params (e.g. the Support
        // sub-pages); match on the path portion only.
        const subPath = sub.href.split("?")[0]
        return pathname === subPath || (pathname?.startsWith(subPath + "/") ?? false)
      })
      if (matched) {
        next = [item.name]
        break
      }
    }
    if (expandedItems.length !== next.length || expandedItems.some((n, i) => n !== next[i])) {
      setExpandedItems(next)
    }
  }

  // "Documentation" used to sit here as an inert placeholder; only real
  // destinations are listed now.
  const bottomItems = [
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

  // Sub-item hrefs may carry preserved query params (e.g. the Support
  // sub-pages); compare against the path portion only.
  const isSubItemActive = (href: string) => pathname === href.split("?")[0]

  const profileAvatar = (
    <ProfileAvatar id={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
  )

  const signOutItem = (
    <DropdownMenuItem className="cursor-pointer" onSelect={() => signOut()}>
      <Icon name="fi-rr-sign-out-alt" />
      Sign out
    </DropdownMenuItem>
  )

  return (
    <div
      suppressHydrationWarning
      // `self-stretch` (not `h-full`) sizes the sidebar from the AppShell row's
      // laid-out height (a `flex-1 min-h-0` chain, where percentage heights don't
      // resolve). The row fills the whole screen (the TopBar sits in the content
      // column beside the sidebar, not above it), so the sidebar spans from the
      // very top to the bottom and the profile block stays pinned to the bottom.
      className={`${isCollapsed ? "w-16" : "w-64"} bg-sidebar border-r border-sidebar-border flex flex-col transition-[width] duration-slow ease-in-out self-stretch overflow-hidden shrink-0 ${className}`}
    >
      {isCollapsed ? (
        <>
          {/* Header row: same height as the mobile TopBar, with 5px extra space below it. */}
          <div className="mb-1.25 flex h-15 shrink-0 items-center justify-center px-4">
            {withTooltip(
              "Expand sidebar",
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={() => setCollapsed(false)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-fast ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              >
                <Logo />
              </button>,
            )}
          </div>
          {/* Guests have no role or project. The switcher centres its own
              logo-only trigger; `empty:hidden` drops the padding when it
              renders nothing (no projects). */}
          {isAuthenticated && (
            <div className="px-4 pb-3 shrink-0 empty:hidden">
              <ProjectSwitcher collapsed />
            </div>
          )}
        </>
      ) : (
        // Switcher rows: the role row (with the logo in its icon slot) and the
        // project row, built like the nav rows below so the logo, the project
        // avatar and the nav icons share one axis. The first row is centred on
        // the mobile TopBar's height (14px + 32px + 14px). Both rows end before
        // the collapse control, so their selector icons line up.
        <div
          className={cn(
            "flex shrink-0 items-start gap-1 px-4 pt-3.5",
            // Guests only get the logo: keep the old header height above the Sign in card.
            isAuthenticated ? "pb-3" : "mb-1.25 h-15",
            // Mobile sheet: keep the rows clear of the sheet's Close button.
            forceExpanded && "pr-12",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {isAuthenticated ? (
              <>
                <RoleSwitcher variant="row" leading={<Logo />} />
                <ProjectSwitcher variant="row" />
              </>
            ) : (
              <div className="flex h-8 items-center px-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <Logo />
                </span>
              </div>
            )}
          </div>
          {!forceExpanded && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Collapse sidebar"
              className="h-8 w-8 shrink-0 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              onClick={() => setCollapsed(true)}
            >
              <SidebarToggleIcon />
            </Button>
          )}
        </div>
      )}

      {/* Hairline between the switchers and the menu, inset to the rows' padding. */}
      {isAuthenticated && (
        <div
          aria-hidden="true"
          data-slot="sidebar-switcher-divider"
          className={cn("mb-3 h-px shrink-0 bg-sidebar-border", isCollapsed ? "mx-4" : "mx-6.5")}
        />
      )}

      {!isCollapsed && !isAuthenticated && (
        <div className="px-4 pb-3 shrink-0">
          <div className="w-full px-3 py-2.5 bg-bg-subtle border border-sidebar-border rounded-lg">
            <Button variant="outline" size="sm" className="w-full text-brand-primary" asChild>
              <SignInLink
                redirectTo={
                  // Support routes carry their project / ticket in the query.
                  isSupportRoute(pathname) && searchParams?.toString()
                    ? `${pathname}?${searchParams.toString()}`
                    : pathname || "/"
                }
              >
                Sign in
              </SignInLink>
            </Button>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 px-4 pb-3 overflow-hidden min-h-0">
        <div className="space-y-1">
          {isAuthenticated && (
            <div>
              {forceExpanded ? (
                // Mobile sheet: the sheet is modal, so the Inbox opens the full
                // notifications page (the sheet closes on navigation).
                <Link
                  href="/notifications"
                  className={cn(
                    "flex items-center gap-3 h-8 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
                    pathname === "/notifications"
                      ? "bg-brand-primary/[0.08] font-medium text-brand-primary"
                      : NAV_ROW_REST,
                  )}
                >
                  <span className={NAV_ICON_CLASS}>
                    <FlaticonIcon iconClass="fi-rr-inbox" />
                  </span>
                  <span className="flex-1">Inbox</span>
                  {unreadCount > 0 && (
                    <span
                      data-slot="inbox-count"
                      className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-primary px-1 text-2xs font-medium tabular-nums text-brand-foreground"
                    >
                      {unreadLabel}
                    </span>
                  )}
                </Link>
              ) : (
                withTooltip(
                  "Inbox",
                  <button
                    ref={inboxButtonRef}
                    type="button"
                    aria-label={unreadCount > 0 ? `Inbox, ${unreadLabel} unread` : "Inbox"}
                    aria-expanded={isInboxOpen}
                    onClick={() => setIsInboxOpen((prev) => !prev)}
                    className={cn(
                      "relative w-full flex items-center h-8 px-2.5 rounded-md text-ui cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 font-book text-text-muted hover:bg-surface-hover hover:text-foreground " + NAV_ICON_REST,
                      isCollapsed ? "justify-center" : "gap-3",
                    )}
                  >
                    <span className={NAV_ICON_CLASS}>
                      <FlaticonIcon iconClass="fi-rr-inbox" />
                    </span>
                    {!isCollapsed && <span className="flex-1 text-left">Inbox</span>}
                    {/* The unread count shows only above zero: at the far right
                        when expanded, as a corner badge when collapsed. */}
                    {unreadCount > 0 && (
                      <span
                        data-slot="inbox-count"
                        className={cn(
                          "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-primary px-1 text-2xs font-medium tabular-nums text-brand-foreground",
                          isCollapsed && "absolute right-1 top-0",
                        )}
                      >
                        {unreadLabel}
                      </span>
                    )}
                  </button>,
                )
              )}
            </div>
          )}
          {navigationItems.map((item) => {
            const isActive = isItemActive(item)
            const isExpanded = expandedItems.includes(item.name)
            const activeClasses = "bg-brand-primary/[0.08] font-medium text-brand-primary"
            const inactiveClasses = NAV_ROW_REST
            // Whether any sub-item under this parent matches the current path —
            // used in collapsed mode to highlight the parent icon since the
            // sub-items themselves are hidden behind a dropdown.
            const hasActiveSubItem = item.subItems?.some((sub) => isSubItemActive(sub.href)) ?? false

            return (
              <div key={item.name}>
                {item.subItems ? (
                  isCollapsed ? (
                    // Collapsed: open sub-items as a hovering dropdown menu to
                    // the right of the sidebar (matches the role dropdown UX).
                    <DropdownMenu>
                      <Tooltip>
                      <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={item.name}
                          className={`w-full flex items-center justify-center h-8 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                            hasActiveSubItem ? activeClasses : inactiveClasses
                          }`}
                        >
                          <span className={NAV_ICON_CLASS}>
                            <FlaticonIcon iconClass={item.icon} />
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.name}
                      </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="w-48"
                      >
                        {item.subItems.map((subItem) => {
                          const isSubActive = isSubItemActive(subItem.href)
                          return (
                            <DropdownMenuItem
                              key={subItem.name}
                              asChild
                              className={`cursor-pointer ${
                                isSubActive
                                  ? "bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary"
                                  : ""
                              }`}
                            >
                              <Link href={subItem.href}>{subItem.name}</Link>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div>
                      <div
                        className={`w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                          isActive ? activeClasses : inactiveClasses
                        }`}
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
                          <span className={NAV_ICON_CLASS}>
                            <FlaticonIcon iconClass={item.icon} />
                          </span>
                          <span>{item.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(item.name)
                          }}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name}`}
                          className="shrink-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                        >
                          <Icon name="fi-rr-angle-small-right" className={`opacity-70 transition-transform duration-base ease-out ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                      </div>
                      {/* Sub-items stay mounted; the height animates with grid-template-rows and
                          the collapsed branch is inert so it is skipped by Tab and screen readers. */}
                      <div
                        data-state={isExpanded ? "open" : "closed"}
                        inert={!isExpanded}
                        className={`grid transition-[grid-template-rows] duration-base ease-out ${
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                        <div className="relative mt-1 space-y-1">
                          {/* Vertical guide line, centered under the parent icon column.
                              Clamped to start/end at the center of the first/last dot. */}
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-[18px] top-4 bottom-4 w-px -translate-x-1/2 bg-border-subtle"
                          />
                          {item.subItems.map((subItem) => {
                            const isSubActive = isSubItemActive(subItem.href)
                            return (
                              <Link key={subItem.name} href={subItem.href} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40">
                                <div
                                  className={`relative flex items-center h-8 pl-9 pr-2.5 rounded-md text-ui transition-colors duration-fast ease-out ${
                                    isSubActive ? activeClasses : NAV_ROW_REST
                                  }`}
                                >
                                  {/* Sub-category marker, centered on the vertical line */}
                                  <span
                                    aria-hidden="true"
                                    className={`absolute left-[18px] top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${
                                      isSubActive ? "bg-brand-primary" : "bg-border-subtle"
                                    }`}
                                  />
                                  {subItem.name}
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  withTooltip(
                    item.name,
                  <Link href={item.href} onClick={() => setExpandedItems([])}>
                    <div
                      className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-8 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                    >
                      <span className={NAV_ICON_CLASS}>
                        <FlaticonIcon iconClass={item.icon} />
                      </span>
                      {!isCollapsed && item.name}
                    </div>
                  </Link>,
                  )
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Inset line above the bottom items. */}
      <div aria-hidden="true" className="mx-4 h-px shrink-0 bg-sidebar-border" />
      <div className="px-4 py-2.5 space-y-1 shrink-0">
        {projectPageHref &&
          withTooltip(
            "Open project page",
          <a
            href={projectPageHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center h-8 px-2.5 text-ui rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 font-book text-text-muted hover:bg-surface-hover hover:text-foreground " + NAV_ICON_REST,
              isCollapsed ? "justify-center" : "gap-3",
            )}
          >
            <span className={NAV_ICON_CLASS}>
              <FlaticonIcon iconClass="fi-rr-browser" />
            </span>
            {!isCollapsed && "Open project page"}
          </a>,
          )}
        {bottomItems.map((item) => {
          const isActive = pathname === item.href
          const className = `flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-8 px-2.5 text-ui rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
            isActive ? "bg-brand-primary/[0.08] font-medium text-brand-primary" : NAV_ROW_REST
          }`
          return (
            <Fragment key={item.name}>
            {withTooltip(
            item.name,
            <Link
              href={item.href}
              className={className}
            >
              <span className={NAV_ICON_CLASS}>
                <FlaticonIcon iconClass={item.icon} />
              </span>
              {!isCollapsed && item.name}
            </Link>,
          )}
            </Fragment>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-sidebar-border shrink-0">
        {isCollapsed ? (
          <div className="flex items-center justify-center px-2 py-1.5">
            {isAuthenticated ? (
              // Collapsed: the avatar opens the account menu so Sign out stays reachable.
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                  >
                    {profileAvatar}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-40">
                  {signOutItem}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              profileAvatar
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md">
            {profileAvatar}
            <div className="flex-1 min-w-0 text-sm font-medium text-sidebar-foreground truncate">{user.name}</div>
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Account menu"
                    className="h-7 w-7 shrink-0 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                  >
                    <Icon name="fi-rr-angle-small-down" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-40">
                  {signOutItem}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {isAuthenticated && !forceExpanded && (
        <NotificationsPanel
          isOpen={isInboxOpen}
          onClose={() => setIsInboxOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={() => markAllRead.mutateAsync()}
          // Navigation is handled inside the panel; this only marks the row read.
          onNotificationClick={(notification) => {
            if (!notification.is_read) void markNotificationRead.mutateAsync(notification.id)
          }}
          anchorRef={inboxButtonRef}
          placement="right"
        />
      )}
    </div>
  )
}
