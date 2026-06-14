"use client"

import { ChevronsLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useUser } from "@/contexts/user-context"

interface PublicSupportSidebarProps {
  className?: string
  activeTab: string
  onTabChange: (tab: string) => void
}

interface NavigationItem {
  name: string
  icon: string
}

// Flaticon Icon Component
const FlaticonIcon = ({ iconClass, className }: { iconClass: string; className?: string }) => {
  return (
    <i
      className={`fi ${iconClass} inline-flex items-center justify-center leading-none ${className || ""}`}
    />
  )
}

export function PublicSupportSidebar({ className, activeTab, onTabChange }: PublicSupportSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const isAuthenticated = !!user?.id

  // Persist collapsed state across navigations, mirroring the main Sidebar
  // pattern. Read localStorage synchronously in the initializer so client-side
  // navigations render with the correct collapsed state immediately. On the
  // server `window` is undefined so we fall back to `false`; the root element
  // uses `suppressHydrationWarning` so the server/client class difference on
  // first paint doesn't warn.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem("public-support-sidebar:collapsed") === "true"
    } catch {
      return false
    }
  })

  const navigationItems: NavigationItem[] = [
    { name: "Get support", icon: "fi-rr-comments" },
    { name: "Rates and details", icon: "fi-rr-browser" },
    { name: "Resources", icon: "fi-rr-star-octogram" },
    { name: "About support", icon: "fi-rr-book-alt" },
  ]

  // Preserve the project identifier (?slug= / ?project=) in the sign-in
  // redirect so the visitor lands back on this project's support page.
  const query = searchParams?.toString()
  const redirectTarget = `${pathname || "/support"}${query ? `?${query}` : ""}`

  return (
    <div
      suppressHydrationWarning
      // `self-stretch` (not `h-full`) sizes the sidebar: the support page gets
      // its height through a `flex-1 min-h-0` chain from the root layout's
      // `min-h-full` container, and percentage heights don't resolve through
      // that chain (`h-full` computes to `auto`, collapsing the sidebar to its
      // content height). Stretching as a flex item uses the row's actual
      // laid-out height instead, so the sidebar always fills the area below
      // the TopBar and the profile block stays pinned to the bottom.
      className={`${isCollapsed ? "w-16" : "w-64"} bg-[#FAFAFA] border-r border-sidebar-border flex flex-col transition-all duration-300 self-stretch overflow-hidden shrink-0 ${className}`}
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-end min-h-[40px] shrink-0">
        {!isCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            onClick={() => {
              setIsCollapsed(true)
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.setItem("public-support-sidebar:collapsed", "true")
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
                  window.localStorage.setItem("public-support-sidebar:collapsed", "false")
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
              <Link href={`/auth/signin?redirect=${encodeURIComponent(redirectTarget)}`}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Nav takes ALL available vertical space between the collapse button and
          the bottom profile block, mirroring the authenticated `Sidebar`
          pattern: items render at the top and the leftover space inside the
          nav acts as a flexible spacer, keeping the profile pinned to the
          bottom of the sidebar. `min-h-0` lets the nav shrink below its
          content size on short viewports so the profile stays visible without
          scrolling. */}
      <nav className="flex-1 min-h-0 px-3 pb-3 overflow-hidden">
        <div className="space-y-0.5">
          {navigationItems.map((item) => {
            const isActive = activeTab === item.name
            const activeClasses = "bg-brand-primary/[0.08] text-brand-primary"
            const inactiveClasses = "text-[#55555E] hover:bg-bg-subtle hover:text-sidebar-foreground"

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => onTabChange(item.name)}
                title={isCollapsed ? item.name : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${
                  isActive ? activeClasses : inactiveClasses
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <FlaticonIcon iconClass={item.icon} />
                </span>
                {!isCollapsed && item.name}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Bottom profile block — same structure as the main `Sidebar`. Shows
          the signed-in user from the user context, falling back to the
          Incognito guest identity for anonymous visitors. */}
      <div className="px-3 py-2.5 border-t border-sidebar-border shrink-0">
        <div className={`flex items-start gap-4 px-2 py-1.5 rounded-md ${isCollapsed ? "justify-center" : ""}`}>
          {isAuthenticated ? (
            <ProfileAvatar
              id={user.id}
              name={user.name}
              avatarUrl={user.avatarUrl}
              size="sm"
            />
          ) : (
            <Avatar className="w-7 h-7 rounded-[10px] shrink-0">
              <AvatarFallback
                className="bg-[#868c98] text-white text-sm rounded-[10px] font-medium"
              >
                {user.avatar}
              </AvatarFallback>
            </Avatar>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{user.name}</div>
              {isAuthenticated && (
                <div className="text-xs font-medium text-muted-foreground truncate">
                  Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
