"use client"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AttachImageModal } from "@/components/ticket-chat/attach-image-modal"
import { EndTicketDrawer } from "@/components/drawers/end-ticket-drawer"
import { cn } from "@/lib/utils"
import { EndSessionRequestedHelperBanner } from "@/components/ticket-chat/end-session-request"
import { LogTimeDrawer, type TimeEntry } from "@/components/drawers/log-time-drawer"
import {
  useTimeEntries,
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useRequestTimeEntryReview,
  isPaymentNotAuthorizedError,
  getReviewTimeEntryErrorHint,
  timeMillisecondsToHoursMinutes,
  getTimeEntryReviewStatus,
  TIME_ENTRY_AUTO_ACCEPT_HOURS,
  describeAutoAcceptDeadline,
  formatTime,
  MAX_TIME_ENTRY_MS,
} from "@/hooks/useTimeEntries"
import {
  DeleteTimeEntryDialog,
  TimeEntriesReviewStatus,
  TimeEntryAwaitingApprovalBanner,
} from "@/components/ticket-chat/time-entry-review"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useProject } from "@/hooks/useProject"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import {
  Plus,
  Info,
  Paperclip,
  Smile,
  Check,
  AtSign,
  Mic,
  Video,
  Trash2,
} from "lucide-react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import NextLink from "next/link"
import { useParams } from "next/navigation"
import { useTicket, useUpdateTicket } from "@/hooks/useTickets"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { ClaimTicketButton, GuestTicketBadge, GUEST_CLAIM_BLOCKED_COPY, ticketCreatorDisplayName } from "@/components/ticket-chat/guest-ticket"
import { guestSystemMessageCopy } from "@/lib/customer-chat-messages"
import { useTicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { useCaptureTicket } from "@/hooks/useCaptureTicket"
import { useTicketMessages, useSendMessage } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useRealtimeTicket } from "@/hooks/useRealtimeTicket"
import { SidebarSectionHeading, SidebarDivider } from "@/components/ticket-chat/sidebar-section"
import { useRightSidebarCollapsed, RightSidebarCollapseToggle } from "@/components/ticket-chat/right-sidebar-collapse"
import { useTicketParticipants, useClaimTicket, useEnsureParticipant, useUpdateLastReadMessage, type ParticipantWithUser } from "@/hooks/useTicketParticipants"
import { useProjectPaymentSettings } from "@/hooks/useProject"
import { formatTicketRates, isFlatFeePricing, isFreeSupport, RATES_NOT_CONFIGURED } from "@/lib/ticket-pricing"
import { useHelperClaimedTicketsSidebar, useAdminActiveTicketsSidebar } from "@/hooks/useHelperTickets"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useAddSelfAsHelper } from "@/hooks/useHelpers"
import { supabase } from "@/lib/supabase/client"
import { useUser } from "@/contexts/user-context"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserPlus } from "lucide-react"
import { prepareOutgoingMessage } from "@/lib/code-format"
import { appendToDraft } from "@/lib/ticket-attachments"
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachments"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"

interface Message {
  id: string
  sender: "user" | "helper" | "system"
  content: string
  timestamp: string
  avatar?: string
  senderName?: string
  senderId?: string
  senderAvatarUrl?: string | null
  type?: "claimed" | "ended"
  /** `metadata.kind` of a persisted system message (payment_*, time_logged, time_entry_*). */
  metadataKind?: string
  /** `time_entries_confirmed` message in which the user declined at least one entry. */
  hasDeclines?: boolean
}

const HELPER_PAYMENT_AUTHORIZED_MESSAGE = "Ticket claimed and payment authorized - you can now start tracking time."

