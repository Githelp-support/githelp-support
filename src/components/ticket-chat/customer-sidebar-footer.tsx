"use client"

import { SQUIRCLE_RADIUS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import type { CustomerTimeEntryDisplay } from "@/hooks/useCustomerTicketSidebar"
import type { UserActiveTicketSidebarItem } from "@/hooks/useTicketsWithDetails"
import { ActiveTicketsList } from "./active-tickets-list"
import { SidebarSectionHeading, SidebarDivider } from "./sidebar-section"
import { TimeEntriesReviewStatus } from "./time-entry-review"

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
                        {/* Same 24px size as the helper ticket page; radius scaled from the chat avatars */}
                        <ProfileAvatar
                          id={entry.helperUserId}
                          name={entry.helperName}
                          avatarUrl={entry.helperAvatarUrl ?? null}
                          size="sm"
                          radius="8.25px"
                          className="w-6 h-6"
                        />
                        <span className="text-ui text-muted-foreground capitalize">{entry.type}</span>
                      </div>
                      <span
                        className={cn(
                          "text-ui text-muted-foreground tabular-nums",
                          entry.reviewStatus === "declined" && "line-through",
                        )}
                      >
                        {String(entry.hours).padStart(2, "0")}:{String(entry.minutes).padStart(2, "0")} h
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-1 ml-8">{entry.note}</p>}
                    {entry.reviewStatus === "declined" && (
                      <p className="text-xs text-muted-foreground mt-1 ml-8 italic">
                        Declined{entry.declineReason ? `: ${entry.declineReason}` : ""}
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-medium">
                  <span className="text-ui text-foreground">Total</span>
                  <span className="text-ui text-foreground tabular-nums">{totalLoggedFormatted}</span>
                </div>
                <TimeEntriesReviewStatus entries={timeEntries} perspective="customer" />
              </div>
            ) : (
              <p className="text-ui text-muted-foreground">No time logged yet.</p>
            )}
          </div>

          <SidebarDivider />
        </>
      )}

      {/* Active Tickets — latest active tickets for this user */}
      <ActiveTicketsList
        // `date` on the hook's item is already formatted; the list formats the raw created_at itself.
        items={activeTickets.map((item) => ({ ...item, date: item.createdAt }))}
        count={activeTicketsCount}
        hrefFor={(item) => `/support/chat?ticket=${item.id}`}
        renderAvatar={(item) =>
          item.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.avatarUrl} alt="" className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} object-cover shrink-0`} />
          ) : (
            <div
              className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} flex items-center justify-center bg-brand-primary text-brand-foreground text-sm font-medium shrink-0`}
            >
              {item.avatarInitial}
            </div>
          )
        }
      />
    </>
  )
}
