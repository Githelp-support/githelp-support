"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/ui/icon"
import { ProfileAvatar, type ProfileAvatarProps } from "@/components/ui/profile-avatar"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { SQUIRCLE_RADIUS } from "@/lib/constants"
import { formatDayLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Presentational pieces of the chat thread shared by the customer chat
 * (`TicketChat`) and the helper ticket page, so the User, Helper and Admin
 * views render day dividers, message headers, notes and avatars identically.
 */

/** Geometry of a thread row: a 30px avatar column, then the message, 12px apart. */
export const CHAT_AVATAR = {
  /** 30×30 box. */
  size: "size-7.5",
  /** Width of the avatar column (spacer and note icon column). */
  column: "w-7.5",
  /** Proportional squircle corner for the 30px avatar. */
  radius: SQUIRCLE_RADIUS[30],
  /** Gap between the avatar column and the message. */
  gap: "gap-3",
} as const

/** The thread avatar: `ProfileAvatar` at a uniform 30×30 with the matching squircle radius. */
export function ChatAvatar({ className, ...props }: Omit<ProfileAvatarProps, "size" | "radius">) {
  return (
    <ProfileAvatar {...props} size="sm" className={cn(CHAT_AVATAR.size, CHAT_AVATAR.radius, className)} />
  )
}

/** Empty avatar-width column for grouped (non-first) messages. */
export function ChatAvatarSpacer({ className }: { className?: string }) {
  return <div aria-hidden="true" data-slot="chat-avatar-spacer" className={cn(CHAT_AVATAR.column, "shrink-0", className)} />
}

/** Hairline across the thread with the day ("Today", "Sunday 15 November") in a centred pill. */
export function ChatDayDivider({ date, className }: { date: string | Date; className?: string }) {
  const label = formatDayLabel(date)
  return (
    <div role="separator" aria-label={label} className={cn("flex items-center", className)}>
      <div className="flex-1 border-t border-border-subtle" />
      <span className="shrink-0 rounded-full border border-border-subtle bg-card px-3 py-0.5 font-sans text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t border-border-subtle" />
    </div>
  )
}

export interface ChatMessageMetaProps {
  /** Sender name, rendered in the standard name style. */
  name?: ReactNode
  /** Timestamp as shown ("10:16"). */
  time: ReactNode
  /** A self-styled name node (e.g. `GuestName`) rendered instead of `name`. */
  children?: ReactNode
  className?: string
}

/** Header line of a message: sender name followed by the time. */
export function ChatMessageMeta({ name, time, children, className }: ChatMessageMetaProps) {
  return (
    <div className={cn("mb-1 flex items-center gap-2", className)}>
      {children ?? <span className="font-sans text-sm font-semibold text-foreground">{name}</span>}
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{time}</span>
    </div>
  )
}

export interface ChatSystemNoteProps {
  /** Note text as plain nodes, inline after the "Note" label. */
  children?: ReactNode
  /** Note text as markdown, used instead of `children`; the label sits inline with its first paragraph. */
  markdown?: string
  /** Content below the text: CTA buttons, `TimeReviewSystemMessage`, `VisitorLeftAction`. */
  extra?: ReactNode
  className?: string
}

/**
 * A system line in the thread: an info icon in the avatar column and
 * "Note · …" in the note colour. No sender, background or border.
 */
export function ChatSystemNote({ children, markdown, extra, className }: ChatSystemNoteProps) {
  return (
    <div data-slot="chat-system-note" className={cn("flex w-full items-start", CHAT_AVATAR.gap, className)}>
      {/* As tall as the first text line, so the icon is centred on it. */}
      <div className={cn(CHAT_AVATAR.column, "flex h-4.5 shrink-0 items-center justify-center text-text-note")}>
        <Icon name="fi-rr-info" size={3.5} />
      </div>
      <div className="min-w-0 flex-1 text-ui text-text-note">
        {markdown != null ? (
          <>
            {/* Floated so the first markdown paragraph starts on the label's line. */}
            <span className="float-left whitespace-pre">
              <span className="font-semibold">Note</span>
              {" · "}
            </span>
            <MarkdownContent
              content={markdown}
              className="text-ui leading-4.5 [&_li]:text-ui [&_li]:leading-4.5 [&_ol]:text-ui [&_p]:text-ui [&_p]:leading-4.5 [&_ul]:text-ui"
            />
          </>
        ) : (
          <p>
            <span className="font-semibold">Note</span>
            {" · "}
            {children}
          </p>
        )}
        {extra != null && extra !== false && <div className="mt-2 clear-both">{extra}</div>}
      </div>
    </div>
  )
}
