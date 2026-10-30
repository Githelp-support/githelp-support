"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Plus } from "lucide-react"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import { AttachImageModal } from "@/components/ticket-chat/attach-image-modal"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { SidebarSectionHeading, SidebarDivider, SidebarEmpty } from "./sidebar-section"
import { useRightSidebarCollapsed, RightSidebarCollapseToggle } from "./right-sidebar-collapse"
import { EndSessionRequestDialog, EndSessionRequestedBanner } from "@/components/ticket-chat/end-session-request"
import {
  TimeEntrySummaryBanner,
  TimeEntrySummaryDialog,
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
  timestamp: string
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
}

export interface TicketChatProps {
  headerTitle: string
  /** Optional extra classes applied to the header title (e.g. to override its font size). */
  headerTitleClassName?: string
  headerSubtitle?: string
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

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
    headerTitleClassName,
    headerSubtitle,
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
    onPaymentCtaClick,
    paymentCtaLoading,
    paymentStatus,
  } = props

  const [imageUploadOpen, setImageUploadOpen] = useState(false)
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false)
  // Collapsed state is shared across views via localStorage (see
  // right-sidebar-collapse.tsx).
  const { isCollapsed, setCollapsed } = useRightSidebarCollapsed()
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
  const ctaLabel = (label: string) => (paymentRequiresSignIn ? "Sign in to continue" : paymentCtaLoading ? "Opening Stripe…" : label)

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
              headerSubtitle ? (
                <span className="text-ui font-normal font-mono tabular-nums text-muted-foreground/80">{headerSubtitle}</span>
              ) : undefined
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
                className="bg-card rounded-lg shadow-soft flex-1 overflow-auto"
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
                  <div className="flex flex-col" style={{ rowGap: '31.2px' }}>
                    {intro}

                    {/* Chat Messages */}
                    <div className="flex flex-col" style={{ rowGap: '16px' }}>
                      {thread.map((msg) => (
                        <div key={msg.id} className="flex gap-3 items-start">
                          {msg.senderType === "system" && (msg.kind === "claimed" || msg.kind === "ended") ? (
                            <div className="flex items-start gap-3 w-full">
                              <ProfileAvatar
                                id={msg.senderId}
                                name={msg.senderName}
                                avatarUrl={msg.senderAvatarUrl ?? null}
                                size="sm"
                                radius="9.625px"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm text-foreground font-medium">
                                    {msg.senderName || "System"}
                                  </span>
                                  <span
                                    className="text-xs"
                                    style={{
                                      color: "var(--muted-foreground)",
                                      fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {msg.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                                  <MarkdownContent content={msg.content} className="text-sm" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.senderType !== "system" && (
                                <ProfileAvatar
                                  id={msg.senderId}
                                  name={msg.senderName}
                                  avatarUrl={msg.senderAvatarUrl ?? null}
                                  size="sm"
                                  radius="9.625px"
                                />
                              )}

                              <div className="flex-1">
                                {msg.senderType !== "system" && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm text-foreground font-medium">
                                      {msg.senderName || (msg.senderType === "user" ? "User" : "Unknown")}
                                    </span>
                                    <span
                                      className="text-xs"
                                      style={{
                                        color: "var(--muted-foreground)",
                                        fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {msg.timestamp}
                                    </span>
                                  </div>
                                )}
                                <div
                                  className={
                                    msg.senderType === "system"
                                      ? msg.paymentMetadata?.kind === "payment_authorized" ||
                                        msg.paymentMetadata?.kind === "guest_signed_in"
                                        ? "bg-status-success-bg text-status-success-text py-2 px-4 rounded-lg text-sm text-left ml-11"
                                        : msg.paymentMetadata?.kind === "payment_cap_exceeded"
                                          ? "bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                          : msg.paymentMetadata?.kind === "payment_failed"
                                            ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                            : msg.paymentMetadata?.kind === "payment_refund_needed" ||
                                                msg.paymentMetadata?.kind === "payment_remainder_waived"
                                              ? "bg-background border border-border text-foreground py-2 px-4 rounded-lg text-sm text-left ml-11"
                                            : msg.paymentMetadata?.kind === "time_entry_declined" ||
                                                msg.paymentMetadata?.kind === "payment_hold_declined" ||
                                                (msg.paymentMetadata?.kind === "time_entries_confirmed" &&
                                                  Array.isArray(msg.paymentMetadata?.declined) &&
                                                  msg.paymentMetadata.declined.length > 0)
                                              ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                              : "bg-muted text-muted-foreground py-2 px-4 rounded-lg text-sm text-left ml-11"
                                      : "text-sm text-foreground"
                                  }
                                >
                                  <MarkdownContent
                                    content={
                                      msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_authorized"
                                        ? `✓ ${msg.content}`
                                        : msg.content
                                    }
                                  />
                                  {msg.senderType === "system" &&
                                    msg.paymentMetadata?.kind === "visitor_left" &&
                                    onStartNewConversation && (
                                    <VisitorLeftAction onStartNewConversation={onStartNewConversation} />
                                  )}
                                  {msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_required" && !isPromptResolved(msg) && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => handlePaymentCta(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-primary/90 disabled:opacity-60"
                                      >
                                        {ctaLabel("Add payment method")}
                                      </button>
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
                                  {msg.senderType === "system" &&
                                    msg.paymentMetadata?.kind === "payment_failed" &&
                                    isFailedCtaLive(msg) && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => handlePaymentCta(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-primary/90 disabled:opacity-60"
                                      >
                                        {ctaLabel("Update payment method")}
                                      </button>
                                    </div>
                                  )}
                                  {msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_cap_exceeded" && !isPromptResolved(msg) && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => handlePaymentCta(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-amber-900 hover:bg-amber-800 text-amber-50 px-4 py-2 text-sm font-medium disabled:opacity-60"
                                      >
                                        {ctaLabel("Pay yourself instead")}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
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
            placeholder="Message #askanything"
            onImageClick={attachmentStoragePrefix && !isEnded ? () => setImageUploadOpen(true) : undefined}
            onImageFiles={attachmentStoragePrefix && !isEnded ? uploadFiles : undefined}
            imagesUploading={isUploading}
            toolbarEndContent={
              !isEnded && onRequestEndSession && !endSessionRequested ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEndSessionDialogOpen(true)}
                  disabled={endSessionRequestPending}
                  className="cursor-pointer text-foreground font-semibold text-sm hover:bg-transparent"
                >
                  End session
                </Button>
              ) : undefined
            }
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
      <div
        suppressHydrationWarning
        className={`${isCollapsed ? "w-16" : "w-80"} bg-background border-l border-border relative z-20 flex flex-col transition-all duration-300 overflow-hidden`}
      >
          <RightSidebarCollapseToggle isCollapsed={isCollapsed} onToggle={setCollapsed} />

          {!isCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {/* People in Chat */}
            <div>
              <SidebarSectionHeading>People in this chat</SidebarSectionHeading>

              {participantsLoading ? (
                <SidebarEmpty className="text-sm">Loading...</SidebarEmpty>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <ProfileAvatar
                        id={p.id}
                        name={p.name}
                        avatarUrl={p.avatarUrl ?? null}
                        size="md"
                      />
                      <span className="text-ui text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <SidebarEmpty />
              )}

              {!isEnded && (
                <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10" title={ILLUSTRATIVE_BUTTON_TOOLTIP}>
                  <Plus className="w-4 h-4" />
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
                <SidebarEmpty />
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


