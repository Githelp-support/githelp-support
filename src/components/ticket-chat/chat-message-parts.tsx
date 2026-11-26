"use client"

import type { ReactNode } from "react"
import { GuestName } from "@/components/ui/guest-name"
import { Icon } from "@/components/ui/icon"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { SQUIRCLE_RADIUS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "./markdown-content"

/**
 * Message-thread pieces shared by the customer chat (`TicketChat`) and the
 * helper/admin ticket page, so both surfaces render a thread the same way.
 */

/** Hairline across the thread with the day ("Today", "Sunday 15 November") in a centred pill. */
export function ChatDayDivider({ label, className }: { label: string; className?: string }) {
  return (
    <div role="separator" aria-label={label} className={cn("flex items-center gap-4", className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
      <span className="shrink-0 rounded-full border border-border-subtle bg-card px-3 py-0.5 font-sans text-xs text-muted-foreground">
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
    </div>
  )
}

export interface ChatMessageMetaProps {
  /** Sender name. For a guest this is the guest label. */
  name: string
  /** The sender is a guest: the name renders through `GuestName` (muted, with the tooltip). */
  guest?: boolean
  /** Guests only: full email or identifier for the name tooltip. */
  guestFull?: string | null
  /** Time only ("10:16"), e.g. from `formatChatTime`. Omit to show no time. */
  time?: string | null
  /** Rendered between the name and the time (e.g. a "Project" badge). */
  children?: ReactNode
  className?: string
}

/** First line of a message group: who wrote it and when. */
export function ChatMessageMeta({ name, guest = false, guestFull, time, children, className }: ChatMessageMetaProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {guest ? (
        <GuestName label={name} full={guestFull} className="text-sm" />
      ) : (
        <span className="min-w-0 truncate text-sm font-bold text-foreground">{name}</span>
      )}
      {children}
      {time ? <span className="shrink-0 font-sans text-xs text-text-chat-meta tabular-nums">{time}</span> : null}
    </div>
  )
}

export type ChatAvatarSlotProps =
  | {
      kind: "avatar"
      /** Stable sender id: drives the fallback colour. */
      id: string | null | undefined
      name?: string | null
      avatarUrl?: string | null
      guest?: boolean
      className?: string
    }
  /** Follow-up message in a group: keeps the column, shows nothing. */
  | { kind: "spacer"; className?: string }
  /** System note: the info icon, centred in the column. */
  | { kind: "note"; className?: string }

/**
 * The fixed 30px column at the left of every thread row, so message text
 * lines up whether the row shows an avatar, nothing or the note icon.
 */
export function ChatAvatarSlot(props: ChatAvatarSlotProps) {
  if (props.kind === "avatar") {
    return (
      <div data-slot="chat-avatar-slot" className={cn("size-7.5 shrink-0", props.className)}>
        <ProfileAvatar
          id={props.id}
          name={props.name}
          avatarUrl={props.avatarUrl ?? null}
          guest={props.guest}
          size="sm"
          className={cn("size-7.5", SQUIRCLE_RADIUS[30])}
        />
      </div>
    )
  }
  if (props.kind === "note") {
    return (
      <div
        data-slot="chat-avatar-slot"
        // Height of one line of note text, so the icon sits on the first line.
        className={cn("flex h-4.5 w-7.5 shrink-0 items-center justify-center text-text-note", props.className)}
      >
        <Icon name="fi-rr-info" size={3.5} />
      </div>
    )
  }
  return <div data-slot="chat-avatar-slot" aria-hidden="true" className={cn("w-7.5 shrink-0", props.className)} />
}

export interface SystemNoteProps {
  /** Note text as markdown; continues on the same line as the "Note · " prefix. */
  markdown?: string
  /**
   * Custom content (`TimeReviewSystemMessage`, CTA buttons…). Rendered after
   * `markdown` when both are given, otherwise right after the prefix.
   */
  children?: ReactNode
  className?: string
}

/**
 * A system message in the thread: info icon in the avatar column, then 13px
 * text in the note colour starting with "Note · ". No sender name and no
 * background box.
 */
export function SystemNote({ markdown, children, className }: SystemNoteProps) {
  return (
    <div data-slot="system-note" className={cn("flex items-start gap-3", className)}>
      <ChatAvatarSlot kind="note" />
      <div className="min-w-0 flex-1 text-ui text-text-note">
        <span className="font-semibold">Note</span>
        {" · "}
        {markdown != null && (
          <MarkdownContent
            content={markdown}
            // Inline, so the first paragraph continues after the prefix; the
            // markdown elements take the note's 13px instead of their own 14px.
            className="inline text-ui! [&_li]:text-ui [&_ol]:text-ui [&_p]:text-ui [&_ul]:text-ui [&>p:first-child]:inline"
          />
        )}
        {children}
      </div>
    </div>
  )
}
