"use client"
import { X } from "lucide-react"
import { safeInternalPath } from "@/lib/safe-redirect"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import { notificationType, type Notification, type NotificationType } from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format"

export function notificationTypeColor(type: NotificationType) {
  switch (type) {
    case "HELPER_REQUEST":
      return "text-chart-3"
    case "NEW_PAYOUT":
      return "text-chart-2"
    case "SUPPORT_TICKET":
      return "text-chart-2"
    case "TICKET_MESSAGE":
      return "text-chart-2"
    case "PAYMENT_REQUIRED":
      return "text-destructive"
    default:
      return "text-muted-foreground"
  }
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

const subscribeNoop = () => () => {}

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
  anchorRef,
}: NotificationsPanelProps) {
  const router = useRouter()
  // false during SSR and hydration, true afterwards (the panel portals into document.body)
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [position, setPosition] = useState<{ top: number; right: number }>(DEFAULT_POSITION)

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

  const stripQuotes = (text: string) => text.replace(/^["“”]+|["“”]+$/g, "")

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick(notification)
    if (notification.route) {
      if (notificationType(notification) === "HELPER_REQUEST") {
        router.push("/helpers?view=requests")
      } else {
        router.push(safeInternalPath(notification.route, "/notifications"))
      }
    }
    onClose()
  }

  const handleSeeAll = () => {
    onClose()
    router.push("/notifications")
  }

  // Keep the panel mounted for the exit animation (menu-out, 100ms).
  const [present, setPresent] = useState(isOpen)
  if (isOpen && !present) setPresent(true)
  useEffect(() => {
    if (isOpen) return
    const t = setTimeout(() => setPresent(false), 120)
    return () => clearTimeout(t)
  }, [isOpen])

  if (!present || !mounted) return null

  const panel = (
    <>
      <div
        role="dialog"
        aria-label="Notifications"
        data-state={isOpen ? "open" : "closed"}
        className="fixed w-96 max-w-[calc(100vw-2rem)] origin-top-right bg-card shadow-popover z-[2147483647] flex flex-col rounded-lg border border-border-subtle max-h-[80vh] data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out"
        style={{ top: `${position.top}px`, right: `${position.right}px` }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Notifications</h2>
          <button onClick={onClose} aria-label="Close notifications" className="p-1 hover:bg-surface-hover rounded-md transition-colors duration-fast ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No notifications</div>
          ) : (
            <div className="p-4 space-y-4">
              {notifications.slice(0, 3).map((notification) => {
                const type = notificationType(notification)
                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    className="p-4 border border-border-subtle rounded-lg hover:bg-surface-hover cursor-pointer transition-colors duration-fast ease-out animate-enter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleNotificationClick(notification)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-medium uppercase tracking-wide ${notificationTypeColor(type)}`}>
                        {type.replace("_", " ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs ${
                            !notification.is_read ? "text-foreground" : "text-text-tertiary"
                          }`}
                        >
                          {formatRelativeTime(notification.created_at)}
                        </span>
                        {!notification.is_read && <div className="w-2 h-2 bg-brand-primary rounded-full" />}
                      </div>
                    </div>
                    <p
                      className={`text-ui leading-relaxed ${
                        !notification.is_read ? "text-foreground" : "text-text-tertiary"
                      }`}
                    >
                      {stripQuotes(notification.content)}
                    </p>
                  </div>
                )
              })}
              <Button variant="ghost" className="w-full" onClick={handleSeeAll}>See all notifications</Button>
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
