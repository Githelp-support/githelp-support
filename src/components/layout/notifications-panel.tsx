"use client"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { RefObject } from "react"
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
  anchorRef?: RefObject<HTMLElement | null>
}

// Default fallback position (matches the previous static `top-16 right-4`
// placement when no anchor element is provided).
const DEFAULT_POSITION = { top: 64, right: 16 }
// Vertical gap between the bottom of the anchor (bell icon) and the top of
// the panel. Keeping this small ensures the panel hugs the bell icon
// regardless of any content shifting the header vertically (e.g. a top
// banner).
const ANCHOR_GAP = 6

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
  anchorRef,
}: NotificationsPanelProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number }>(DEFAULT_POSITION)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep the panel positioned relative to the bell icon so that anything
  // shifting the bell vertically (e.g. a top banner across the page) also
  // shifts the panel by the same amount.
  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const anchor = anchorRef?.current
      if (!anchor) {
        setPosition(DEFAULT_POSITION)
        return
      }
      const rect = anchor.getBoundingClientRect()
      // Only the vertical position needs to follow the bell icon — a horizontal
      // top banner shifts everything vertically but not horizontally, so the
      // right offset (matching the original `right-4`) is kept constant.
      setPosition({
        top: rect.bottom + ANCHOR_GAP,
        right: DEFAULT_POSITION.right,
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen, anchorRef])

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
      <div
        className="fixed w-96 bg-card shadow-2xl z-[2147483647] flex flex-col rounded-lg border border-border max-h-[80vh]"
        style={{ top: `${position.top}px`, right: `${position.right}px` }}
      >
        <div className="flex items-center justify-between px-[18px] py-[18px] border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors cursor-pointer">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No notifications</div>
          ) : (
            <div className="p-4 space-y-4">
              {notifications.slice(0, 3).map((notification) => (
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
                    className={`text-[13px] leading-relaxed ${
                      !notification.isRead ? "text-[#2E2D31]" : "text-[#868686]"
                    }`}
                  >
                    {stripQuotes(notification.content)}
                  </p>
                </div>
              ))}
              <Button variant="ghost" className="w-full">See all notifications</Button>
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