/** Toast for a failed capture: only card problems mention updating the card. */
function notifyCaptureError(error: Error, cardHint: string) {
  const code = (error as { code?: string }).code
  if (code === "capture_recorded_in_stripe_only") {
    toast.info("Payment captured", { description: "It will be recorded automatically in a few minutes." })
  } else if (code === "not_ticket_helper_or_admin" || code === "ticket_not_ended" || code === "charge_outcome_unknown") {
    toast.error("Payment not captured yet", { description: error.message })
  } else {
    toast.error(`Payment failed: ${error.message}`, { description: cardHint })
  }
}

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string

  const [message, setMessage] = useState("")
  const [justClaimedLocal, setJustClaimedLocal] = useState(false)
  const [justEndedLocal, setJustEndedLocal] = useState(false)
  const [endOutcome, setEndOutcome] = useState<string | null>(null)
  const [userHasSLA, setUserHasSLA] = useState(false)
  // In-flight guard for sending: `sendMessage.isPending` only flips once the
  // insert starts, after the (lazy-loaded) formatter has run, so a fast
  // double Enter would otherwise send twice.
  const [isSending, setIsSending] = useState(false)
  const sendingRef = useRef(false)
  const [isEndTicketDrawerOpen, setIsEndTicketDrawerOpen] = useState(false)
  const [isLogTimeDrawerOpen, setIsLogTimeDrawerOpen] = useState(false)
  const [isAddSelfAsHelperDialogOpen, setIsAddSelfAsHelperDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"claim" | "logTime" | null>(null)
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false)
  // Collapsed state is shared across views via localStorage (see
  // right-sidebar-collapse.tsx).
  const { isCollapsed, setCollapsed } = useRightSidebarCollapsed()

  // Fetch ticket and messages
  const { data: ticket, isLoading: ticketLoading, isError: ticketError } = useTicket(ticketId)
  const { data: ticketDetails } = useTicketWithDetails(ticketId)
  // Opened by a visitor who hasn't signed in: helpers can reply, but nobody
  // can claim / log time / bill until they do. Realtime clears the flag after
  // adoption (adopt-guest-tickets), which re-enables the claim button.
  const isGuestTicket = !!(ticket as { guest?: boolean } | null | undefined)?.guest
  // Fetch payment settings (the payment gate needs them: free support opens it)
  const { data: paymentSettings } = useProjectPaymentSettings(ticket?.project_id || "")
  // Billing uses the prices snapshotted when the ticket was opened; prefer them over
  // the live project settings so the helper sees what the customer will be charged.
  const pricingSnapshot = (ticket as { pricing_snapshot?: Record<string, number> | null } | undefined)?.pricing_snapshot
  const effectivePricing = pricingSnapshot && paymentSettings ? { ...paymentSettings, ...pricingSnapshot } : paymentSettings
  const paymentGate = useTicketPaymentStatus(ticketId, {
    slaId: (ticketDetails as { sla_id?: string | null } | undefined)?.sla_id ?? null,
    isFree: isFreeSupport(effectivePricing),
    ticketStatus: ticket?.status ?? null,
    // Flat fee follows the ticket's snapshot only, like the DB gate (legacy
    // tickets without a snapshot keep needing an authorized hold).
    isFlatFee: !!pricingSnapshot && isFlatFeePricing(effectivePricing),
  })
  const { data: messagesData, isLoading: messagesLoading } = useTicketMessages(ticketId)
  const sendMessage = useSendMessage()
  const updateTicket = useUpdateTicket()
  const captureTicket = useCaptureTicket()
  const { user: currentUser } = useUser()

  // Fetch participants
  const { data: participants, isLoading: participantsLoading } = useTicketParticipants(ticketId)
  const claimTicket = useClaimTicket()
  const ensureParticipant = useEnsureParticipant()
  
  // Time entries: load from DB, create via mutation
  const { data: timeEntriesFromDb = [] } = useTimeEntries({ ticketId })
  const currentHelperId = useCurrentHelper(ticket?.project_id ?? undefined).data ?? null
  const createTimeEntry = useCreateTimeEntry()
  const deleteTimeEntry = useDeleteTimeEntry()
  const requestTimeEntryReview = useRequestTimeEntryReview()
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null)

  // Admin but not yet registered as helper - must add self before claiming or logging time
  const projectId = ticket?.project_id ?? ""
  const { data: project } = useProject(projectId)
  const { data: projectRole } = useProjectRole(projectId || undefined)
  const isAdmin = projectRole === "admin"
  const addSelfAsHelper = useAddSelfAsHelper()

  // Active tickets sidebar — Admins see every `claimed`/`in-progress` ticket
  // in this project (across various helpers); Helpers only see the ones they
  // have personally claimed. Both hooks are declared so React's hook order
  // stays stable; the unused one is disabled via an `undefined` id arg.
  const helperSidebarQuery = useHelperClaimedTicketsSidebar(
    isAdmin ? undefined : currentUser?.id,
    ticketId,
    50,
  )
  const adminSidebarQuery = useAdminActiveTicketsSidebar(
    isAdmin ? projectId : undefined,
    currentUser?.id,
    ticketId,
    50,
  )
  const activeTicketsSidebarData = isAdmin
    ? adminSidebarQuery.data
    : helperSidebarQuery.data
  const activeTicketsSidebar = activeTicketsSidebarData?.items ?? []
  const activeTicketsCount = activeTicketsSidebarData?.activeCount ?? 0
  const isAdminButNotHelper =
    projectRole === "admin" &&
    !currentHelperId &&
    !!currentUser?.id &&
    !!projectId

  // Display shape for Logged time list and EndTicketDrawer (hours, minutes, type, date, note)
  const timeEntries: TimeEntry[] = useMemo(
    () =>
      timeEntriesFromDb.map((entry) => {
        const { hours, minutes } = timeMillisecondsToHoursMinutes(entry.time_milliseconds)
        return {
          id: entry.id,
          type: entry.type,
          date: entry.date,
          hours,
          minutes,
          note: entry.note ?? undefined,
          reviewStatus: getTimeEntryReviewStatus(entry),
          declineReason: entry.decline_reason ?? null,
          autoAccepted: entry.auto_accepted ?? false,
          helperId: entry.helper_id,
          helperUser: entry.helper?.user
            ? { id: entry.helper.user.id, name: entry.helper.user.name, avatarUrl: entry.helper.user.avatar_url ?? null }
            : undefined,
        }
      }),
    [timeEntriesFromDb]
  )
  // Entries the customer has not confirmed yet. Pending is the normal state
  // during a session: the helper sends the summary from the End ticket drawer
  // and the drawer refuses to end until the customer has confirmed it
  // (declined time isn't charged).
  const pendingReviewCount = useMemo(
    () => timeEntries.filter((entry) => entry.reviewStatus === "pending").length,
    [timeEntries]
  )
  
  // Format payment values (convert cents to dollars); null until the project
  // has a payment settings row — no placeholder prices.
  const rates = formatTicketRates(effectivePricing)

  // Set up real-time subscriptions
  useRealtimeMessages(ticketId)
  useRealtimeTicket(ticketId)

  const updateLastReadMessage = useUpdateLastReadMessage()

  const lastMessageId = useMemo(
    () => (messagesData && messagesData.length > 0 ? messagesData[messagesData.length - 1].id : null),
    [messagesData]
  )

  // Mark latest message as read when viewing this ticket. Only depend on ids so we don't re-run
  // when the mutation object reference changes (it would cause an update loop with query invalidation).
  useEffect(() => {
    if (!ticketId || !currentUser?.id || !lastMessageId) return
    updateLastReadMessage.mutate({
      ticketId,
      participantId: currentUser.id,
      messageId: lastMessageId,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable; including updateLastReadMessage causes an update loop
  }, [ticketId, currentUser?.id, lastMessageId])

  const claimer = useMemo(
    () => participants?.find((p) => p.claimed)?.user,
    [participants]
  )

  // All participants for "People in this chat": tickets_participants + ticket creator if missing
  const allParticipants: ParticipantWithUser[] = useMemo(() => {
    const list = [...(participants ?? [])]
    const creatorId = ticket?.created_by
    const creatorUser = ticketDetails?.user
    if (creatorId && creatorUser && !list.some((p) => p.participant_id === creatorId)) {
      list.push({
        id: `creator-${creatorId}`,
        participant_id: creatorId,
        claimed: false,
        created_at: "",
        user: {
          id: creatorId,
          name: ticketCreatorDisplayName((creatorUser as { name?: string })?.name, isGuestTicket),
          avatar_url: (creatorUser as { avatar_url?: string | null })?.avatar_url ?? null,
        },
      })
    }
    return list
  }, [participants, ticket?.created_by, ticketDetails?.user, isGuestTicket])

  const isTicketEnded = (ticket?.status === "completed" || ticket?.status === "cancelled") || justEndedLocal

  // Customer asked to end the session (tickets.end_requested_at, realtime via
  // useRealtimeTicket). Only the helper can actually end — they log remaining
  // time and confirm in the End ticket drawer. The customer may withdraw the
  // request until then, so this is derived from the live row, not local state.
  const endRequestedAt = ticket?.end_requested_at ?? null
  const endRequested = !!endRequestedAt && !isTicketEnded
  const prevEndRequestedAtRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevEndRequestedAtRef.current
    prevEndRequestedAtRef.current = endRequestedAt
    // Skip the initial hydration; only toast on a live transition.
    if (prev === undefined || isTicketEnded) return
    if (!prev && endRequestedAt) {
      toast.info("The user has asked to end the session.", {
        description: "Log any remaining time, then end the session to finalise the ticket.",
      })
    } else if (prev && !endRequestedAt) {
      toast.info("The user withdrew their request to end the session.")
    }
  }, [endRequestedAt, isTicketEnded])

  // Logged-time summary sent for confirmation (tickets.time_review_requested_at,
  // realtime via useRealtimeTicket). Cleared by the customer's confirmation,
  // the 24h auto-confirm, or the ticket ending.
  const timeReviewRequestedAt = ticket?.time_review_requested_at ?? null
  const timeReviewRequested = !!timeReviewRequestedAt && !isTicketEnded
  const prevTimeReviewRequestedAtRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevTimeReviewRequestedAtRef.current
    prevTimeReviewRequestedAtRef.current = timeReviewRequestedAt
    if (prev === undefined || isTicketEnded) return
    if (prev && !timeReviewRequestedAt) {
      if (pendingReviewCount > 0) {
        // Time changed after the summary was sent; the backend withdrew it.
        toast.info("The summary was withdrawn because the logged time changed.", {
          description: "Send the updated summary to the user before ending the session.",
        })
      } else {
        toast.info("The logged time summary has been resolved.", {
          description: "Check the chat for the outcome, then end the session from End ticket.",
        })
      }
    }
    // pendingReviewCount is read at the moment the request clears; not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeReviewRequestedAt, isTicketEnded])

  const handleRequestTimeEntryReview = async () => {
    if (!ticketId) return
    try {
      await requestTimeEntryReview.mutateAsync({ ticketId })
      toast.success("Summary sent. The user has been asked to confirm the logged time.")
    } catch (error) {
      console.error("Failed to request time entry review:", error)
      const hint = getReviewTimeEntryErrorHint(error)
      toast.error(
        hint === "already_requested"
          ? "The summary has already been sent; waiting for the user."
          : hint === "nothing_to_confirm"
            ? "There is no logged time waiting for confirmation."
            : hint === "ticket_ended"
              ? "The session has already ended."
              : "Couldn't send the summary. Please try again.",
      )
    }
  }

  // Who may do what on this ticket. Server-side the `tickets` UPDATE trigger
  // only lets the claimed participant (or a project admin) change status, so
  // the UI mirrors that: other helpers get a read-only view.
  const isClaimedByMe =
    justClaimedLocal ||
    (!!currentUser?.id &&
      !!participants?.some((p) => p.participant_id === currentUser.id && p.claimed === true))
  const isClaimed =
    isClaimedByMe ||
    !!participants?.some((p) => p.claimed) ||
    ticket?.status === "claimed" ||
    ticket?.status === "in-progress"
  const canManageTicket = isClaimedByMe || isAdmin
  const isTicketCreator = !!currentUser?.id && ticket?.created_by === currentUser.id
  // Claiming is only offered on an open, unclaimed ticket to someone other
  // than the person who asked for help (the backend rejects both anyway).
  const canClaim = !!currentUser?.id && !isClaimed && !isTicketEnded && !isTicketCreator
  const canChat = !isTicketEnded && !!currentUser?.id

  // Transform messages to UI format; prepend synthetic "claimed" message when ticket is claimed
  const messages: Message[] = useMemo(() => {
    const list: Message[] = []
    if (isClaimed && claimer) {
      list.push({
        id: "system-claimed",
        sender: "system",
        content: "Ticket is claimed",
        timestamp: new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: claimer.name?.[0]?.toUpperCase() || "H",
        senderName: claimer.name || "Helper",
        senderId: claimer.id,
        senderAvatarUrl: claimer.avatar_url ?? null,
        type: "claimed",
      })
    }
    if (!messagesData) return list
    return list.concat(
      messagesData.map((msg): Message => ({
        id: msg.id,
        sender: msg.sender_type === "user" ? "user" : msg.sender_type === "helper" ? "helper" : "system",
        // The stored payment_authorized text is worded for the customer; helpers/admins get their own.
        content:
          msg.sender_type === "system" && (msg.metadata as { kind?: string } | null | undefined)?.kind === "payment_authorized"
            ? HELPER_PAYMENT_AUTHORIZED_MESSAGE
            : (msg.sender_type === "system"
                ? guestSystemMessageCopy((msg.metadata as { kind?: string } | null | undefined)?.kind, "helper")
                : null) ?? msg.content,
        timestamp: new Date(msg.created_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: msg.sender?.name?.[0]?.toUpperCase() || "U",
        senderName: msg.sender?.name || (msg.sender_type === "user" ? "User" : "Unknown"),
        senderId: msg.sender_id ?? msg.sender?.id,
        senderAvatarUrl: msg.sender?.avatar_url ?? null,
        type: undefined,
        metadataKind: (msg.metadata as { kind?: string } | null | undefined)?.kind,
        hasDeclines: ((msg.metadata as { declined?: unknown[] } | null | undefined)?.declined?.length ?? 0) > 0,
      }))
    )
  }, [messagesData, isClaimed, claimer])

  /** First user message in the chat, or ticket description as fallback (for "Info about issue"). */
  const firstIssueMessage = useMemo(() => {
    const ticketCreatorId =
      (ticketDetails?.user as { id?: string } | undefined)?.id ?? ticket?.created_by ?? undefined
    const ticketCreatorAvatarUrl =
      (ticketDetails?.user as { avatar_url?: string | null } | undefined)?.avatar_url ?? null
    const firstUser = messagesData?.find((m: { sender_type: string }) => m.sender_type === "user")
    if (firstUser) {
      return {
        content: firstUser.content,
        senderName: ticketCreatorDisplayName((firstUser as { sender?: { name?: string } }).sender?.name ?? ticketDetails?.user?.name, isGuestTicket),
        senderId: (firstUser as { sender_id?: string }).sender_id ?? ticketCreatorId,
        senderAvatarUrl:
          (firstUser as { sender?: { avatar_url?: string | null } }).sender?.avatar_url ?? ticketCreatorAvatarUrl,
        timestamp: firstUser.created_at,
      }
    }
    if (ticket?.description || ticketDetails?.description) {
      return {
        content: ticket?.description ?? ticketDetails?.description ?? "",
        senderName: ticketCreatorDisplayName(ticketDetails?.user?.name, isGuestTicket),
        senderId: ticketCreatorId,
        senderAvatarUrl: ticketCreatorAvatarUrl,
        timestamp: ticket?.created_at ?? "",
      }
    }
    return {
      content: "",
      senderName: ticketCreatorDisplayName(ticketDetails?.user?.name, isGuestTicket),
      senderId: ticketCreatorId,
      senderAvatarUrl: ticketCreatorAvatarUrl,
      timestamp: ticket?.created_at ?? "",
    }
  }, [messagesData, ticket?.description, ticket?.created_at, ticket?.created_by, ticketDetails?.user, ticketDetails?.description, isGuestTicket])

  // Images attached via the toolbar button, paste or drag & drop end up as
  // markdown in the draft message.
  const attachmentStoragePrefix = ticket?.project_id ? `${ticket.project_id}/${ticketId}` : undefined
  const handleImageAttached = useCallback((markdown: string) => {
    setMessage((prev) => appendToDraft(prev, markdown))
  }, [])
  const { uploadFiles, isUploading: imagesUploading } = useTicketAttachmentUpload(
    attachmentStoragePrefix,
    handleImageAttached,
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    // block:"nearest" keeps the scroll local to the messages container; with
    // block:"start" (default) the browser also scrolls ancestor scrollers —
    // including the window — if the document is ever taller than the viewport.
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  useEffect(() => {
    // Defer to after layout so the (tall) ended/outcome summary — which renders
    // based on ticket status, not message count — is measured before we scroll.
    const id = requestAnimationFrame(() => scrollToBottom())
    return () => cancelAnimationFrame(id)
  }, [messages, isTicketEnded])

  const handleSendMessage = async () => {
    if (!message.trim() || !ticketId || !currentUser?.id) return
    if (isTicketEnded) {
      toast.error("This ticket is closed, so new messages can't be sent.")
      return
    }
    if (sendingRef.current) return
    sendingRef.current = true
    setIsSending(true)

    try {
      const isAlreadyParticipant = participants?.some((p) => p.participant_id === currentUser.id)
      if (!isAlreadyParticipant) {
        await ensureParticipant.mutateAsync({
          ticketId,
          participantId: currentUser.id,
          claimed: false,
        })
      }
      await sendMessage.mutateAsync({
        ticket_id: ticketId,
        sender_id: currentUser.id,
        sender_type: "helper",
        content: await prepareOutgoingMessage(message),
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
      toast.error("Couldn't send your message. Please try again.", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      sendingRef.current = false
      setIsSending(false)
    }
  }

  const handleAddSelfAsHelper = async () => {
    if (!projectId || !currentUser?.id) return
    try {
      await addSelfAsHelper.mutateAsync({
        project_id: projectId,
        user_id: currentUser.id,
        category: "core",
      })
      toast.success("You have been added as a helper.")
      setIsAddSelfAsHelperDialogOpen(false)
      const action = pendingAction
      setPendingAction(null)
      if (action === "claim") {
        void handleClaimTicket(true)
      } else if (action === "logTime") {
        setIsLogTimeDrawerOpen(true)
      }
    } catch (error) {
      console.error("Failed to add yourself as helper:", error)
      toast.error("Failed to add yourself as helper. Please try again.")
    }
  }

  const handleClaimTicket = async (skipHelperCheck?: boolean) => {
    if (!ticketId || !currentUser?.id) {
      console.error("Cannot claim ticket: missing ticketId or user")
      return
    }
    if (canClaim && isGuestTicket) {
      toast.error(GUEST_CLAIM_BLOCKED_COPY)
      return
    }
    if (!canClaim) {
      toast.error(
        isTicketCreator
          ? "You can't claim your own ticket."
          : isTicketEnded
            ? "This ticket is already closed."
            : "This ticket has already been claimed.",
      )
      return
    }

    if (!skipHelperCheck && isAdminButNotHelper) {
      setPendingAction("claim")
      setIsAddSelfAsHelperDialogOpen(true)
      return
    }

    try {
      // Claim the ticket (add/update participant with claimed=true)
      await claimTicket.mutateAsync({
        ticketId,
        participantId: currentUser.id,
      })

      // Update ticket status to "claimed" if it's currently "available"
      if (ticket?.status === "available") {
        await updateTicket.mutateAsync({
          id: ticketId,
          updates: { status: "claimed" },
        })
      }

      // Log claimed event in tickets_events
      const { error: eventError } = await supabase.from("tickets_events").insert({
        ticket_id: ticketId,
        type: "claimed",
        payload: {},
      })
      if (eventError) console.warn("Failed to log claimed event:", eventError)

      setJustClaimedLocal(true)
    } catch (error) {
      console.error("Failed to claim ticket:", error)
      const hint = (error as { hint?: string } | null)?.hint
      if (hint === "claim_own_ticket") {
        toast.error("You can't claim a ticket you opened yourself.", {
          description: "Another helper or a project admin needs to take it.",
        })
        return
      }
      if (hint === "ticket_already_claimed") {
        toast.error("Another helper has already claimed this ticket.")
        return
      }
      if (hint === "guest_ticket_requires_sign_in") {
        toast.error(GUEST_CLAIM_BLOCKED_COPY)
        return
      }
      toast.error("Couldn't claim the ticket. Please try again.", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  /**
   * End the ticket. The status update is awaited first: only once the database
   * has accepted it does the UI flip to "ended", the audit event get written
   * and the hold captured. If the update is rejected (e.g. by the column-guard
   * trigger because this user isn't the claimed helper) the ticket stays open
   * and the drawer stays up (it awaits the rejected promise).
   */
  const handleEndTicket = async (outcome: string) => {
    if (!ticketId) return

    const status = outcome === "not-able-to-help" ? "cancelled" : "completed"
    const completedAt = new Date().toISOString()

    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        // Ending also resolves any outstanding customer "end session" request.
        updates: {
          status,
          ...(status === "completed" ? { completed_at: completedAt } : { cancelled_at: completedAt }),
          end_requested_at: null,
          end_requested_by: null,
          time_review_requested_at: null,
          time_review_requested_by: null,
        },
      })
    } catch (error) {
      console.error("Failed to end ticket:", error)
      const hint = (error as { hint?: string } | null)?.hint
      toast.error("Couldn't end the ticket. It is still open.", {
        description:
          hint === "ticket_has_pending_time"
            ? "Some logged time is still waiting for the user's confirmation. Send the summary first, or remove those entries."
            : error instanceof Error
              ? error.message
              : "Please try again.",
      })
      throw error
    }

    setJustEndedLocal(true)
    setEndOutcome(outcome)
    setIsEndTicketDrawerOpen(false)

    // Log ended event (audit only; a failure here must not block the capture).
    const { error: endedEventError } = await supabase.from("tickets_events").insert({
      ticket_id: ticketId,
      type: "ended",
      payload: {},
    })
    if (endedEventError) console.warn("Failed to log ended event:", endedEventError)

    // Capture and kick off payout distribution when the helper actually helped
    // (status=completed) on a billable ticket (not SLA-covered, not free, some
    // payment exists). The backend captures the open hold, or charges confirmed
    // time to the saved card when a weekly renewal failed. "Not able to help"
    // is never charged.
    const isSlaCovered = !!(ticketDetails as { sla_id?: string | null } | undefined)?.sla_id
    const billable =
      paymentGate.status !== "free" &&
      paymentGate.status !== "none" &&
      paymentGate.status !== "sla_covered"
    if (status === "completed" && !isSlaCovered && billable) {
      void supabase
        .from("tickets_events")
        .insert({ ticket_id: ticketId, type: "payment_processing", payload: {} })
        .then(({ error: eventError }) => {
          if (eventError) console.warn("tickets_events insert failed:", eventError.message)
        })
      captureTicket.mutate(
        { ticketId },
        {
          onError: (error) => notifyCaptureError(error, "The user has been asked to update their card. You can also retry below."),
        },
      )
    }
  }

  const handleSeeDetails = () => {
    // Here you would typically show a modal or navigate to a details page
  }

  const handleLogTime = (entry: TimeEntry) => {
    if (!currentHelperId || !ticketId) return
    // entry.date from drawer is en-GB (dd/mm/yyyy) -> convert to YYYY-MM-DD
    const dateParts = entry.date.split("/")
    const dateIso = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}` : new Date().toISOString().slice(0, 10)
    const timeMilliseconds = (entry.hours * 3600 + entry.minutes * 60) * 1000
    // The drawer validates, but never let a non-positive or absurd duration
    // reach the database (there is no CHECK on time_milliseconds).
    if (
      !Number.isInteger(entry.hours) ||
      !Number.isInteger(entry.minutes) ||
      entry.hours < 0 ||
      entry.minutes < 0 ||
      entry.minutes >= 60 ||
      timeMilliseconds < 60_000 ||
      timeMilliseconds > MAX_TIME_ENTRY_MS
    ) {
      toast.error("Enter a duration between 1 minute and 24 hours.")
      return
    }
    createTimeEntry.mutate(
      {
        ticketId,
        helperId: currentHelperId,
        type: entry.type,
        timeMilliseconds,
        note: entry.note?.trim() || null,
        date: dateIso,
      },
      {
        onError: (error) =>
          (error as { hint?: string } | null)?.hint === "guest_ticket_requires_sign_in"
            ? toast.error("Time can be logged once the visitor has signed in.")
            : isPaymentNotAuthorizedError(error)
            ? toast.error("Time can't be logged yet", {
                description: "The payment for this ticket isn't authorized. Ask the user to add a payment method.",
              })
            : toast.error("Failed to log time. Please try again."),
      }
    )
  }

  // Own entries on an open ticket, unless the customer already accepted them
  // (may be captured by a re-hold; the DB guard rejects those too).
  const canDeleteTimeEntry = (entry: TimeEntry) =>
    !isTicketEnded && !!currentHelperId && entry.helperId === currentHelperId && entry.reviewStatus !== "accepted"

  const handleDeleteTimeEntry = async () => {
    if (!deletingEntry || !ticketId) return
    try {
      await deleteTimeEntry.mutateAsync({ entryId: deletingEntry.id, ticketId })
      setDeletingEntry(null)
      toast.success("Logged time deleted")
    } catch (error) {
      const hint = getReviewTimeEntryErrorHint(error)
      setDeletingEntry(null)
      toast.error(
        hint === "accepted_entry_locked"
          ? "The user already accepted this time, so it can't be deleted."
          : hint === "ticket_ended"
            ? "The session has ended, so logged time can't be changed."
            : hint === "not_entry_owner"
              ? "You can only delete time you logged yourself."
              : "Failed to delete logged time. Please try again."
      )
    }
  }

  const getTotalLoggedTime = () => {
    const totalMinutes = timeEntries.reduce((acc, entry) => {
      if (entry.reviewStatus === "declined") return acc
      return acc + entry.hours * 60 + entry.minutes
    }, 0)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return { hours, minutes, formatted: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} h` }
  }

  // End-of-session summary (non-SLA). "Not able to help" cancels with no charge;
  // otherwise we reflect the live capture/distribution status of the hold.
  const isCancelledEnd = endOutcome === "not-able-to-help" || ticket?.status === "cancelled"
  // Prefer the amount Stripe actually captured (DB, realtime) over the mutation
  // result so we never show the reserved hold or a stale value.
  const chargedSmallestUnit =
    paymentGate.capturedAmountSmallestUnit ?? captureTicket.data?.finalAmountSmallestUnit ?? null
  const paymentSettled =
    paymentGate.status === "distributing" ||
    paymentGate.status === "completed" ||
    (captureTicket.isSuccess && captureTicket.data?.status !== "processing")
  // 403s and "Stripe captured but our row did not update" are not card failures:
  // the hold is still (or already) captured, so never offer "update your card" for them.
  const captureErrorCode = (captureTicket.error as { code?: string } | null)?.code
  const captureNonCardError =
    captureErrorCode === "capture_recorded_in_stripe_only" ||
    captureErrorCode === "not_ticket_helper_or_admin" ||
    captureErrorCode === "ticket_not_ended" ||
    captureErrorCode === "charge_outcome_unknown"
  // Settled per the payments rows (aggregated over all of them once the ticket
  // is closed): a card error from this session's capture no longer means
  // failed (a real decline also writes a failed row, which the rows reflect).
  const settledByRows =
    paymentGate.status === "distributing" ||
    paymentGate.status === "completed" ||
    paymentGate.status === "waived" ||
    paymentGate.status === "refund_pending"
  const paymentFailed =
    !settledByRows && ((captureTicket.isError && !captureNonCardError) || paymentGate.status === "failed")
  // Authorization / ordering errors: nothing was charged and the card is fine,
  // so offer a neutral retry instead of leaving the panel on "Processing…".
  const captureNeedsRetry =
    captureErrorCode === "not_ticket_helper_or_admin" ||
    captureErrorCode === "ticket_not_ended" ||
    captureErrorCode === "charge_outcome_unknown"
  // Why it failed: Stripe's message from the payments row (realtime, survives
  // reloads), else from the last capture attempt in this session.
  const paymentFailureReason = paymentFailed
    ? paymentGate.failureReason ?? captureTicket.error?.message ?? null
    : null
  const paymentProcessing =
    !paymentSettled &&
    !paymentFailed &&
    !captureNeedsRetry &&
    (captureTicket.isPending ||
      paymentGate.status === "authorized" ||
      paymentGate.status === "pending" ||
      paymentGate.status === "processing")
  const captureChargedNothing =
    captureTicket.data?.status === "not_billable" || captureTicket.data?.status === "released"
  const formatUsd = (smallestUnit: number) => `$${(smallestUnit / 100).toFixed(2)}`
  const chargedLabel =
    // Cancelled after a weekly segment was captured: flagged for a refund.
    paymentGate.status === "refund_pending"
      ? paymentGate.capturedAmountSmallestUnit != null
        ? `Refund pending (${formatUsd(paymentGate.capturedAmountSmallestUnit)} collected)`
        : "Refund pending"
      : isCancelledEnd
        ? "No charge"
        : paymentGate.status === "free"
          ? "Free support"
          : paymentSettled && chargedSmallestUnit != null
            ? formatUsd(chargedSmallestUnit)
            : paymentGate.status === "waived"
              ? "No charge (amount below the card minimum)"
              : captureChargedNothing
                ? "No charge"
                : paymentProcessing
                  ? "Processing…"
                  : paymentFailed
                    ? "Failed"
                    : "—"
  // Who got what out of the charge. Shown once the capture has settled.
  const chargeSplits =
    !isCancelledEnd && paymentSettled && chargedSmallestUnit != null ? paymentGate.capturedSplits : null
  const billedHelperCount = new Set(
    timeEntries.filter((e) => e.reviewStatus !== "declined").map((e) => e.helperId),
  ).size

  // A ticket hidden by RLS (or a bad id) used to render a blank page: the
  // `.single()` read errors, and nothing else has data to show.
  if (ticketError || (!ticketLoading && !ticket)) {
    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="relative border-b border-border z-10">
            <Header title="Ticket" showBackButton={true} titleClassName="text-xl" />
          </div>
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-12">
              <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle">
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Ticket not found or you don&apos;t have access
                </h1>
                <p className="text-muted-foreground mb-6">
                  This ticket may have been removed, or it belongs to a project you are not a member of.
                </p>
                <NextLink href="/tickets">
                  <Button variant="default" size="sm">
                    Back to tickets
                  </Button>
                </NextLink>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative border-b border-border z-10">
          <Header
            title={`Ticket with ${project?.name || 'Support'}`}
            showBackButton={true}
            titleClassName="text-xl"
            inlineRightContent={
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-normal font-mono tabular-nums text-muted-foreground/80">ID: {ticketId}</span>
                {isGuestTicket && <GuestTicketBadge />}
              </span>
            }
          />
        </div>
        <main className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 p-4 flex flex-col min-h-0">
                {/* Chat Messages Container */}
                <div
                  className="bg-card rounded-[10px] shadow-soft flex-1 overflow-auto"
                  onLoadCapture={(e) => {
                    // Images load after the initial scroll and push the thread
                    // down; keep it pinned to the bottom if it was there.
                    if (!(e.target instanceof HTMLImageElement)) return
                    const box = e.currentTarget
                    const distance = box.scrollHeight - box.scrollTop - box.clientHeight
                    if (distance <= e.target.offsetHeight + 120) scrollToBottom()
                  }}
                >
                  <div className="p-6">
                    <div className="flex flex-col" style={{ rowGap: '31.2px' }}>
                {/* Initial Ticket Info — first message in chat = "Info about issue" */}
                <div className="flex gap-3 items-start">
                  <ProfileAvatar
                    id={firstIssueMessage.senderId}
                    name={firstIssueMessage.senderName ?? "U"}
                    avatarUrl={firstIssueMessage.senderAvatarUrl ?? null}
                    size="sm"
                    radius="9.625px"
                  />
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-foreground font-medium">{firstIssueMessage.senderName}</span>
                        <span
                          className="text-xs"
                          style={{
                            color: "var(--muted-foreground)",
                            fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {firstIssueMessage.timestamp
                            ? new Date(firstIssueMessage.timestamp).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2 text-foreground">Info about issue</h3>
                        <div className="space-y-3 text-foreground">
                          {firstIssueMessage.content ? (
                            <MarkdownContent content={firstIssueMessage.content} className="text-sm" />
                          ) : (
                            <p className="text-sm">No description provided.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Other topics — from ticket keywords */}
                    {ticketDetails?.keywords && ticketDetails.keywords.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Other topics</h4>
                        <div className="flex gap-2 flex-wrap">
                          {ticketDetails.keywords.map((k) => (
                            <Badge key={k.value} variant="secondary" className="bg-muted text-muted-foreground">
                              {k.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Type of help — from ticket help categories */}
                    {ticketDetails?.help_categories && ticketDetails.help_categories.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Type of help</h4>
                        <div className="flex gap-2 flex-wrap">
                          {ticketDetails.help_categories.map((c) => (
                            <Badge key={`${c.value}-${c.type}`} variant="secondary" className="bg-muted text-muted-foreground capitalize">
                              {c.type !== "default" ? c.type : c.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-[13px] font-semibold text-foreground mb-3">Rates</h4>
                      {rates == null ? (
                        <div className="bg-card border border-border rounded-lg p-3">
                          <p className="text-sm font-medium text-foreground">{RATES_NOT_CONFIGURED}</p>
                          <p className="text-sm text-muted-foreground">
                            This project has no payment settings yet, so no hold can be placed.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Start price</p>
                            <p className="text-sm font-medium text-foreground tabular-nums">USD {rates.startPrice}</p>
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
                            <p className="text-sm font-medium text-foreground tabular-nums">USD {rates.first60Price}/min</p>
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
                            <p className="text-sm font-medium text-foreground tabular-nums">USD {rates.after60Price}/min</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons — claim only on an open, unclaimed ticket
                        (never for its creator); End ticket only for the claimed
                        helper or a project admin. */}
                    {canClaim && (
                      <ClaimTicketButton
                        isGuest={isGuestTicket}
                        pending={claimTicket.isPending}
                        onClaim={() => void handleClaimTicket()}
                      />
                    )}

                    {isClaimed && !isTicketEnded && canManageTicket && (
                      <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={() => setIsEndTicketDrawerOpen(true)} className="cursor-pointer">
                          End ticket
                        </Button>
                      </div>
                    )}

                    {isClaimed && !isTicketEnded && !canManageTicket && (
                      <p className="text-[13px] text-muted-foreground">
                        {claimer?.name ? `${claimer.name} is handling this ticket.` : "Another helper is handling this ticket."}{" "}
                        You can read along, but only they (or a project admin) can log time or end it.
                      </p>
                    )}
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex flex-col" style={{ rowGap: '16px' }}>
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 items-start">
                      {msg.sender === "system" && (msg.type === "claimed" || msg.type === "ended") ? (
                        <div className="flex items-start gap-3 w-full">
                          <ProfileAvatar
                            id={msg.senderId}
                            name={msg.senderName ?? msg.avatar ?? "H"}
                            avatarUrl={msg.senderAvatarUrl ?? null}
                            size="sm"
                            radius="9.625px"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-foreground font-medium">{msg.senderName}</span>
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
                          {msg.sender !== "system" && (
                            <ProfileAvatar
                              id={msg.senderId}
                              name={msg.senderName ?? msg.avatar ?? "U"}
                              avatarUrl={msg.senderAvatarUrl ?? null}
                              size="sm"
                              radius="9.625px"
                            />
                          )}
                          <div className="flex-1">
                            {msg.sender !== "system" && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-foreground font-medium">{msg.senderName}</span>
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
                                msg.sender === "system"
                                  ? msg.metadataKind === "time_entry_declined" ||
                                    (msg.metadataKind === "time_entries_confirmed" && msg.hasDeclines)
                                    ? "bg-amber-50 border border-amber-200 text-amber-900 py-2 px-4 rounded-lg text-sm text-left ml-11"
                                    : "bg-muted text-muted-foreground py-2 px-4 rounded-lg text-sm text-left ml-11"
                                  : "text-sm text-foreground"
                              }
                            >
                              <MarkdownContent content={msg.content} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {isTicketEnded && (
                    <div className="flex gap-3 pt-2 items-start">
                      <ProfileAvatar
                        id={claimer?.id}
                        name={claimer?.name ?? "H"}
                        avatarUrl={claimer?.avatar_url ?? null}
                        size="sm"
                        radius="9.625px"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-brand-primary shrink-0" />
                          <span>Ticket ended</span>
                        </div>
                        <div className="mt-2">
                          {userHasSLA ? (
                            <Button
                              onClick={handleSeeDetails}
                              variant="outline"
                              size="sm"
                              className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                            >
                              See details
                            </Button>
                          ) : (
                            <div className="rounded-lg border border-border bg-muted/40 p-4 max-w-xs">
                              <div className="space-y-1.5 text-[13px]">
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-muted-foreground">Outcome</span>
                                  <span className="font-medium text-foreground">
                                    {isCancelledEnd ? "Not able to help" : "Resolved"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-muted-foreground">Time logged</span>
                                  <span className="font-medium text-foreground tabular-nums">
                                    {getTotalLoggedTime().formatted}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-muted-foreground">Charged</span>
                                  <span className="font-medium text-foreground tabular-nums">{chargedLabel}</span>
                                </div>
                                {chargeSplits && (
                                  <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                                    <div className="flex items-center justify-between gap-6">
                                      <span className="text-muted-foreground">
                                        {billedHelperCount > 1 ? `Share helpers (${billedHelperCount})` : "Share helper"}
                                      </span>
                                      <span className="font-medium text-foreground tabular-nums">
                                        {formatUsd(chargeSplits.helperSmallestUnit)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-6">
                                      <span className="text-muted-foreground">Share project</span>
                                      <span className="font-medium text-foreground tabular-nums">
                                        {formatUsd(chargeSplits.projectSmallestUnit)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-6">
                                      <span className="text-muted-foreground">Stripe fee</span>
                                      <span className="font-medium text-foreground tabular-nums">
                                        {formatUsd(chargeSplits.stripeFeeSmallestUnit)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {paymentFailed && paymentFailureReason && (
                                <p className="mt-2 text-[12px] leading-snug text-destructive">
                                  {paymentFailureReason}
                                </p>
                              )}
                              {paymentFailed && (
                                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                                  The user has been notified and can update their card from the ticket chat; the charge retries automatically once they do.
                                </p>
                              )}
                              {captureNeedsRetry && !paymentFailed && (
                                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                                  {captureTicket.error?.message ?? "The payment hasn't been captured yet."}
                                </p>
                              )}
                              {(paymentFailed || captureNeedsRetry) && (
                                <Button
                                  onClick={() =>
                                    captureTicket.mutate(
                                      { ticketId },
                                      {
                                        onError: (error) => notifyCaptureError(error, "The user has been asked to update their card."),
                                      },
                                    )
                                  }
                                  disabled={captureTicket.isPending}
                                  variant="outline"
                                  size="sm"
                                  className="mt-3 border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                                >
                                  {captureTicket.isPending ? "Retrying…" : "Retry payment"}
                                </Button>
                              )}

                              <div className="mt-3">
                                <NextLink href="/tickets">
                                  <Button variant="default" size="sm">
                                    Back to tickets
                                  </Button>
                                </NextLink>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {timeReviewRequested && (
              <TimeEntryAwaitingApprovalBanner
                pendingCount={pendingReviewCount}
                customerName={(ticketDetails?.user as { name?: string } | undefined)?.name ?? null}
                autoAcceptHint={describeAutoAcceptDeadline(timeReviewRequestedAt)}
              />
            )}

            {endRequested && canManageTicket && (
              <EndSessionRequestedHelperBanner
                requesterName={(ticketDetails?.user as { name?: string } | undefined)?.name ?? null}
                requestedAt={endRequestedAt}
                onLogTime={
                  paymentGate.isReady
                    ? () => {
                        if (isAdminButNotHelper) {
                          setPendingAction("logTime")
                          setIsAddSelfAsHelperDialogOpen(true)
                        } else {
                          setIsLogTimeDrawerOpen(true)
                        }
                      }
                    : undefined
                }
                onEndSession={() => setIsEndTicketDrawerOpen(true)}
              />
            )}

            <TicketChatInput
              value={message}
              onChange={setMessage}
              onSend={handleSendMessage}
              sendDisabled={!message.trim() || !canChat}
              sending={isSending}
              disabled={isTicketEnded}
              placeholder="Message #askanything"
              onImageClick={attachmentStoragePrefix && canChat ? () => setIsImageUploadOpen(true) : undefined}
              onImageFiles={attachmentStoragePrefix && canChat ? uploadFiles : undefined}
              imagesUploading={imagesUploading}
              toolbarEndContent={
                canClaim ? (
                  <ClaimTicketButton
                    isGuest={isGuestTicket}
                    pending={claimTicket.isPending}
                    onClaim={() => void handleClaimTicket()}
                    showExplanation={false}
                  />
                ) : isClaimed && !isTicketEnded && canManageTicket ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEndTicketDrawerOpen(true)}
                    className="cursor-pointer text-foreground font-semibold text-[14px] hover:bg-transparent"
                  >
                    End session
                  </Button>
                ) : undefined
              }
            />

            {attachmentStoragePrefix && canChat && (
              <AttachImageModal
                open={isImageUploadOpen}
                onOpenChange={setIsImageUploadOpen}
                storagePrefix={attachmentStoragePrefix}
                onAttached={handleImageAttached}
              />
            )}
          </div>
        </main>
      </div>

      {/* Right Sidebar — sibling of the header column so it spans the full height, like the left sidebar */}
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
              <div className="text-center text-muted-foreground text-[14px] py-4">Loading...</div>
            ) : allParticipants.length > 0 ? (
              <div className="space-y-2 mb-3">
                {allParticipants.map((participant) => {
                  const isCurrentUser = participant.participant_id === currentUser?.id
                  return (
                    <div key={participant.id} className="flex items-center gap-2">
                      <ProfileAvatar
                        id={participant.user?.id ?? participant.participant_id}
                        name={participant.user?.name ?? "Unknown"}
                        avatarUrl={participant.user?.avatar_url ?? null}
                        size="md"
                      />
                      <span className="text-[13px] text-muted-foreground">
                        {isCurrentUser ? "You" : participant.user?.name ?? "Unknown"}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-[13px] py-4">-</div>
            )}
            {!isTicketEnded && (
              <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10" title={ILLUSTRATIVE_BUTTON_TOOLTIP}>
                <Plus className="w-4 h-4" />
                Invite other helper
              </Button>
            )}
          </div>

          {/* Divider */}
          <SidebarDivider />

          {/* Other Topics — from ticket keywords */}
          <div>
            <SidebarSectionHeading info>Other topics in this chat</SidebarSectionHeading>
            {ticketDetails?.keywords && ticketDetails.keywords.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {ticketDetails.keywords.map((k) => (
                  <Badge key={k.value} variant="secondary" className="bg-muted text-muted-foreground">
                    {k.value}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">—</p>
            )}
          </div>

          {/* Divider */}
          <SidebarDivider />

          {/* Logged Time */}
          <div>
            <SidebarSectionHeading info>Logged time</SidebarSectionHeading>
            {timeEntries.length > 0 && (
              <div className="space-y-2 mb-3">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="py-2 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {/* Same size as before (24px); radius scaled from the chat avatars (9.625px at 28px) */}
                        <ProfileAvatar
                          id={entry.helperUser?.id ?? entry.helperId}
                          name={entry.helperUser?.name}
                          avatarUrl={entry.helperUser?.avatarUrl ?? null}
                          size="sm"
                          radius="8.25px"
                          className="w-6 h-6"
                        />
                        <span className="text-[13px] text-muted-foreground capitalize">{entry.type}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "text-[13px] text-muted-foreground tabular-nums",
                            entry.reviewStatus === "declined" && "line-through",
                          )}
                        >
                          {String(entry.hours).padStart(2, "0")}:{String(entry.minutes).padStart(2, "0")} h
                        </span>
                        {canDeleteTimeEntry(entry) && (
                          <button
                            type="button"
                            onClick={() => setDeletingEntry(entry)}
                            aria-label="Delete logged time"
                            title="Delete logged time"
                            className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-muted"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
                  <span className="text-[13px] text-foreground">Total</span>
                  <span className="text-[13px] text-foreground tabular-nums">{getTotalLoggedTime().formatted}</span>
                </div>
                <TimeEntriesReviewStatus entries={timeEntries} />
                {pendingReviewCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {timeReviewRequested
                      ? `You sent the summary; the session can end once the user confirms it (automatically after ${TIME_ENTRY_AUTO_ACCEPT_HOURS} hours).`
                      : "When you're done, send the summary from End ticket so the user can confirm it in one go."}
                  </p>
                )}
              </div>
            )}
            {paymentGate.error && (
              <p className="text-xs text-destructive mb-2" role="alert">
                Couldn&apos;t load the payment status ({paymentGate.error}). Time logging stays locked until it loads.
              </p>
            )}
            {!isTicketEnded && canManageTicket && (
              <Button
                variant="outline"
                disabled={!paymentGate.isReady}
                title={!paymentGate.isReady ? "Waiting for payment authorization" : undefined}
                className="w-full border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  if (isAdminButNotHelper) {
                    setPendingAction("logTime")
                    setIsAddSelfAsHelperDialogOpen(true)
                  } else {
                    setIsLogTimeDrawerOpen(true)
                  }
                }}
              >
                {paymentGate.isReady ? "Log time" : "Log time (waiting for payment)"}
              </Button>
            )}
          </div>

          {/* Divider */}
          <SidebarDivider />

          {/* Active Tickets — 3 latest claimed by this helper */}
          <div>
            <SidebarSectionHeading>Active tickets ({activeTicketsCount})</SidebarSectionHeading>
            <div className={`-mx-3 ${activeTicketsSidebar.length > 1 ? "max-h-72 overflow-y-auto" : ""}`}>
              {activeTicketsSidebar.length === 0 ? (
                <p className="text-[13px] text-muted-foreground px-3">No active tickets</p>
              ) : (
                activeTicketsSidebar.map((item) => (
                  <NextLink
                    key={item.id}
                    href={`/helper/tickets/${item.id}`}
                    className={`block w-full border cursor-pointer transition-colors ${
                      item.current
                        ? "bg-brand-primary/10 border-border border-l-4 border-l-brand-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <ProfileAvatar
                          id={item.creatorId}
                          name={item.avatarInitial}
                          avatarUrl={item.avatarUrl}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className="font-medium text-foreground text-[13px] truncate">{item.title}</h4>
                            {item.hasNotification && (
                              <div className="w-2 h-2 bg-[#f09191] rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.subtitle}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{item.date}</p>
                        </div>
                      </div>
                    </div>
                  </NextLink>
                ))
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* End Ticket / Log time drawers — only for the claimed helper or an admin */}
      {canManageTicket && (
        <>
          <EndTicketDrawer
            isOpen={isEndTicketDrawerOpen}
            onClose={() => setIsEndTicketDrawerOpen(false)}
            onEndTicket={handleEndTicket}
            userRequestedEnd={endRequested}
            timeEntries={timeEntries}
            timeReviewRequestedAt={timeReviewRequested ? timeReviewRequestedAt : null}
            onRequestTimeReview={handleRequestTimeEntryReview}
            requestTimeReviewPending={requestTimeEntryReview.isPending}
          />

          <LogTimeDrawer
            isOpen={isLogTimeDrawerOpen}
            onClose={() => setIsLogTimeDrawerOpen(false)}
            onLogTime={handleLogTime}
          />
        </>
      )}

      <DeleteTimeEntryDialog
        open={!!deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        onConfirm={handleDeleteTimeEntry}
        pending={deleteTimeEntry.isPending}
        durationLabel={
          deletingEntry ? formatTime((deletingEntry.hours * 3600 + deletingEntry.minutes * 60) * 1000) : null
        }
      />

      {/* Add myself as helper - required for admin before claiming or logging time */}
      <Dialog
        open={isAddSelfAsHelperDialogOpen}
        onOpenChange={(open) => {
          setIsAddSelfAsHelperDialogOpen(open)
          if (!open) setPendingAction(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add yourself as helper</DialogTitle>
            <DialogDescription>
              You need to be registered as a helper before you can claim tickets or log time in this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddSelfAsHelperDialogOpen(false)
                setPendingAction(null)
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-primary hover:bg-brand-primary/90 text-brand-foreground"
              onClick={handleAddSelfAsHelper}
              disabled={addSelfAsHelper.isPending}
            >
              <UserPlus className="w-4 h-4" />
              Add myself as helper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

