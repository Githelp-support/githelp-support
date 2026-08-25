"use client"

import Link from "next/link"
import { getAvatarColorHexForId } from "@/lib/constants"
import type { CustomerTimeEntryDisplay } from "@/hooks/useCustomerTicketSidebar"
import type { UserActiveTicketSidebarItem } from "@/hooks/useTicketsWithDetails"
import { SidebarSectionHeading, SidebarDivider } from "./sidebar-section"

export interface CustomerTicketSidebarFooterProps {
  /** Current ticket id, if a ticket exists yet. */
  ticketId?: string
  /** Whether a helper has claimed the ticket — Logged time only makes sense after that. */
  hasClaimer: boolean
  timeEntries: CustomerTimeEntryDisplay[]
  totalLoggedFormatted: string
  activeTickets: UserActiveTicketSidebarItem[]
  activeTicketsCount: number
}

/**
 * Right-sidebar footer for the customer-facing ticket chat: "Logged time"
 * (once a helper has claimed) and "Active tickets" (the customer's own open
 * tickets). Rendered by `TicketChat` after "Other topics", which inserts the
 * separator above it. Render only for signed-in users — anonymous visitors
 * have no tickets to list and can't read time entries.
 *
 * Markup mirrors the helper ticket page's sidebar so both sides look alike.
 */
export function CustomerTicketSidebarFooter({
  ticketId,
  hasClaimer,
  timeEntries,
  totalLoggedFormatted,
  activeTickets,
  activeTicketsCount,
}: CustomerTicketSidebarFooterProps) {
  return (
    <>
      {ticketId && hasClaimer && (
        <>
          <div>
            <SidebarSectionHeading info>Logged time</SidebarSectionHeading>
            {timeEntries.length > 0 ? (
              <div className="space-y-2 mb-3">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="py-2 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{entry.type === "together" ? "T" : "S"}</span>
                        </div>
                        <span className="text-[13px] text-muted-foreground capitalize">{entry.type}</span>
                      </div>
                      <span className="text-[13px] text-muted-foreground tabular-nums">
                        {String(entry.hours).padStart(2, "0")}:{String(entry.minutes).padStart(2, "0")} h
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-1 ml-8">{entry.note}</p>}
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-medium">
                  <span className="text-[13px] text-foreground">Total</span>
                  <span className="text-[13px] text-foreground tabular-nums">{totalLoggedFormatted}</span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No time logged yet.</p>
            )}
          </div>

          <SidebarDivider />
        </>
      )}

      {/* Active Tickets — latest active tickets for this user */}
      <div>
        <SidebarSectionHeading>Active tickets ({activeTicketsCount})</SidebarSectionHeading>
        <div className={`-ml-5 -mr-4 ${activeTickets.length > 1 ? "max-h-72 overflow-y-auto" : ""}`}>
          {activeTickets.length === 0 ? (
            <p className="text-[13px] text-muted-foreground pl-5 pr-4">No active tickets</p>
          ) : (
            activeTickets.map((item) => (
              <Link
                key={item.id}
                href={`/support/chat?ticket=${item.id}`}
                className={`block w-full border cursor-pointer transition-colors ${
                  item.current
                    ? "bg-brand-primary/10 border-border border-l-4 border-l-brand-primary"
                    : "bg-white border-border hover:bg-muted"
                }`}
              >
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {item.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-[11px] object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                        style={{ backgroundColor: getAvatarColorHexForId(item.id) }}
                      >
                        {item.avatarInitial}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className="font-medium text-foreground text-[13px] truncate">{item.title}</h4>
                        {item.hasNotification && (
                          <div className="w-2 h-2 bg-[#f09191] rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.subtitle}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}
