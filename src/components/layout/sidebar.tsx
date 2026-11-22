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
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from "react"
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

// The inbox glyph is an open tray: its box is empty at the top, so the drawn
// part sits below the label's optical centre. Nudge only the glyph up by 1px
// (a transform, so the row's layout and the label spacing are unchanged).
const INBOX_ICON_NUDGE = "-translate-y-px"

// Sub-pages of the user-role "Support" parent item. Exact paths only —
// /support/tickets belongs to the top-level "Tickets" item and must NOT
// expand "Support".
// Which sub-menus are open is remembered between visits.
const EXPANDED_STORAGE_KEY = "sidebar:expanded"

const readStoredExpanded = (): string[] => {
  if (typeof window === "undefined") return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(EXPANDED_STORAGE_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : []
  } catch {
    return []
  }
}

// Scrolls `scroller` (and nothing else) by the smallest amount that brings
// `el` fully inside it, clear of the overflow fades (the scroller's
// scroll-padding). Instant: no smooth scrolling.
const scrollIntoNearest = (scroller: HTMLElement, el: Element) => {
  const style = window.getComputedStyle(scroller)
  const padTop = parseFloat(style.scrollPaddingTop) || 0
  const padBottom = parseFloat(style.scrollPaddingBottom) || 0
  const box = scroller.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  if (rect.top < box.top + padTop) {
    scroller.scrollTop -= box.top + padTop - rect.top
  } else if (rect.bottom > box.bottom - padBottom) {
    scroller.scrollTop += rect.bottom - (box.bottom - padBottom)
  }
}

