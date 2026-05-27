"use client"

import {
  ChevronsLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"

interface SidebarProps {
  className?: string
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

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
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
  // Persist collapsed state across navigations (the Sidebar is mounted
  // per-page, so component state alone is wiped on every nav). Read
  // localStorage synchronously in the initializer so client-side navigations
  // render with the correct collapsed state immediately — without this, every
  // nav would flash the expanded sidebar for one frame before an effect
  // collapsed it again. On the server `window` is undefined so we fall back
  // to `false`; the root element uses `suppressHydrationWarning` so the
  // server/client class difference on first paint doesn't warn.
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
        { name: "Payout", href: "/helper/settings/payout", icon: "fi-rr-credit-card" },
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
      suppressHydrationWarning
      className={`${isCollapsed ? "w-16" : "w-64"} bg-[#FAFAFA] border-r border-sidebar-border flex flex-col transition-all duration-300 h-full overflow-hidden ${className}`}
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-end min-h-[40px]">
        {!isCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
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
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
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
        <div className="px-3 pb-3">
          <div className="w-full px-3 py-2.5 bg-bg-subtle border border-sidebar-border rounded-lg">
            <Button variant="outline" size="sm" className="w-full text-brand-primary" asChild>
              <Link href={`/auth/signin?redirect=${encodeURIComponent(pathname || "/")}`}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 pb-3 overflow-hidden min-h-0">
        <div className="space-y-0.5">
          {navigationItems.map((item) => {
            const isActive = isItemActive(item)
            const isExpanded = expandedItems.includes(item.name)
            const activeClasses = "bg-brand-primary/[0.08] text-brand-primary"
            const inactiveClasses = "text-[#55555E] hover:bg-bg-subtle hover:text-sidebar-foreground"
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
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          title={item.name}
                          aria-label={item.name}
                          className={`w-full flex items-center justify-center px-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${
                            hasActiveSubItem ? activeClasses : inactiveClasses
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            <FlaticonIcon iconClass={item.icon} />
                          </span>
                        </button>
                      </DropdownMenuTrigger>
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${
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
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
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
                          className="shrink-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
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
                            className="pointer-events-none absolute left-[22px] top-[20px] bottom-[20px] w-px -translate-x-1/2 bg-border-subtle"
                          />
                          {item.subItems.map((subItem) => {
                            const isSubActive = isSubItemActive(subItem.href)
                            return (
                              <Link key={subItem.name} href={subItem.href} className="block">
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
                  )
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
        <div className={`flex items-start gap-4 px-2 py-1.5 rounded-md ${isCollapsed ? "justify-center" : ""}`}>
          <Avatar className="w-7 h-7 rounded-[10px] shrink-0">
            <AvatarFallback className="bg-brand-primary text-white text-sm rounded-[10px] font-medium">{user.avatar}</AvatarFallback>
          </Avatar>
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
