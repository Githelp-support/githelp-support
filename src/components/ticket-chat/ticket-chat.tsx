"use client"

import type React from "react"
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import { AttachImageModal } from "@/components/ticket-chat/attach-image-modal"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { SidebarSectionHeading, SidebarDivider, SidebarEmpty, SidebarEmptyText } from "./sidebar-section"
import { useRightSidebarCollapsed, RightSidebarHeaderToggle } from "./right-sidebar-collapse"
import { ChatAvatarSlot, ChatDayDivider, ChatMessageMeta, SystemNote } from "./chat-message-parts"
import { TicketIdPill } from "./ticket-id-pill"
import { buildThreadRows, formatChatTime, formatDayDividerLabel } from "@/lib/chat-thread"
import { EndSessionRequestDialog, EndSessionRequestedBanner } from "@/components/ticket-chat/end-session-request"
import {
  TimeEntrySummaryBanner,
  TimeEntrySummaryDialog,
  TimeReviewSystemMessage,
  type TimeEntrySummaryDecline,
  type TimeEntrySummaryItem,
} from "@/components/ticket-chat/time-entry-review"
import { describeAutoAcceptDeadline } from "@/lib/time-entries"
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachments"
import { appendToDraft } from "@/lib/ticket-attachments"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { isPaymentFailedCtaLive } from "@/lib/customer-chat-messages"
import { VisitorLeftAction } from "@/components/ticket-chat/guest-ticket"
import type { TicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { ListSkeleton } from "@/components/ui/skeleton"
import { GuestName } from "@/components/ui/guest-name"

export type PaymentSystemMessageKind =
  | "payment_required"
  | "payment_authorized"
  | "payment_requires_action"
  | "payment_hold_declined"
  | "payment_cap_exceeded"
  | "payment_failed"
  | "payment_completed"
  /** The final remainder was below the card minimum and written off. */
  | "payment_remainder_waived"
  /** Money captured on a ticket that ended cancelled; flagged for a refund. */
  | "payment_refund_needed"
  | "sla_covered"
  | "free_support"

/**
 * `metadata.kind` of persisted system messages. Payment kinds are written by
 * the payments edge functions; `time_logged` is written by the DB trigger on
 * `tickets_time_entries` (migration 20260908120000_time_logged_system_messages);
 * `time_entry_deleted` by the delete trigger (migration
 * 20260927120000_time_entries_helper_delete_own); `time_review_requested` /
 * `time_entries_confirmed` by the `request_time_entry_review` /
 * `confirm_time_entries` RPCs (migration
 * 20261008120000_time_entries_summary_confirmation). `time_entry_accepted` /
 * `time_entry_declined` come from the per-entry `review_time_entry` RPC, which
 * the web app no longer calls (older tickets and the MCP agent API still do).
 */
export type SystemMessageKind =
  | PaymentSystemMessageKind
  | "time_logged"
  | "time_entry_accepted"
  | "time_entry_declined"
  | "time_entry_deleted"
  | "time_review_requested"
  | "time_entries_confirmed"
  // Guest tickets (migration 20261029150000_guest_tickets): the cron closed it
  // because the visitor left / the visitor signed in (adopt-guest-tickets).
  | "visitor_left"
  | "guest_signed_in"

export type TicketChatMessage = {
  id: string
  senderType: "user" | "helper" | "system"
  senderName?: string | null
  senderAvatarInitial?: string | null
  senderAvatarUrl?: string | null
  senderId?: string | null
  /** The sender is a guest (not signed in): ghost avatar and muted name (`senderName` is their guest label). */
  senderIsGuest?: boolean
  /** Guests only: full email or guest identifier, for the name tooltip. */
  senderGuestFull?: string | null
  timestamp: string
  /**
   * Raw ISO time of a persisted message (or the pending first message's
   * ticket time). Absent on synthetic messages (welcome, claimed, auto-reply,
   * session summary). Drives day dividers and grouping in `lib/chat-thread`.
   */
  createdAt?: string
  content: string
  kind?: "claimed" | "ended"
  paymentMetadata?: {
    kind: SystemMessageKind
    [key: string]: unknown
  } | null
}

export type TicketChatParticipant = {
  id: string
  name: string
  avatarInitial: string
  avatarUrl?: string | null
  isCurrentUser?: boolean
  /** A guest (not signed in): ghost avatar and muted name (`name` is their guest label). */
  isGuest?: boolean
  /** Guests only: full email or guest identifier, for the name tooltip. */
  guestFull?: string | null
}

export interface TicketChatProps {
  headerTitle: string
  /**
   * `chat` is the compact ticket header (one 60px row, 16px semibold title);
   * `default` keeps the standard page header (the /support project header).
   */
  headerVariant?: "default" | "chat"
  /** The ticket's id, shown as a copyable pill next to the title. Omit before a ticket exists. */
  ticketId?: string
  /** Subtitle text rendered below the title in the header (separate from inline headerSubtitle). */
  subtitle?: string
  /** Optional icon rendered to the left of the title/subtitle block in the header. */
  headerLeadingIcon?: React.ReactNode
  /** Optional CSS background color applied to the header container. */
  headerBackgroundColor?: string
  showBackButton?: boolean

  // Intro section shown above the message thread (rates, ticket meta, CTA buttons, etc.)
  intro?: React.ReactNode

  // Thread + participants
  messages: TicketChatMessage[]
  participants?: TicketChatParticipant[]
  participantsLoading?: boolean
  /**
   * Whether a helper has claimed or joined the ticket. `false` shows "No
   * helper has joined yet." under the participant rows (not while loading).
   */
  helperJoined?: boolean

  topics?: string[]
  helpTypes?: string[]

  // Input
  message: string
  onMessageChange: (v: string) => void
  onSend: () => void | Promise<void>
  sendDisabled?: boolean
  /** A send is in flight (see TicketChatInput). */
  sending?: boolean
  /** Composer placeholder, e.g. `composerPlaceholder(project)` → "Ask #slug". */
  composerPlaceholder?: string
  /** Closed ticket: the composer and attachments are disabled. */
  isEnded?: boolean
  /**
   * Rendered in place of the composer, e.g. a "Sign in to start a ticket"
   * call-to-action for a visitor without a session.
   */
  composerReplacement?: React.ReactNode
  /** Rendered directly above the composer, e.g. the guest "Sign in" banner. */
  composerBanner?: React.ReactNode
  /**
   * "Start a new conversation" on a `visitor_left` system message (the guest
   * ticket was closed because the visitor left). Omit to hide the action.
   */
  onStartNewConversation?: () => void
  /**
   * The viewer is a guest: payment CTAs (add / update card, pay yourself)
   * need an account, so they become "Sign in" prompts calling `onSignInClick`.
   */
  paymentRequiresSignIn?: boolean
  onSignInClick?: () => void

  /**
   * Customer-side "End session". Pressing the header button does not end the
   * ticket — it asks the helper to finalise. When `endSessionRequestedAt` is
   * set, the button is replaced by a status banner with a cancel action.
   * Omit `onRequestEndSession` to hide the button entirely (e.g. no ticket yet).
   */
  onRequestEndSession?: () => void | Promise<void>
  onCancelEndSessionRequest?: () => void | Promise<void>
  endSessionRequestedAt?: string | null
  endSessionRequestPending?: boolean

  /**
   * Customer-side confirmation of the logged-time summary. When the helper
   * has sent it (`timeReviewRequestedAt` set on the ticket) and
   * `onConfirmTimeEntries` is provided, a banner above the input opens the
   * summary dialog (it also opens by itself when the request arrives). The
   * dialog lists `timeEntrySummary` and confirms everything pending in one
   * go, with optional per-entry declines that need a reason. Omit the handler
   * on the helper side.
   */
  timeReviewRequestedAt?: string | null
  timeEntrySummary?: TimeEntrySummaryItem[]
  onConfirmTimeEntries?: (declines: TimeEntrySummaryDecline[]) => void | Promise<void>
  timeEntryConfirmPending?: boolean
  /** Name shown in the summary banner ("Ada is ready to end the session…"). */
  timeReviewHelperName?: string | null

  /**
   * When provided, enables image attachments (toolbar button, paste, drag & drop).
   * Format: "{projectId}/{ticketId}" — or "{projectId}/{userId}" before the
   * ticket exists — used as the folder inside the ticket-attachments bucket.
   * Uploaded images are added to the message as markdown via `onMessageChange`.
   */
  attachmentStoragePrefix?: string

  // Right-side extras
  rightSidebarFooter?: React.ReactNode
  /**
   * Identity of the thread being shown (the ticket id). When it changes, the
   * next thread's history renders without the new-message animation.
   */
  threadKey?: string

  /**
   * Called when the user clicks a payment CTA on a system message: "Add
   * payment method" (payment_required), "Pay yourself instead"
   * (payment_cap_exceeded) or "Update payment method" (payment_failed).
   * Branch on `msg.paymentMetadata?.kind`.
   */
  onPaymentCtaClick?: (msg: TicketChatMessage) => void
  paymentCtaLoading?: boolean
  /**
   * The ticket's payment status (useTicketPaymentStatus). Once the ticket is
   * ended (`isEnded`) and this is no longer "failed", "Update payment method"
   * CTAs are retired (see isPaymentFailedCtaLive).
   */
  paymentStatus?: TicketPaymentStatus
}

/** Gutter of the banners above the composer: 48px like the thread, 16px below `md`. */
const BANNER_GUTTER = "mx-4 md:mx-12"

/** "HH:MM" for a message: from its raw time, else the time part of its formatted timestamp. */
function messageTime(msg: TicketChatMessage): string | null {
  if (msg.createdAt) return formatChatTime(msg.createdAt)
  return msg.timestamp.match(/\d{2}:\d{2}$/)?.[0] ?? null
}

/**
 * Colours of a status system message (payment authorized, cap exceeded,
 * failed, refund/waived, declined time…), or null for the default grey kind,
 * which renders as a `SystemNote`.
 */
function statusBoxClass(msg: TicketChatMessage): string | null {
  const meta = msg.paymentMetadata
  switch (meta?.kind) {
    case "payment_authorized":
    case "guest_signed_in":
      return "bg-status-success-bg text-status-success-text"
    case "payment_cap_exceeded":
      return "bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100"
    case "payment_failed":
      return "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
    case "payment_refund_needed":
    case "payment_remainder_waived":
      return "bg-background border border-border text-foreground"
    case "time_entries_confirmed":
      if (!Array.isArray(meta.declined) || meta.declined.length === 0) return null
    // falls through
    case "time_entry_declined":
    case "payment_hold_declined":
      return "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
    default:
      return null
  }
}

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
    headerVariant = "default",
    ticketId,
    subtitle,
    headerLeadingIcon,
    headerBackgroundColor,
    showBackButton,
    intro,
    messages,
    participants,
    participantsLoading,
    helperJoined,
    topics = [],
    message,
    onMessageChange,
    onSend,
    sendDisabled,
    sending,
    composerPlaceholder,
    isEnded,
    composerReplacement,
    composerBanner,
    onStartNewConversation,
    paymentRequiresSignIn,
    onSignInClick,
    onRequestEndSession,
    onCancelEndSessionRequest,
    endSessionRequestedAt,
    endSessionRequestPending,
    timeReviewRequestedAt,
    timeEntrySummary,
    onConfirmTimeEntries,
    timeEntryConfirmPending,
    timeReviewHelperName,
    attachmentStoragePrefix,
    rightSidebarFooter,
    threadKey,
    onPaymentCtaClick,
    paymentCtaLoading,
    paymentStatus,
  } = props

  const [imageUploadOpen, setImageUploadOpen] = useState(false)
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false)
  // Collapsed state is shared across views via localStorage (see
  // right-sidebar-collapse.tsx).
  const { isCollapsed, setCollapsed } = useRightSidebarCollapsed()
  // Below lg the right panel is an off-canvas sheet.
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const endSessionRequested = !!endSessionRequestedAt && !isEnded

  // Logged-time summary the customer confirms before the session ends. The
  // helper's request lives on the ticket row (realtime), so the dialog is
  // derived from it: open for an outstanding request until the customer
  // dismisses that particular request (keyed by its timestamp), and
  // reopenable from the banner. A later request opens it again.
  const summaryRequested = !!timeReviewRequestedAt && !isEnded && !!onConfirmTimeEntries
  const [summaryDismissedFor, setSummaryDismissedFor] = useState<string | null>(null)
  const summaryOpen = summaryRequested && summaryDismissedFor !== timeReviewRequestedAt
  const setSummaryOpen = (open: boolean) => setSummaryDismissedFor(open ? null : (timeReviewRequestedAt ?? null))
  const summaryPendingCount = useMemo(
    () => (timeEntrySummary ?? []).filter((e) => e.reviewStatus === "pending").length,
    [timeEntrySummary],
  )

  // Uploads finish asynchronously, so append to the latest draft rather than
  // the one captured when the upload started.
  const messageRef = useRef(message)
  useEffect(() => {
    messageRef.current = message
  }, [message])
  const handleImageAttached = useCallback(
    (markdown: string) => {
      const next = appendToDraft(messageRef.current, markdown)
      messageRef.current = next
      onMessageChange(next)
    },
    [onMessageChange],
  )
  const { uploadFiles, isUploading } = useTicketAttachmentUpload(attachmentStoragePrefix, handleImageAttached)


  // Scroll container (the thread) and the sentinel after the last message.
  const scrollBoxRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })

  // Opening a thread (first render, a `threadKey` change, or its history
  // arriving from the server) jumps straight to the newest message. Messages
  // that come in after that scroll smoothly.
  const hasHistory = messages.some((m) => !!m.createdAt)
  const anchorRef = useRef<{ key: string | undefined; history: boolean } | null>(null)
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const sameThread = anchor !== null && anchor.key === threadKey
    const opening = !sameThread || (!anchor.history && hasHistory)
    anchorRef.current = { key: threadKey, history: hasHistory || (sameThread && anchor.history) }
    if (opening) {
      const box = scrollBoxRef.current
      if (box) box.scrollTop = box.scrollHeight
      return
    }
    // Defer to after layout so any ended/outcome summary (driven by ticket
    // status, not message count) is measured before we scroll to the bottom.
    const id = requestAnimationFrame(() => scrollToBottom())
    return () => cancelAnimationFrame(id)
  }, [threadKey, messages.length, isEnded, hasHistory])

  const thread = useMemo(() => messages ?? [], [messages])
  // Day dividers and sender grouping. The first divider sits above the intro
  // (the welcome message), so it is rendered there instead of on the first row.
  const { rows, topDayLabel } = useMemo(() => {
    const now = new Date()
    const built = buildThreadRows(thread, now)
    return { rows: built, topDayLabel: built[0]?.showDayDivider ?? formatDayDividerLabel(now, now) }
  }, [thread])
  // Messages present when a thread first loads don't animate; later ones do.
  // (State set during render when the first non-empty thread for this
  // `threadKey` arrives; switching tickets takes a fresh snapshot.)
  const [initialMessages, setInitialMessages] = useState<{ key: string | undefined; ids: Set<string> } | null>(null)
  if ((initialMessages === null || initialMessages.key !== threadKey) && thread.length > 0) {
    setInitialMessages({ key: threadKey, ids: new Set(thread.map((m) => m.id)) })
  }
  const isNewMessage = (id: string) =>
    initialMessages !== null && initialMessages.key === threadKey && !initialMessages.ids.has(id)

  // A payment_required / payment_cap_exceeded prompt is stale once a hold is
  // authorized *after* it. A later prompt (e.g. a failed weekly re-hold) is live
  // again even though an earlier hold was authorized (index = chronological order).
  const lastAuthorizedIdx = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) {
      if (thread[i].senderType === "system" && thread[i].paymentMetadata?.kind === "payment_authorized") return i
    }
    return -1
  }, [thread])
  const isPromptResolved = (msg: (typeof thread)[number]) => lastAuthorizedIdx > thread.indexOf(msg)
  // A payment_failed CTA stays live until a later settling message (paid,
  // remainder waived, refund flagged) or until the ended ticket's payment is
  // no longer failed (index order = chronological order).
  const isFailedCtaLive = (msg: (typeof thread)[number]) =>
    isPaymentFailedCtaLive(thread, thread.indexOf(msg), { ticketClosed: isEnded, paymentStatus })
  // Guests have no account to attach a card to: every payment CTA asks them to sign in.
  const handlePaymentCta = (msg: (typeof thread)[number]) => {
    if (paymentRequiresSignIn) onSignInClick?.()
    else onPaymentCtaClick?.(msg)
  }
  const ctaLabel = (label: string) => (paymentRequiresSignIn ? "Sign in to continue" : label)
  const ctaLoading = !paymentRequiresSignIn && !!paymentCtaLoading

  /** Actions under a system message's text (payment CTAs, "Start a new conversation"). */
  const renderSystemActions = (msg: TicketChatMessage) => {
    const kind = msg.paymentMetadata?.kind
    return (
      <>
        {kind === "visitor_left" && onStartNewConversation && (
          <VisitorLeftAction onStartNewConversation={onStartNewConversation} />
        )}
        {kind === "payment_required" && !isPromptResolved(msg) && (
          <div className="mt-2">
            <Button type="button" variant="brand" onClick={() => handlePaymentCta(msg)} loading={ctaLoading}>
              {ctaLabel("Add payment method")}
            </Button>
            {typeof msg.paymentMetadata?.hold_amount_smallest_unit === "number" &&
              msg.paymentMetadata.hold_amount_smallest_unit > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Once your card is saved we place a temporary hold of $
                  {(msg.paymentMetadata.hold_amount_smallest_unit / 100).toFixed(2)} on it. This is not a
                  charge: you only pay for the time your helper logs.
                </p>
              )}
          </div>
        )}
        {kind === "payment_failed" && isFailedCtaLive(msg) && (
          <div className="mt-2">
            <Button type="button" variant="brand" onClick={() => handlePaymentCta(msg)} loading={ctaLoading}>
              {ctaLabel("Update payment method")}
            </Button>
          </div>
        )}
        {kind === "payment_cap_exceeded" && !isPromptResolved(msg) && (
          <div className="mt-2">
            <Button
              type="button"
              onClick={() => handlePaymentCta(msg)}
              loading={ctaLoading}
              className="bg-amber-900 text-amber-50 hover:bg-amber-800"
            >
              {ctaLabel("Pay yourself instead")}
            </Button>
          </div>
        )}
      </>
    )
  }

  const renderRowBody = (msg: TicketChatMessage, groupStart: boolean) => {
    // Claimed / ended banner: the helper's avatar and name, then the line with a check.
    if (msg.senderType === "system" && (msg.kind === "claimed" || msg.kind === "ended")) {
      return (
        <div data-slot="chat-banner-row" className="flex items-start gap-3">
          <ChatAvatarSlot kind="avatar" id={msg.senderId} name={msg.senderName} avatarUrl={msg.senderAvatarUrl} />
          <div className="min-w-0 flex-1">
            <ChatMessageMeta name={msg.senderName || "System"} time={messageTime(msg)} className="mb-1" />
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Icon name="fi-rr-check" className="text-brand-primary shrink-0" />
              <MarkdownContent content={msg.content} className="text-sm" />
            </div>
          </div>
        </div>
      )
    }

    if (msg.senderType === "system") {
      const kind = msg.paymentMetadata?.kind
      const statusClass = statusBoxClass(msg)
      // Grey system messages (disclaimer, auto-reply, session summary,
      // time_logged, …) are plain notes.
      if (!statusClass) {
        return kind === "time_entries_confirmed" ? (
          <SystemNote>
            <TimeReviewSystemMessage content={msg.content} metadata={msg.paymentMetadata} />
          </SystemNote>
        ) : (
          <SystemNote markdown={msg.content}>{renderSystemActions(msg)}</SystemNote>
        )
      }
      // Coloured status messages keep their box, indented by the avatar column.
      return (
        <div data-slot="chat-status-row" className="flex items-start gap-3">
          <ChatAvatarSlot kind="spacer" />
          <div className={cn("min-w-0 flex-1 rounded-lg px-4 py-2 text-left text-sm", statusClass)}>
            {kind === "time_entries_confirmed" ? (
              <TimeReviewSystemMessage content={msg.content} metadata={msg.paymentMetadata} />
            ) : (
              <MarkdownContent content={kind === "payment_authorized" ? `✓ ${msg.content}` : msg.content} />
            )}
            {renderSystemActions(msg)}
          </div>
        </div>
      )
    }

    // User / helper message. Follow-ups in a group keep the column but show
    // no avatar, name or time.
    return (
      <div data-slot="chat-message-row" data-group-start={groupStart ? "" : undefined} className="flex items-start gap-3">
        {groupStart ? (
          <ChatAvatarSlot
            kind="avatar"
            id={msg.senderId}
            name={msg.senderName}
            avatarUrl={msg.senderAvatarUrl}
            guest={msg.senderIsGuest}
          />
        ) : (
          <ChatAvatarSlot kind="spacer" />
        )}
        <div className="min-w-0 flex-1">
          {groupStart && (
            <ChatMessageMeta
              name={msg.senderName || (msg.senderIsGuest ? "Guest" : msg.senderType === "user" ? "User" : "Unknown")}
              guest={msg.senderIsGuest}
              guestFull={msg.senderGuestFull}
              time={messageTime(msg)}
              className="mb-1"
            />
          )}
          <div className="text-sm text-foreground">
            <MarkdownContent content={msg.content} />
          </div>
        </div>
      </div>
    )
  }

  const showEndSession = !isEnded && !!onRequestEndSession && !endSessionRequested
  const showNoHelper = !participantsLoading && helperJoined === false
  const hasParticipants = !!participants && participants.length > 0

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left column: Header + main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative z-10">
          <Header
            variant={headerVariant}
            title={headerTitle}
            subtitle={subtitle}
            showBackButton={showBackButton}
            leadingIcon={headerLeadingIcon}
            backgroundColor={headerBackgroundColor}
            inlineRightContent={ticketId ? <TicketIdPill id={ticketId} /> : undefined}
            actions={
              <>
                {showEndSession && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEndSessionDialogOpen(true)}
                    disabled={endSessionRequestPending}
                  >
                    <Icon name="fi-rr-sign-out-alt" />
                    End session
                  </Button>
                )}
                <RightSidebarHeaderToggle
                  isCollapsed={isCollapsed}
                  onToggle={setCollapsed}
                  mobileOpen={mobilePanelOpen}
                  onMobileToggle={() => setMobilePanelOpen((v) => !v)}
                />
              </>
            }
          />
        </div>

        {/* Chat area: white from below the header down to the composer. */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages: the scroll container */}
            <div
              ref={scrollBoxRef}
              data-slot="chat-scroll"
              className="flex-1 min-h-0 overflow-auto"
              onLoadCapture={(e) => {
                // Images load after the initial scroll and push the thread
                // down; keep it pinned to the bottom if it was there.
                if (!(e.target instanceof HTMLImageElement)) return
                const box = e.currentTarget
                const distance = box.scrollHeight - box.scrollTop - box.clientHeight
                if (distance <= e.target.offsetHeight + 120) scrollToBottom()
              }}
            >
              {/* Short threads sit at the bottom, next to the composer. */}
              <div className="flex min-h-full flex-col justify-end">
                <div className="flex flex-col px-6 py-5 md:px-12">
                  {(intro || rows.length > 0) && <ChatDayDivider label={topDayLabel} className="mb-4" />}
                  {intro}

                  {rows.map((row, index) => {
                    const msg = row.item
                    const followUp = !row.groupStart
                    return (
                      <Fragment key={msg.id}>
                        {index > 0 && row.showDayDivider && (
                          <ChatDayDivider label={row.showDayDivider} className="mt-4" />
                        )}
                        <div
                          className={cn(
                            followUp ? "mt-1" : (index > 0 || intro) && "mt-4",
                            isNewMessage(msg.id) && "animate-enter",
                          )}
                        >
                          {renderRowBody(msg, row.groupStart)}
                        </div>
                      </Fragment>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {summaryRequested && (
              <TimeEntrySummaryBanner
                className={BANNER_GUTTER}
                pendingCount={summaryPendingCount}
                helperName={timeReviewHelperName}
                autoAcceptHint={describeAutoAcceptDeadline(timeReviewRequestedAt)}
                onReview={() => setSummaryOpen(true)}
              />
            )}

            {endSessionRequested && (
              <EndSessionRequestedBanner
                className={BANNER_GUTTER}
                requestedAt={endSessionRequestedAt}
                pending={endSessionRequestPending}
                onCancel={() => void onCancelEndSessionRequest?.()}
              />
            )}

            {/* Page banners bring their own 16px margin; the wrapper adds the rest of the 48px gutter. */}
            {composerBanner && <div className="md:px-8">{composerBanner}</div>}

            {composerReplacement ?? (
              <div className="px-4 md:px-12">
                <TicketChatInput
                  value={message}
                  onChange={onMessageChange}
                  onSend={onSend}
                  sendDisabled={sendDisabled}
                  sending={sending}
                  disabled={isEnded}
                  placeholder={composerPlaceholder}
                  onImageClick={attachmentStoragePrefix && !isEnded ? () => setImageUploadOpen(true) : undefined}
                  onImageFiles={attachmentStoragePrefix && !isEnded ? uploadFiles : undefined}
                  imagesUploading={isUploading}
                />
              </div>
            )}

            {onRequestEndSession && (
              <EndSessionRequestDialog
                open={endSessionDialogOpen}
                onOpenChange={setEndSessionDialogOpen}
                pending={endSessionRequestPending}
                onConfirm={async () => {
                  await onRequestEndSession()
                  setEndSessionDialogOpen(false)
                }}
              />
            )}

            {onConfirmTimeEntries && (
              <TimeEntrySummaryDialog
                open={summaryOpen}
                onOpenChange={setSummaryOpen}
                entries={timeEntrySummary ?? []}
                pending={timeEntryConfirmPending}
                autoAcceptHint={describeAutoAcceptDeadline(timeReviewRequestedAt)}
                onConfirm={async (declines) => {
                  // The page handler toasts and rethrows; stay open on failure
                  // so the decline reasons aren't lost.
                  try {
                    await onConfirmTimeEntries(declines)
                    setSummaryOpen(false)
                  } catch {
                    /* handled by the page */
                  }
                }}
              />
            )}

            {attachmentStoragePrefix && !isEnded && (
              <AttachImageModal
                open={imageUploadOpen}
                onOpenChange={setImageUploadOpen}
                storagePrefix={attachmentStoragePrefix}
                onAttached={handleImageAttached}
              />
            )}
          </div>
        </main>
      </div>

      {/* Right Sidebar */}
      {mobilePanelOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" aria-hidden onClick={() => setMobilePanelOpen(false)} />
      )}
      <div
        suppressHydrationWarning
        data-slot="chat-right-panel"
        className={cn(
          "bg-background border-l border-border flex flex-col overflow-hidden transition-[width] duration-slow ease-in-out",
          // Below lg the panel is an off-canvas sheet toggled from the header.
          "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-80 max-lg:max-w-[85vw] max-lg:shadow-modal",
          !mobilePanelOpen && "max-lg:hidden",
          "lg:relative lg:z-20",
          // Collapsed from the header toggle: the panel closes completely on
          // desktop (there is no in-panel toggle row to keep a rail for).
          isCollapsed ? "lg:w-0 lg:border-l-0" : "lg:w-80",
        )}
      >
        <div
          suppressHydrationWarning
          className={cn("w-80 max-w-full flex-1 overflow-y-auto px-4 pt-4 pb-6", isCollapsed && "lg:hidden")}
        >
          {/* People in Chat */}
          <div>
            <SidebarSectionHeading>People in this chat</SidebarSectionHeading>

            {participantsLoading ? (
              <ListSkeleton rows={2} badge={false} className="divide-y-0 [&>div]:px-0" />
            ) : hasParticipants ? (
              <div className="space-y-2 mb-3">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <ProfileAvatar id={p.id} name={p.name} avatarUrl={p.avatarUrl ?? null} guest={p.isGuest} size="md" />
                    {p.isGuest && !p.isCurrentUser ? (
                      <GuestName label={p.name} full={p.guestFull} className="text-ui" />
                    ) : (
                      <span className="text-ui text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !showNoHelper && <SidebarEmpty />
            )}

            {showNoHelper && <SidebarEmptyText className="mb-2">No helper has joined yet.</SidebarEmptyText>}

            {!isEnded && (
              <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10" title={ILLUSTRATIVE_BUTTON_TOOLTIP}>
                <Icon name="fi-rr-plus" />
                Invite other helper
              </Button>
            )}
          </div>

          <SidebarDivider />

          {/* Other Topics */}
          <div>
            <SidebarSectionHeading info>Other topics in this chat</SidebarSectionHeading>

            {topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <SidebarEmptyText>No other topics yet.</SidebarEmptyText>
            )}
          </div>

          {/* Page-specific sections (Logged time / Active tickets), separated like the sections above */}
          {rightSidebarFooter && (
            <>
              <SidebarDivider />
              {rightSidebarFooter}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