// A helper's ticket chat lives at /helper/tickets/<id>; in the helper menu it
// belongs to the "Chat" sub-item of "Support".
const HELPER_TICKET_PREFIX = "/helper/tickets/"
const HELPER_CHAT_PATH = "/helper/support/chat"

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
    if (pathname?.startsWith("/helper/support/")) return ["Support"]
    // No active sub-page: restore what was open on the last visit.
    return readStoredExpanded()
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedItems))
    } catch {
      // Ignore localStorage write errors.
    }
  }, [expandedItems])
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

  // The ticket a helper has open (/helper/tickets/<id>), or "" anywhere else.
  const helperTicketId =
    user.role === "helper" && pathname?.startsWith(HELPER_TICKET_PREFIX)
      ? pathname.slice(HELPER_TICKET_PREFIX.length).split("/")[0]
      : ""
  // Whether a sub-item (path portion of its href) is the current page.
  const isSubPathActive = (subPath: string) =>
    pathname === subPath || (helperTicketId !== "" && subPath === HELPER_CHAT_PATH)

  const helperNavigationItems: NavigationItem[] = [
    { name: "Overview", href: "/helper/overview", icon: "fi-rr-apps" },
    {
      name: "Support",
      href: "#",
      icon: "fi-rr-comments",
      subItems: [
        { name: "Chat", href: HELPER_CHAT_PATH, icon: "fi-rr-comments" },
        {
          name: "Resources",
          // From a ticket chat, carry the ticket so Resources resolves the same project.
          href: `/helper/support/resources${helperTicketId ? `?ticket=${encodeURIComponent(helperTicketId)}` : ""}`,
          icon: "fi-rr-folder",
        },
      ],
    },
    { name: "Tickets", href: "/tickets", icon: "fi-rr-list" },
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
    // The Sidebar is mounted once (AppShell), so an open Inbox popup would
    // otherwise survive a role switch and sit over the new role's page.
    // Close it on a role change only (not on the first render, and not on
    // navigation within the same role).
    if (expansionKey && expansionKey.role !== user.role) setIsInboxOpen(false)
    setExpansionKey({ role: user.role, pathname })
    // Without an active sub-page the current expansion is kept: it is either
    // what the user opened or what was restored from the last visit (names
    // that are not in this role's menu are simply never rendered).
    let next: string[] = expandedItems
    for (const item of navigationItems) {
      if (!item.subItems) continue
      const matched = item.subItems.some((sub) => {
        // Sub-item hrefs may carry preserved query params (e.g. the Support
        // sub-pages); match on the path portion only.
        const subPath = sub.href.split("?")[0]
        return isSubPathActive(subPath) || (pathname?.startsWith(subPath + "/") ?? false)
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
  const isSubItemActive = (href: string) => isSubPathActive(href.split("?")[0])

  // The menu between the switchers and the bottom items scrolls on its own.
  // `overflow` tracks whether there is more above / below, for the edge fades.
  const scrollerRef = useRef<HTMLElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ above: false, below: false })
  const updateOverflow = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const above = scroller.scrollTop > 1
    const below = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1
    setOverflow((prev) => (prev.above === above && prev.below === below ? prev : { above, below }))
  }

  // On load (and when the route or role changes the menu) bring the active
  // item into view if it is outside the visible part of the list. A sub-menu
  // that is still opening changes the list height, so the reveal is repeated
  // on resize for a short while; after that the user's scroll position wins.
  const revealPendingRef = useRef(false)
  const revealActiveItem = () => {
    const scroller = scrollerRef.current
    const active = scroller?.querySelector('[data-active="true"]')
    if (scroller && active) scrollIntoNearest(scroller, active)
  }
  useLayoutEffect(() => {
    revealPendingRef.current = true
    revealActiveItem()
    const timer = window.setTimeout(() => {
      revealPendingRef.current = false
    }, 500)
    return () => window.clearTimeout(timer)
  }, [pathname, user.role, isCollapsed])

  useEffect(() => {
    const scroller = scrollerRef.current
    const content = scrollContentRef.current
    if (!scroller || !content || typeof ResizeObserver === "undefined") return
    // Fires once on observe, then whenever the window or the list changes height.
    const observer = new ResizeObserver(() => {
      if (revealPendingRef.current) revealActiveItem()
      updateOverflow()
    })
    observer.observe(scroller)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // Keyboard focus moving into the list scrolls the focused item clear of the fades.
  const handleNavFocus = (e: FocusEvent<HTMLElement>) => {
    let viaKeyboard = true
    try {
      viaKeyboard = e.target.matches(":focus-visible")
    } catch {
      // :focus-visible unsupported: treat every focus as keyboard focus.
    }
    if (viaKeyboard) scrollIntoNearest(e.currentTarget, e.target)
  }

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
          {/* Guests have no role or project. Each switcher centres its own
              icon-only trigger: the role tile, then the project logo. */}
          {isAuthenticated && (
            <div className="flex shrink-0 flex-col gap-3 px-4 pb-4">
              <RoleSwitcher variant="row" collapsed />
              <ProjectSwitcher collapsed />
            </div>
          )}
        </>
      ) : (
        // Logo row with the collapse control, then the role row and the project
        // row below it. The logo sits in the same 16px icon slot as the rows
        // below, so the logo, the role tile, the project avatar and the nav
        // icons share one axis. The logo row is centred on the mobile TopBar's
        // height (14px + 32px + 14px); the sheet's Close button sits beside it.
        <div
          className={cn(
            // 28px from the logo row to the role row, 12px between the two
            // switchers, and 16px down to the hairline (the same 16px sits
            // between the hairline and the Inbox).
            "flex shrink-0 flex-col gap-3 px-4 pt-3.5",
            // Guests only get the logo: keep the old header height above the Sign in card.
            isAuthenticated ? "pb-4" : "mb-1.25 h-15",
          )}
        >
          <div className={cn("flex h-8 shrink-0 items-center justify-between gap-1 pl-2.5", isAuthenticated && "mb-4")}>
            <span data-slot="sidebar-logo" className="flex h-4 w-4 shrink-0 items-center justify-center">
              <Logo />
            </span>
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
          {isAuthenticated && (
            <>
              <RoleSwitcher variant="row" />
              <ProjectSwitcher variant="row" />
            </>
          )}
        </div>
      )}

      {/* Hairline between the switchers and the menu, inset to the rows' padding. */}
      {isAuthenticated && (
        <div
          aria-hidden="true"
          data-slot="sidebar-switcher-divider"
          className={cn("h-px shrink-0 bg-sidebar-border", isCollapsed ? "mx-4" : "mx-6.5")}
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

      {/* Middle region: the only part of the sidebar that scrolls. The wrapper is
          a size container, so the list keeps the sidebar's width minus the two
          16px gutters whether or not a scrollbar takes space on the right. */}
      <div data-slot="sidebar-scroll" className="@container relative flex min-h-0 flex-1 flex-col">
      <nav
        ref={scrollerRef}
        aria-label="Main"
        onScroll={updateOverflow}
        onFocus={handleNavFocus}
        className={cn(
          "scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-py-6 pb-3 pl-4",
          // The 16px between the hairline and the Inbox scrolls with the list.
          isAuthenticated && "pt-4",
        )}
      >
        <div ref={scrollContentRef} className="w-[calc(100cqw-2rem)] space-y-1">
          {isAuthenticated && (
            <div>
              {forceExpanded ? (
                // Mobile sheet: the sheet is modal, so the Inbox opens the full
                // notifications page (the sheet closes on navigation).
                <Link
                  href="/notifications"
                  data-active={pathname === "/notifications"}
                  className={cn(
                    "flex items-center gap-3 h-9 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
                    pathname === "/notifications"
                      ? "bg-brand-primary/[0.08] font-medium text-brand-primary"
                      : NAV_ROW_REST,
                  )}
                >
                  <span className={NAV_ICON_CLASS}>
                    <FlaticonIcon iconClass="fi-rr-inbox" className={INBOX_ICON_NUDGE} />
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
                      "relative w-full flex items-center h-9 px-2.5 rounded-md text-ui cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 font-book text-text-muted hover:bg-surface-hover hover:text-foreground " + NAV_ICON_REST,
                      isCollapsed ? "justify-center" : "gap-3",
                    )}
                  >
                    <span className={NAV_ICON_CLASS}>
                      <FlaticonIcon iconClass="fi-rr-inbox" className={INBOX_ICON_NUDGE} />
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
                          data-active={hasActiveSubItem}
                          className={`w-full flex items-center justify-center h-9 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
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
                        className={`w-full flex items-center gap-3 h-9 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
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
                            className="pointer-events-none absolute left-[18px] top-4.5 bottom-4.5 w-px -translate-x-1/2 bg-border-subtle"
                          />
                          {item.subItems.map((subItem) => {
                            const isSubActive = isSubItemActive(subItem.href)
                            return (
                              <Link key={subItem.name} href={subItem.href} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40">
                                <div
                                  data-active={isSubActive}
                                  className={`relative flex items-center h-9 pl-9 pr-2.5 rounded-md text-ui transition-colors duration-fast ease-out ${
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
                      data-active={isActive}
                      className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-9 px-2.5 rounded-md text-ui transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
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
        {/* Overflow hints: a fade at an edge only while there is more in that direction. */}
        <div
          aria-hidden="true"
          data-slot="sidebar-fade-top"
          data-visible={overflow.above}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-sidebar to-transparent transition-opacity duration-fast ease-out",
            overflow.above ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          data-slot="sidebar-fade-bottom"
          data-visible={overflow.below}
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-sidebar to-transparent transition-opacity duration-fast ease-out",
            overflow.below ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

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
              "flex items-center h-9 px-2.5 text-ui rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 font-book text-text-muted hover:bg-surface-hover hover:text-foreground " + NAV_ICON_REST,
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
          const className = `flex items-center ${isCollapsed ? "justify-center" : "gap-3"} h-9 px-2.5 text-ui rounded-md cursor-pointer transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
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
