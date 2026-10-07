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
  TimeEntryReviewStatusBadge,
  TimeEntrySummaryBanner,
  TimeEntrySummaryDialog,
  type TimeEntrySummaryDecline,
  type TimeEntrySummaryItem,
} from "@/components/ticket-chat/time-entry-review"
import { describeAutoAcceptDeadline, type TimeEntryReviewStatus } from "@/lib/time-entries"
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachments"
import { appendToDraft } from "@/lib/ticket-attachments"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"

export type PaymentSystemMessageKind =
  | "payment_required"
  | "payment_authorized"
  | "payment_requires_action"
  | "payment_hold_declined"
  | "payment_cap_exceeded"
  | "payment_failed"
  | "payment_completed"
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

/** Current review state of one logged entry, keyed by `tickets_time_entries.id`. */
export type TicketChatTimeEntryReview = {
  status: TimeEntryReviewStatus
  declineReason?: string | null
  /** When the entry was logged and became pending. */
  reviewRequestedAt?: string | null
  autoAccepted?: boolean
}

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
  isEnded?: boolean

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
   * Review state of logged time. `timeEntryReviews` maps a time entry id
   * (from `time_logged` metadata) to its current status so confirmed /
   * declined entries are marked in their bubble; pending ones show nothing,
   * since confirmation happens once, at the end of the session.
   */
  timeEntryReviews?: Record<string, TicketChatTimeEntryReview>

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
}

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
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
    isEnded,
    onRequestEndSession,
    onCancelEndSessionRequest,
    endSessionRequestedAt,
    endSessionRequestPending,
    timeEntryReviews,
    timeReviewRequestedAt,
    timeEntrySummary,
    onConfirmTimeEntries,
    timeEntryConfirmPending,
    timeReviewHelperName,
    attachmentStoragePrefix,
    rightSidebarFooter,
    onPaymentCtaClick,
    paymentCtaLoading,
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
  const timeEntryReviewFor = (msg: TicketChatMessage): TicketChatTimeEntryReview | null => {
    if (msg.paymentMetadata?.kind !== "time_logged") return null
    const entryId = msg.paymentMetadata.time_entry_id
    if (typeof entryId !== "string") return null
    return timeEntryReviews?.[entryId] ?? null
  }

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

  // Once the ticket's payment is authorized, any earlier payment_required /
  // payment_cap_exceeded system messages are stale — suppress their CTAs so the
  // "Add payment method" button disappears after the hold is placed.
  const paymentResolved = useMemo(
    () => thread.some((m) => m.paymentMetadata?.kind === "payment_authorized"),
    [thread],
  )
  // A payment_failed CTA stays live until a later payment_completed message
  // confirms the retry went through (index order = chronological order).
  const paymentCompletedIdx = useMemo(
    () => thread.findIndex((m) => m.paymentMetadata?.kind === "payment_completed"),
    [thread],
  )

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left column: Header + main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative border-b border-border z-10">
          <Header
            title={headerTitle}
            subtitle={subtitle}
            showBackButton={showBackButton}
            leadingIcon={headerLeadingIcon}
            backgroundColor={headerBackgroundColor}
            inlineRightContent={
              headerSubtitle ? (
                <span className="text-[13px] font-normal font-mono tabular-nums text-muted-foreground/80">{headerSubtitle}</span>
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
                className="bg-white rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] flex-1 overflow-auto"
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
                                  <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>
                                    {msg.senderName || "System"}
                                  </span>
                                  <span
                                    className="text-xs"
                                    style={{
                                      color: 'rgba(0,0,0,0.5)',
                                      fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {msg.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm" style={{ color: '#2E2D31' }}>
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
                                    <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>
                                      {msg.senderName || (msg.senderType === "user" ? "User" : "Unknown")}
                                    </span>
                                    <span
                                      className="text-xs"
                                      style={{
                                        color: 'rgba(0,0,0,0.5)',
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
                                      ? msg.paymentMetadata?.kind === "payment_authorized"
                                        ? "bg-status-success-bg text-status-success-text py-2 px-4 rounded-lg text-sm text-left ml-11"
                                        : msg.paymentMetadata?.kind === "payment_cap_exceeded"
                                          ? "bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                          : msg.paymentMetadata?.kind === "payment_failed"
                                            ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                            : msg.paymentMetadata?.kind === "time_entry_declined" ||
                                                msg.paymentMetadata?.kind === "payment_hold_declined" ||
                                                (msg.paymentMetadata?.kind === "time_entries_confirmed" &&
                                                  Array.isArray(msg.paymentMetadata?.declined) &&
                                                  msg.paymentMetadata.declined.length > 0)
                                              ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                              : "bg-muted text-muted-foreground py-2 px-4 rounded-lg text-sm text-left ml-11"
                                      : "text-sm"
                                  }
                                  style={msg.senderType !== "system" ? { color: '#2E2D31' } : undefined}
                                >
                                  <MarkdownContent
                                    content={
                                      msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_authorized"
                                        ? `✓ ${msg.content}`
                                        : msg.content
                                    }
                                  />
                                  {msg.senderType === "system" &&
                                    msg.paymentMetadata?.kind === "time_logged" &&
                                    (() => {
                                      const review = timeEntryReviewFor(msg)
                                      // Pending is the normal state during a session; only a
                                      // decision is worth marking on the bubble.
                                      if (!review || review.status === "pending") return null
                                      return (
                                        <div className="mt-2">
                                          <TimeEntryReviewStatusBadge
                                            status={review.status}
                                            auto={review.autoAccepted}
                                            perspective={onConfirmTimeEntries ? "customer" : "helper"}
                                          />
                                        </div>
                                      )
                                    })()}
                                  {msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_required" && !paymentResolved && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => onPaymentCtaClick?.(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                                      >
                                        {paymentCtaLoading ? "Opening Stripe…" : "Add payment method"}
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
                                    (paymentCompletedIdx === -1 || paymentCompletedIdx < thread.indexOf(msg)) && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => onPaymentCtaClick?.(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                                      >
                                        {paymentCtaLoading ? "Opening Stripe…" : "Update payment method"}
                                      </button>
                                    </div>
                                  )}
                                  {msg.senderType === "system" && msg.paymentMetadata?.kind === "payment_cap_exceeded" && !paymentResolved && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => onPaymentCtaClick?.(msg)}
                                        disabled={paymentCtaLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-amber-900 hover:bg-amber-800 text-amber-50 px-4 py-2 text-sm font-medium disabled:opacity-60"
                                      >
                                        {paymentCtaLoading ? "Opening Stripe…" : "Pay yourself instead"}
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

          <TicketChatInput
            value={message}
            onChange={onMessageChange}
            onSend={onSend}
            sendDisabled={sendDisabled}
            placeholder="Message #askanything"
            onImageClick={attachmentStoragePrefix ? () => setImageUploadOpen(true) : undefined}
            onImageFiles={attachmentStoragePrefix ? uploadFiles : undefined}
            imagesUploading={isUploading}
            toolbarEndContent={
              !isEnded && onRequestEndSession && !endSessionRequested ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEndSessionDialogOpen(true)}
                  disabled={endSessionRequestPending}
                  className="cursor-pointer text-foreground font-semibold text-[14px] hover:bg-transparent"
                >
                  End session
                </Button>
              ) : undefined
            }
          />

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

          {attachmentStoragePrefix && (
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
        className={`${isCollapsed ? "w-16" : "w-80"} bg-white border-l border-border relative z-20 flex flex-col transition-all duration-300 overflow-hidden`}
      >
          <RightSidebarCollapseToggle isCollapsed={isCollapsed} onToggle={setCollapsed} />

          {!isCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {/* People in Chat */}
            <div>
              <SidebarSectionHeading>People in this chat</SidebarSectionHeading>

              {participantsLoading ? (
                <SidebarEmpty className="text-[14px]">Loading...</SidebarEmpty>
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
                      <span className="text-[13px] text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
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


