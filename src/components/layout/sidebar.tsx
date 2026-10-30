"use client"

import {
  ChevronsLeft,
  ChevronRight,
} from "lucide-react"
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
import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { SignInLink } from "@/components/auth/sign-in-link"
import { isSupportRoute } from "@/lib/sign-in-href"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReactElement } from "react"

interface SidebarProps {
  className?: string
  /** When provided, renders a discrete "Open project page" external link above the bottom items. */
  projectPageHref?: string
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

// Sub-pages of the user-role "Support" parent item. Exact paths only —
// /support/tickets belongs to the top-level "Tickets" item and must NOT
// expand "Support".
const SUPPORT_SUB_PATHS = [
  "/support/chat",
  "/support/rates",
  "/support/resources",
  "/support/about",
]

export function Sidebar({ className, projectPageHref }: SidebarProps) {
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem("sidebar:collapsed") === "true"
    } catch {
      return false
    }
  })
  const { user } = useUser()
  const isAuthenticated = !!user?.id

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
  const [expansionRole, setExpansionRole] = useState<{ role: typeof user.role } | null>(null)
  if (!expansionRole || expansionRole.role !== user.role) {
    setExpansionRole({ role: user.role })
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

  return (
    <div
      suppressHydrationWarning
      // `self-stretch` (not `h-full`) sizes the sidebar from the AppShell row's
      // laid-out height (a `flex-1 min-h-0` chain, where percentage heights don't
      // resolve), so it always fills the area below the TopBar and the profile
      // block stays pinned to the bottom.
      className={`${isCollapsed ? "w-16" : "w-64"} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 self-stretch overflow-hidden shrink-0 ${className}`}
    >
      <div className={`${isCollapsed ? "justify-center px-0" : "justify-end px-4"} pt-4 pb-3 flex items-center min-h-[40px] shrink-0`}>
        {!isCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            onClick={() => {
              setIsCollapsed(true)
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.setItem("sidebar:collapsed", "true")
                } catch {
                  // Ignore localStorage write errors.
                }
              }
            }}
          >
            <ChevronsLeft className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            onClick={() => {
              setIsCollapsed(false)
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.setItem("sidebar:collapsed", "false")
                } catch {
                  // Ignore localStorage write errors.
                }
              }
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        )}
      </div>

      {!isCollapsed && !isAuthenticated && (
        <div className="px-3 pb-3 shrink-0">
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

      <nav aria-label="Main" className="flex-1 px-3 pb-3 overflow-hidden min-h-0">
        <div className="space-y-0.5">
          {navigationItems.map((item) => {
            const isActive = isItemActive(item)
            const isExpanded = expandedItems.includes(item.name)
            const activeClasses = "bg-surface-active text-foreground [&_i]:text-brand-primary"
            const inactiveClasses = "text-text-muted hover:bg-surface-hover hover:text-foreground"
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
                          className={`w-full flex items-center justify-center h-8 px-2.5 rounded-md text-ui font-medium transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                            hasActiveSubItem ? activeClasses : inactiveClasses
                          }`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base text-text-muted">
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
                        className={`w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-ui font-medium transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
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
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base text-text-muted">
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
                          <ChevronRight
                            className={`h-4 w-4 opacity-70 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="relative mt-0.5 space-y-0.5">
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
                                  className={`relative flex items-center h-8 pl-9 pr-2.5 rounded-md text-ui font-medium transition-colors duration-fast ease-out ${
                                    isSubActive ? activeClasses : "text-text-muted hover:bg-surface-hover hover:text-foreground"
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
                      )}
                    </div>
                  )
                ) : (
                  withTooltip(
                    item.name,
                  <Link href={item.href} onClick={() => setExpandedItems([])}>
                    <div
                      className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-8 px-2.5 rounded-md text-ui font-medium transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base text-text-muted">
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

      <div className="px-3 py-2.5 border-t border-sidebar-border space-y-0.5 shrink-0">
        {projectPageHref &&
          withTooltip(
            "Open project page",
          <a
            href={projectPageHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 h-8 px-2.5 text-ui font-medium rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 text-text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base text-text-muted">
              <FlaticonIcon iconClass="fi-rr-browser" />
            </span>
            {!isCollapsed && "Open project page"}
          </a>,
          )}
        {bottomItems.map((item) => {
          const isActive = pathname === item.href
          const className = `flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-8 px-2.5 text-ui font-medium rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
            isActive ? "bg-surface-active text-foreground [&_i]:text-brand-primary" : "text-text-muted hover:bg-surface-hover hover:text-foreground"
          }`
          return withTooltip(
            item.name,
            <Link
              key={item.name}
              href={item.href}
              className={className}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base text-text-muted">
                <FlaticonIcon iconClass={item.icon} />
              </span>
              {!isCollapsed && item.name}
            </Link>,
          )
        })}
      </div>

      <div className="px-3 py-2.5 border-t border-sidebar-border shrink-0">
        <div className={`flex items-start gap-4 px-2 py-1.5 rounded-md ${isCollapsed ? "justify-center" : ""}`}>
          <ProfileAvatar
            id={user.id}
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="sm"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{user.name}</div>
              <div className="text-xs font-medium text-muted-foreground truncate">
                Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
