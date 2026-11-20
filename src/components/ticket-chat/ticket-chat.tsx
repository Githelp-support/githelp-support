"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import { AttachImageModal } from "@/components/ticket-chat/attach-image-modal"
import { TicketIdPill } from "@/components/ticket-chat/ticket-id-pill"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { SidebarSectionHeading, SidebarDivider } from "./sidebar-section"
import { useRightSidebarCollapsed, RightSidebarCollapseToggle } from "./right-sidebar-collapse"
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
import { groupChatMessages, type ChatRenderItem } from "@/lib/chat-grouping"
import { formatDayLabel, formatTime } from "@/lib/format"

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
  /** Raw ISO instant of the message, for day dividers, grouping and HH:MM times (see lib/chat-grouping). */
  createdAt?: string | null
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
  /** Optional extra classes applied to the header title (e.g. to override its font size). */
  headerTitleClassName?: string
  /** Full ticket ID; shown beside the title as a short ID pill with a copy button. */
  ticketId?: string | null
  /** Subtitle text rendered below the title in the header. */
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

  topics?: string[]
  helpTypes?: string[]

  // Input
  message: string
  onMessageChange: (v: string) => void
  onSend: () => void | Promise<void>
  sendDisabled?: boolean
  /** A send is in flight (see TicketChatInput). */
  sending?: boolean
  /** Closed ticket: the composer and attachments are disabled. */
  isEnded?: boolean
  /** Composer placeholder, e.g. "Ask #acme". Falls back to TicketChatInput's default. */
  composerPlaceholder?: string
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
   * Customer-side "End session". Pressing the toolbar button does not end the
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

/** Width of the 30px avatar column; rows without an avatar keep it as a spacer. */
const AVATAR_COLUMN_CLASS = "w-7.5 shrink-0"
const SENDER_NAME_CLASS = "text-sm font-semibold text-foreground"
const MESSAGE_TIME_CLASS = "font-mono text-xs tabular-nums text-muted-foreground"
/**
 * Puts a note's markdown (the first block after the "Note · " label) on the
 * label's line at the note size; later paragraphs and actions stay below.
 */
const NOTE_BODY_CLASS =
  "[&>div:first-of-type]:inline [&>div:first-of-type]:text-ui! [&>div:first-of-type_p]:text-ui! [&>div:first-of-type>p:first-child]:inline"

/** HH:MM of the message; the preformatted `timestamp` when there is no usable `createdAt`. */
function messageTime(msg: TicketChatMessage): string {
  if (msg.createdAt) {
    const date = new Date(msg.createdAt)
    if (!Number.isNaN(date.getTime())) return formatTime(date)
  }
  return msg.timestamp
}

/** Colours of the payment/status callouts; `null` for system messages rendered as a plain note. */
function systemCalloutClass(metadata: TicketChatMessage["paymentMetadata"]): string | null {
  const kind = metadata?.kind
  if (kind === "payment_authorized" || kind === "guest_signed_in") {
    return "bg-status-success-bg text-status-success-text"
  }
  if (kind === "payment_cap_exceeded") {
    return "bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100"
  }
  if (kind === "payment_failed") {
    return "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
  }
  if (kind === "payment_refund_needed" || kind === "payment_remainder_waived") {
    return "bg-background border border-border text-foreground"
  }
  if (
    kind === "time_entry_declined" ||
    kind === "payment_hold_declined" ||
    (kind === "time_entries_confirmed" && Array.isArray(metadata?.declined) && metadata.declined.length > 0)
  ) {
    return "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
  }
  return null
}

