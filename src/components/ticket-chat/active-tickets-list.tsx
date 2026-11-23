"use client"

import Link from "next/link"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { SQUIRCLE_RADIUS } from "@/lib/constants"
import { formatDateMedium } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SidebarEmptyText, SidebarSectionHeading } from "./sidebar-section"

/**
 * What a row needs. `UserActiveTicketSidebarItem` and
 * `HelperClaimedTicketSidebarItem` both satisfy it as they are.
 */
export interface ActiveTicketListItem {
  id: string
  /** Ticket question/subject (line 1). */
  subject: string
  projectName: string
  /** First 8 characters of the ticket id. */
  shortId: string
  /** Raw ISO `created_at`. */
  createdAt: string
  avatarUrl: string | null
  avatarInitial: string
  /** Helper lists: the ticket creator, for the avatar's fallback colour. */
  creatorId?: string | null
  current: boolean
  hasNotification: boolean
}

export interface ActiveTicketsListProps<T extends ActiveTicketListItem> {
  items: T[]
  /** Total shown in the heading; can exceed `items.length` when the list is limited. */
  count: number
  /** Where a row links to. */
  getHref: (item: T) => string
  /**
   * `project` (customer side): the project's logo, or its initial on a brand
   * tile. `person` (helper side): the ticket creator's `ProfileAvatar`.
   */
  avatar?: "project" | "person"
  className?: string
}

/**
 * "Active tickets (N)" for the chat's right-hand panel. The heading sits
 * outside the scroll area so it stays visible; the list is capped at four
 * rows (4 × h-19 = max-h-76) and scrolls beyond that. Cancels the panel's
 * px-4 so the current-row highlight is full bleed.
 */
export function ActiveTicketsList<T extends ActiveTicketListItem>({
  items,
  count,
  getHref,
  avatar = "project",
  className,
}: ActiveTicketsListProps<T>) {
  return (
    <div className={className}>
      <SidebarSectionHeading>Active tickets ({count})</SidebarSectionHeading>
      {items.length === 0 ? (
        <SidebarEmptyText>No active tickets</SidebarEmptyText>
      ) : (
        <ul className={cn("-mx-4", items.length > 4 && "max-h-76 overflow-y-auto scrollbar-subtle")}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={getHref(item)}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "flex h-19 items-start gap-3 border-l-4 py-3 pr-4 pl-3 transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40",
                  item.current
                    ? "border-l-brand-primary bg-brand-primary/10"
                    : "border-l-transparent hover:bg-surface-hover active:bg-surface-active",
                )}
              >
                {avatar === "person" ? (
                  <ProfileAvatar id={item.creatorId} name={item.avatarInitial} avatarUrl={item.avatarUrl} size="md" />
                ) : item.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.avatarUrl} alt="" className={cn("size-8 shrink-0 object-cover", SQUIRCLE_RADIUS[32])} />
                ) : (
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center bg-brand-primary text-sm font-medium text-brand-foreground",
                      SQUIRCLE_RADIUS[32],
                    )}
                  >
                    {item.avatarInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.projectName} · {item.shortId}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateMedium(item.createdAt)}</p>
                </div>
                {item.hasNotification && (
                  <span className="size-2 shrink-0 self-center rounded-full bg-brand-primary">
                    <span className="sr-only">Unread messages</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
