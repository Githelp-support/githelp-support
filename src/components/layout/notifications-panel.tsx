"use client"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import React from "react"
import { cn } from "@/lib/utils"

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

/**
 * Renders notification content with key information bolded.
 * - NEW_PAYOUT: bolds currency amounts (e.g., "$123.45", "€50", "100 USD")
 * - HELPER_REQUEST: bolds usernames/names from metadata, or falls back to
 *   bolding quoted names or the first capitalized word sequence
 */
function renderBoldContent(notification: Notification): React.ReactNode {
  const { content, type, metadata } = notification

  if (type === "NEW_PAYOUT") {
    // Bold currency amounts like $123.45, €50.00, 100 USD, etc.
    const amountRegex = /(\$[\d,]+(?:\.\d{2})?|€[\d,]+(?:\.\d{2})?|£[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|NOK|SEK|DKK))/g
    const parts = content.split(amountRegex)
    if (parts.length > 1) {
      return parts.map((part, i) =>
        amountRegex.test(part) ? (
          <strong key={i} className="font-semibold text-foreground">{part}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )
    }
    // Reset regex lastIndex after split
    amountRegex.lastIndex = 0
  }

  if (type === "HELPER_REQUEST") {
    // Try to bold the helper name from metadata
    const helperName = metadata?.helper_name || metadata?.helperName || metadata?.username
    if (helperName && content.includes(helperName)) {
      const parts = content.split(helperName)
      return parts.reduce<React.ReactNode[]>((acc, part, i) => {
        if (i > 0) {
          acc.push(
            <strong key={`bold-${i}`} className="font-semibold text-foreground">{helperName}</strong>
          )
        }
        acc.push(<React.Fragment key={`text-${i}`}>{part}</React.Fragment>)
        return acc
      }, [])
    }
    // Fallback: bold quoted names like "John Doe" or 'username'
    const quotedRegex = /["']([^"']+)["']/g
    const quotedParts = content.split(quotedRegex)
    if (quotedParts.length > 1) {
      return quotedParts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">{part}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )
    }
  }

  return content
}

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
}: NotificationsPanelProps) {
  const router = useRouter()

  const getTypeBadgeStyles = (type: string) => {
    switch (type) {
      case "HELPER_REQUEST":
        return "bg-purple-50 text-brand-primary dark:bg-purple-950/30 dark:text-purple-300"
      case "NEW_PAYOUT":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
      case "SUPPORT_TICKET":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

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

  if (!isOpen) return null

  return (
    <>
      <div className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 flex flex-col rounded-xl border border-border max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-heading tracking-tight">Notifications</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="p-3 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3 rounded-lg cursor-pointer transition-colors border",
                    notification.isRead
                      ? "bg-card border-transparent hover:bg-muted/60"
                      : "bg-page-muted border-border-subtle hover:bg-muted/80 dark:bg-muted/20"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md",
                        getTypeBadgeStyles(notification.type)
                      )}
                    >
                      {notification.type.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-tertiary font-normal">{notification.timestamp}</span>
                      {!notification.isRead && <div className="w-2 h-2 bg-brand-primary rounded-full shrink-0" />}
                    </div>
                  </div>
                  <p className="text-[13px] text-text-muted leading-relaxed mt-1">
                    {renderBoldContent(notification)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent h-9 text-sm">
            Close
          </Button>
          <Button onClick={onMarkAllAsRead} variant="lavender" className="flex-1 h-9 text-sm">
            Mark all as read
          </Button>
        </div>
      </div>
    </>
  )
}
