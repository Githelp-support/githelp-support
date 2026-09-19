"use client"

import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

// Same type → color mapping as the notifications panel
const getTypeColor = (type: string) => {
  switch (type) {
    case "HELPER_REQUEST":
      return "text-chart-3"
    case "NEW_PAYOUT":
      return "text-chart-2"
    case "SUPPORT_TICKET":
      return "text-chart-2"
    default:
      return "text-muted-foreground"
  }
}

const stripQuotes = (text: string) => text.replace(/^["“”]+|["“”]+$/g, "")

export default function NotificationsPage() {
  const router = useRouter()

  const { data: notifications = [], isLoading } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const handleMarkAllAsRead = async () => {
    await markAllRead.mutateAsync()
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationRead.mutateAsync(notification.id)
    }
    if (notification.route) {
      const type = notification.metadata?.type || "INFO"
      if (type === "HELPER_REQUEST") {
        router.push("/helpers?view=requests")
      } else {
        router.push(notification.route)
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notifications" subtitle="All notifications for your account" />

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl">
            <div className="flex items-center justify-end mb-4">
              <Button
                variant="lavender"
                onClick={handleMarkAllAsRead}
                disabled={markAllRead.isPending || notifications.every((n) => n.is_read)}
              >
                Mark all as read
              </Button>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No notifications</div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => {
                  const type = notification.metadata?.type || "INFO"
                  return (
                    <div
                      key={notification.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={cn("text-xs font-medium uppercase tracking-wide", getTypeColor(type))}
                        >
                          {type.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs",
                              !notification.is_read ? "text-[#2E2D31]" : "text-[#868686]",
                            )}
                          >
                            {formatRelativeTime(notification.created_at)}
                          </span>
                          {!notification.is_read && <div className="w-2 h-2 bg-brand-primary rounded-full" />}
                        </div>
                      </div>
                      <p
                        className={cn(
                          "text-[13px] leading-relaxed",
                          !notification.is_read ? "text-[#2E2D31]" : "text-[#868686]",
                        )}
                      >
                        {stripQuotes(notification.content)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