/** Day divider of the thread: a hairline with a centred "Today" / "Yesterday" / "Sunday 15 November" pill. Never animates. */
function ChatDayDivider({ date }: { date: string }) {
  return (
    <div role="separator" className="relative flex items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 border-t border-border-subtle" aria-hidden />
      <span className="relative rounded-full border border-border-subtle bg-background px-3 py-0.5 font-sans text-xs text-muted-foreground">
        {formatDayLabel(date)}
      </span>
    </div>
  )
}

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
    headerTitleClassName,
    ticketId,
    subtitle,
    headerLeadingIcon,
    headerBackgroundColor,
    showBackButton,
    intro,
    messages,
    participants,
    participantsLoading,
    topics = [],
    message,
    onMessageChange,
    onSend,
    sendDisabled,
    sending,
    isEnded,
    composerPlaceholder,
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })

  useEffect(() => {
    // Defer to after layout so any ended/outcome summary (driven by ticket
    // status, not message count) is measured before we scroll to the bottom.
    const id = requestAnimationFrame(() => scrollToBottom())
    return () => cancelAnimationFrame(id)
  }, [messages.length, isEnded])

  const thread = useMemo(() => messages ?? [], [messages])
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

  const renderItems = useMemo(() => groupChatMessages(thread), [thread])
  // A day divider and every group start open a new block, so the gap inside a
  // sender group can be tighter than the gap between groups.
  const messageGroups = useMemo(() => {
    const groups: ChatRenderItem[][] = []
    for (const item of renderItems) {
      if (item.type === "day" || item.isGroupStart || groups.length === 0) groups.push([item])
      else groups[groups.length - 1].push(item)
    }
    return groups
  }, [renderItems])

  const renderMessage = (msg: TicketChatMessage, isGroupStart: boolean) => {
    const rowClass = cn("flex items-start gap-3", isNewMessage(msg.id) && "animate-enter")
    const kind = msg.paymentMetadata?.kind

    if (msg.senderType === "system" && (msg.kind === "claimed" || msg.kind === "ended")) {
      return (
        <div key={msg.id} className={rowClass}>
          <ProfileAvatar id={msg.senderId} name={msg.senderName} avatarUrl={msg.senderAvatarUrl ?? null} size="chat" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={SENDER_NAME_CLASS}>{msg.senderName || "System"}</span>
              <span className={MESSAGE_TIME_CLASS}>{messageTime(msg)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Icon name="fi-rr-check" className="text-brand-primary shrink-0" />
              <MarkdownContent content={msg.content} className="text-sm" />
            </div>
          </div>
        </div>
      )
    }

    if (msg.senderType !== "system") {
      return (
        <div key={msg.id} className={rowClass}>
          {isGroupStart ? (
            <ProfileAvatar
              id={msg.senderId}
              name={msg.senderName}
              avatarUrl={msg.senderAvatarUrl ?? null}
              guest={msg.senderIsGuest}
              size="chat"
            />
          ) : (
            <div className={AVATAR_COLUMN_CLASS} aria-hidden />
          )}
          <div className="flex-1">
            {isGroupStart && (
              <div className="flex items-center gap-2 mb-1">
                {msg.senderIsGuest ? (
                  <GuestName
                    label={msg.senderName || "Guest"}
                    full={msg.senderGuestFull}
                    className="text-sm font-semibold"
                  />
                ) : (
                  <span className={SENDER_NAME_CLASS}>
                    {msg.senderName || (msg.senderType === "user" ? "User" : "Unknown")}
                  </span>
                )}
                <span className={MESSAGE_TIME_CLASS}>{messageTime(msg)}</span>
              </div>
            )}
            <div className="text-sm text-foreground">
              <MarkdownContent content={msg.content} />
            </div>
          </div>
        </div>
      )
    }

    const systemBody = (
      <>
        {kind === "time_entries_confirmed" ? (
          <TimeReviewSystemMessage content={msg.content} metadata={msg.paymentMetadata ?? undefined} />
        ) : (
          <MarkdownContent content={kind === "payment_authorized" ? `✓ ${msg.content}` : msg.content} />
        )}
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

    // Coloured payment/status callouts keep their box, starting at the text column.
    const calloutClass = systemCalloutClass(msg.paymentMetadata)
    if (calloutClass) {
      return (
        <div key={msg.id} className={rowClass}>
          <div className={AVATAR_COLUMN_CLASS} aria-hidden />
          <div className="flex-1">
            <div className={cn(calloutClass, "py-2 px-4 rounded-lg text-sm text-left")}>{systemBody}</div>
          </div>
        </div>
      )
    }

    // Plain system notes: info icon in the avatar column, "Note · " + the text, no box.
    return (
      <div key={msg.id} className={rowClass} data-slot="chat-note">
        <div className={cn(AVATAR_COLUMN_CLASS, "flex h-4.5 items-center justify-center text-text-note")}>
          <Icon name="fi-rr-info" size={3.5} />
        </div>
        <div className={cn("flex-1 text-ui text-text-note", NOTE_BODY_CLASS)}>
          <span className="font-semibold">Note</span>
          {" · "}
          {systemBody}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left column: Header + main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative z-10">
          <Header
            title={headerTitle}
            titleClassName={headerTitleClassName}
            subtitle={subtitle}
            showBackButton={showBackButton}
            leadingIcon={headerLeadingIcon}
            backgroundColor={headerBackgroundColor}
            inlineRightContent={
              ticketId ? <TicketIdPill ticketId={ticketId} /> : undefined
            }
            actions={
              <>
              {!isEnded && onRequestEndSession && !endSessionRequested && (
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden text-text-muted"
                aria-label="Ticket details"
                aria-expanded={mobilePanelOpen}
                onClick={() => setMobilePanelOpen((v) => !v)}
              >
                <Icon name="fi-rr-sidebar-flip" />
              </Button>
              </>
            }
          />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 p-4 flex flex-col min-h-0">
              {/* Chat Messages Container */}
              <div
                className="flex-1 overflow-auto"
                onLoadCapture={(e) => {
                  // Images load after the initial scroll and push the thread
                  // down; keep it pinned to the bottom if it was there.
                  if (!(e.target instanceof HTMLImageElement)) return
                  const box = e.currentTarget
                  const distance = box.scrollHeight - box.scrollTop - box.clientHeight
                  if (distance <= e.target.offsetHeight + 120) scrollToBottom()
                }}
              >
                <div className="px-6 py-5">
                  <div className="flex flex-col gap-8">
                    {intro}

                    {/* Chat Messages: sender groups 16px apart, 4px between the messages of one group */}
                    <div className="flex flex-col gap-4">
                      {messageGroups.map((group) => (
                        <div key={group[0].id} className="flex flex-col gap-1">
                          {group.map((item) =>
                            item.type === "day" ? (
                              <ChatDayDivider key={item.id} date={item.date} />
                            ) : (
                              renderMessage(item.message, item.isGroupStart)
                            ),
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-width line under chat */}
              <div className="w-full border-b border-border"></div>
            </div>
          </div>

          {summaryRequested && (
            <TimeEntrySummaryBanner
              pendingCount={summaryPendingCount}
              helperName={timeReviewHelperName}
              autoAcceptHint={describeAutoAcceptDeadline(timeReviewRequestedAt)}
              onReview={() => setSummaryOpen(true)}
            />
          )}

          {endSessionRequested && (
            <EndSessionRequestedBanner
              requestedAt={endSessionRequestedAt}
              pending={endSessionRequestPending}
              onCancel={() => void onCancelEndSessionRequest?.()}
            />
          )}

          {composerBanner}

          {composerReplacement ?? (
          <TicketChatInput
            value={message}
            onChange={onMessageChange}
            onSend={onSend}
            sendDisabled={sendDisabled}
            sending={sending}
            disabled={isEnded}
            placeholder={composerPlaceholder}
            autoGrow
            onImageClick={attachmentStoragePrefix && !isEnded ? () => setImageUploadOpen(true) : undefined}
            onImageFiles={attachmentStoragePrefix && !isEnded ? uploadFiles : undefined}
            imagesUploading={isUploading}
          />
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
        className={cn(
          "bg-background border-l border-border flex flex-col overflow-hidden transition-[width] duration-slow ease-in-out",
          // Below lg the panel is an off-canvas sheet toggled from the header.
          "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-80 max-lg:max-w-[85vw] max-lg:shadow-modal",
          !mobilePanelOpen && "max-lg:hidden",
          "lg:relative lg:z-20",
          isCollapsed ? "lg:w-16" : "lg:w-80",
        )}
      >
          <RightSidebarCollapseToggle isCollapsed={isCollapsed} onToggle={setCollapsed} />

          {!isCollapsed && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 max-lg:pt-4">
            {/* People in Chat */}
            <div>
              <SidebarSectionHeading>People in this chat</SidebarSectionHeading>

              {participantsLoading ? (
                <ListSkeleton rows={2} badge={false} className="divide-y-0 [&>div]:px-0" />
              ) : participants && participants.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <ProfileAvatar
                        id={p.id}
                        name={p.name}
                        avatarUrl={p.avatarUrl ?? null}
                        guest={p.isGuest}
                        size="md"
                      />
                      {p.isGuest && !p.isCurrentUser ? (
                        <GuestName label={p.name} full={p.guestFull} className="text-ui" />
                      ) : (
                        <span className="text-ui text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {!participantsLoading && !participants?.some((p) => !p.isCurrentUser) && (
                <p className="mb-3 text-left text-ui text-text-note">No helper has joined yet.</p>
              )}

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
                <p className="text-left text-ui text-text-note">No other topics yet.</p>
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
          )}
        </div>
    </div>
  )
}
