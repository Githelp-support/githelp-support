"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { notificationTypeColor } from "@/components/layout/notifications-panel"
import {
  notificationType,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format"

const PAGE_SIZE = 25

type Filter = "all" | "unread"

export default function NotificationsPage() {
  const router = useRouter()
  const { data: notifications = [], isLoading } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const [filter, setFilter] = useState<Filter>("all")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const filtered = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter],
  )
  const visible = filtered.slice(0, visibleCount)

  const handleFilterChange = (next: Filter) => {
    setFilter(next)
    setVisibleCount(PAGE_SIZE)
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationRead.mutateAsync(notification.id)
    }
    if (notification.route) {
      if (notificationType(notification) === "HELPER_REQUEST") {
        router.push("/helpers?view=requests")
      } else {
        router.push(notification.route)
      }
    }
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notifications" subtitle="Everything that needs your attention" />

        <main className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === "all" ? "lavender" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("all")}
                >
                  All
                </Button>
                <Button
                  variant={filter === "unread" ? "lavender" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("unread")}
                >
                  Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0 || markAllRead.isPending}
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all as read
              </Button>
            </div>

            {isLoading ? (
              <div className="p-10 text-center text-muted-foreground">Loading notifications…</div>
            ) : visible.length === 0 ? (
              <Card className="border-[#E1E1E1] shadow-none rounded-lg">
                <CardContent className="p-10 flex flex-col items-center text-center gap-2">
                  <Bell className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {filter === "unread" ? "You're all caught up." : "No notifications yet."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visible.map((notification) => {
                  const type = notificationType(notification)
                  return (
                    <div
                      key={notification.id}
                      className="p-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleNotificationClick(notification)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleNotificationClick(notification)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={`text-xs font-medium uppercase tracking-wide ${notificationTypeColor(type)}`}
                        >
                          {type.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                          {!notification.is_read && <div className="w-2 h-2 bg-brand-primary rounded-full" />}
                        </div>
                      </div>
                      <p
                        className={`text-sm font-medium ${
                          !notification.is_read ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p
                        className={`text-[13px] leading-relaxed ${
                          !notification.is_read ? "text-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {notification.content}
                      </p>
                    </div>
                  )
                })}

                {filtered.length > visibleCount && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    Show more ({filtered.length - visibleCount} remaining)
                  </Button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
