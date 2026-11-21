"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { SidebarSectionHeading } from "@/components/ticket-chat/sidebar-section"
import { shortTicketId } from "@/lib/customer-chat-messages"
import { formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface ActiveTicketsListItem {
  /** Full ticket id; the row shows its short form. */
  id: string
  /** Ticket subject (line 1). */
  subject: string
  /** Project the ticket belongs to (line 2). */
  projectName: string
  /** Ticket date (line 3), shown through `formatShortDate`. */
  date: string | Date
  /** The ticket open in the chat. */
  current: boolean
  /** Unread messages. */
  hasNotification: boolean
}

export interface ActiveTicketsListProps<T extends ActiveTicketsListItem> {
  items: T[]
  /** The N in "Active tickets (N)". */
  count: number
  /** The 32px avatar at the start of a row (project logo for users, customer avatar for helpers). */
  renderAvatar: (item: T) => ReactNode
  hrefFor: (item: T) => string
}

/**
 * "Active tickets" section of the chat's right sidebar, shared by the
 * customer chat and the helper ticket page. Rows are a fixed h-19 (76px:
 * three text lines plus py-3), and the list is capped at four of them
 * (max-h-76) and scrolls beyond that; the heading stays outside the scroller.
 */
export function ActiveTicketsList<T extends ActiveTicketsListItem>({
  items,
  count,
  renderAvatar,
  hrefFor,
}: ActiveTicketsListProps<T>) {
  return (
    <div>
      <SidebarSectionHeading>Active tickets ({count})</SidebarSectionHeading>
      <div
        data-slot="active-tickets-scroll"
        className={cn(
          "-mx-4 max-h-76 overflow-y-auto",
          // Only once it can scroll: the reserved gutter would otherwise inset the full-bleed rows.
          items.length > 4 && "scrollbar-subtle"
        )}
      >
        {items.length === 0 ? (
          <p className="text-ui text-muted-foreground px-4">No active tickets</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={hrefFor(item)}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "block h-19 w-full border cursor-pointer outline-none transition-colors duration-fast ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40",
                item.current
                  ? "bg-brand-primary/10 border-border border-l-4 border-l-brand-primary"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                {renderAvatar(item)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-sm font-semibold text-foreground truncate">{item.subject}</h4>
                    {item.hasNotification && (
                      <div data-slot="unread-dot" className="size-2 shrink-0 rounded-full bg-brand-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.projectName} · {shortTicketId(item.id)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatShortDate(item.date)}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
