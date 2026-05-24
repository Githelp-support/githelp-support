"use client"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export interface Notification {
  id: string
  title: string
  type: "HELPER_REQUEST" | "NEW_PAYOUT" | "SUPPORT_TICKET" | "INFO"
  content: string
  route?: string
  metadata?: Record<string, any>
  timestamp: string
  isRead: boolean
}

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAllAsRead: () => void
  onNotificationClick: (notification: Notification) => void
}

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
}: NotificationsPanelProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick(notification)
    if (notification.route) {
      if (notification.type === "HELPER_REQUEST") {
        router.push("/helpers?view=requests")
      } else {
        router.push(notification.route)
      }
    }
    onClose()
  }

  if (!isOpen || !mounted) return null

  const panel = (
    <>
      <div className="fixed right-4 top-16 w-96 bg-card shadow-2xl z-[2147483647] flex flex-col rounded-lg border border-border max-h-[80vh]">
        <div className="flex items-center justify-between px-[18px] py-[18px] border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Notifications</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors cursor-pointer">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No notifications</div>
          ) : (
            <div className="p-4 space-y-4">
              {notifications.slice(0, 4).map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-medium uppercase tracking-wide ${getTypeColor(notification.type)}`}>
                      {notification.type.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs ${
                          !notification.isRead ? "text-[#2E2D31]" : "text-[#868686]"
                        }`}
                      >
                        {notification.timestamp}
                      </span>
                      {!notification.isRead && <div className="w-2 h-2 bg-brand-primary rounded-full" />}
                    </div>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      !notification.isRead ? "text-[#2E2D31]" : "text-[#868686]"
                    }`}
                  >
                    {stripQuotes(notification.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            Close
          </Button>
          <Button onClick={onMarkAllAsRead} variant="lavender" className="flex-1">
            Mark all as read
          </Button>
        </div>
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
