"use client"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AIRephraseModal } from "@/components/modals/ai-rephrase-modal"
import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { EndTicketDrawer } from "@/components/drawers/end-ticket-drawer"
import { LogTimeDrawer, type TimeEntry } from "@/components/drawers/log-time-drawer"
import { useTimeEntries, useCreateTimeEntry, timeMillisecondsToHoursMinutes } from "@/hooks/useTimeEntries"
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
  Sparkles,
  AtSign,
  Mic,
  Video,
} from "lucide-react"
import { useState, useRef, useEffect, useMemo } from "react"
import NextLink from "next/link"
import { useParams } from "next/navigation"
import { useTicket, useUpdateTicket } from "@/hooks/useTickets"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { useTicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { useCaptureTicket } from "@/hooks/useCaptureTicket"
import { useTicketMessages, useSendMessage } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useTicketParticipants, useClaimTicket, useEnsureParticipant, useUpdateLastReadMessage, type ParticipantWithUser } from "@/hooks/useTicketParticipants"
import { useProjectPaymentSettings } from "@/hooks/useProject"
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
}

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string

  const [message, setMessage] = useState("")
  const [justClaimedLocal, setJustClaimedLocal] = useState(false)
  const [justEndedLocal, setJustEndedLocal] = useState(false)
  const [endOutcome, setEndOutcome] = useState<string | null>(null)
  const [userHasSLA, setUserHasSLA] = useState(false)
  const [isRephraseModalOpen, setIsRephraseModalOpen] = useState(false)
  const [isEndTicketDrawerOpen, setIsEndTicketDrawerOpen] = useState(false)
  const [isLogTimeDrawerOpen, setIsLogTimeDrawerOpen] = useState(false)
  const [isAddSelfAsHelperDialogOpen, setIsAddSelfAsHelperDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"claim" | "logTime" | null>(null)
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false)

  // Fetch ticket and messages
  const { data: ticket, isLoading: ticketLoading } = useTicket(ticketId)
  const { data: ticketDetails } = useTicketWithDetails(ticketId)
  const paymentGate = useTicketPaymentStatus(ticketId, {
    slaId: (ticketDetails as { sla_id?: string | null } | undefined)?.sla_id ?? null,
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
  
  // Fetch payment settings
  const { data: paymentSettings } = useProjectPaymentSettings(ticket?.project_id || "")

  // Time entries: load from DB, create via mutation
  const { data: timeEntriesFromDb = [] } = useTimeEntries({ ticketId })
  const currentHelperId = useCurrentHelper(ticket?.project_id ?? undefined).data ?? null
  const createTimeEntry = useCreateTimeEntry()

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
        }
      }),
    [timeEntriesFromDb]
  )
  
  // Format payment values (convert cents to dollars)
  const startPrice = paymentSettings?.ticket_start_price ? (paymentSettings.ticket_start_price / 100).toFixed(2) : "10.00"
  const first60Price = paymentSettings?.ticket_price_minute_first_60 ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) : "1.50"
  const after60Price = paymentSettings?.ticket_price_minute_after_60 ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2) : "1.00"

  // Set up real-time subscriptions
  useRealtimeMessages(ticketId)

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
          name: (creatorUser as { name?: string })?.name ?? "Unknown",
          avatar_url: (creatorUser as { avatar_url?: string | null })?.avatar_url ?? null,
        },
      })
    }
    return list
  }, [participants, ticket?.created_by, ticketDetails?.user])

  const isTicketEnded = (ticket?.status === "completed" || ticket?.status === "cancelled") || justEndedLocal

  const isClaimed =
    justClaimedLocal ||
    (participants && currentUser?.id && participants.some((p) => p.participant_id === currentUser.id && p.claimed === true)) ||
    ticket?.status === "claimed" ||
    ticket?.status === "in-progress"

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
        content: msg.content,
        timestamp: new Date(msg.created_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: msg.sender?.name?.[0]?.toUpperCase() || "U",
        senderName: msg.sender?.name || "Unknown",
        senderId: msg.sender_id ?? msg.sender?.id,
        senderAvatarUrl: msg.sender?.avatar_url ?? null,
        type: undefined,
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
        senderName: (firstUser as { sender?: { name?: string } }).sender?.name ?? ticketDetails?.user?.name ?? "Customer",
        senderId: (firstUser as { sender_id?: string }).sender_id ?? ticketCreatorId,
        senderAvatarUrl:
          (firstUser as { sender?: { avatar_url?: string | null } }).sender?.avatar_url ?? ticketCreatorAvatarUrl,
        timestamp: firstUser.created_at,
      }
    }
    if (ticket?.description || ticketDetails?.description) {
      return {
        content: ticket?.description ?? ticketDetails?.description ?? "",
        senderName: ticketDetails?.user?.name ?? "Customer",
        senderId: ticketCreatorId,
        senderAvatarUrl: ticketCreatorAvatarUrl,
        timestamp: ticket?.created_at ?? "",
      }
    }
    return {
      content: "",
      senderName: ticketDetails?.user?.name ?? "Customer",
      senderId: ticketCreatorId,
      senderAvatarUrl: ticketCreatorAvatarUrl,
      timestamp: ticket?.created_at ?? "",
    }
  }, [messagesData, ticket?.description, ticket?.created_at, ticket?.created_by, ticketDetails?.user, ticketDetails?.description])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!message.trim() || !ticketId || !currentUser?.id) return

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
        content: message.trim(),
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
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
      await supabase.from("tickets_events").insert({
        ticket_id: ticketId,
        type: "claimed",
        payload: {},
      })

      setJustClaimedLocal(true)
    } catch (error) {
      console.error("Failed to claim ticket:", error)
    }
  }

  const handleRephraseWithAI = () => {
    setIsRephraseModalOpen(true)
  }

  const handleEndTicket = (outcome: string) => {
    setJustEndedLocal(true)
    setEndOutcome(outcome)
    setIsEndTicketDrawerOpen(false)

    if (!ticketId) return

    const status = outcome === "not-able-to-help" ? "cancelled" : "completed"
    const completedAt = new Date().toISOString()

    void updateTicket.mutateAsync({
      id: ticketId,
      updates: { status, completed_at: completedAt },
    })

    // Log ended event
    void supabase.from("tickets_events").insert({
      ticket_id: ticketId,
      type: "ended",
      payload: {},
    })

    // Capture the authorized hold and kick off payout distribution. Only when
    // the helper actually helped (status=completed), the ticket isn't
    // SLA-covered (those bill via metered usage), and a hold is in place
    // (status=authorized). "Not able to help" leaves the hold to auto-expire.
    const isSlaCovered = !!(ticketDetails as { sla_id?: string | null } | undefined)?.sla_id
    if (status === "completed" && !isSlaCovered && paymentGate.status === "authorized") {
      void supabase.from("tickets_events").insert({
        ticket_id: ticketId,
        type: "payment_processing",
        payload: {},
      })
      captureTicket.mutate(
        { ticketId },
        { onError: () => toast.error("Failed to process payment. You can retry below.") },
      )
    }
  }

  const handleSeeDetails = () => {
    // Here you would typically show a modal or navigate to a details page
  }

  const originalTicketText =
    "I have set up my event types, but they are not being discovered and it is not working as expected. Been trying to figure it out. Here is an example of one of my event types: [PurchaseEvent] public record PurchaseItem(string ItemId, string UserId, string PaymentMethodId);"

  const handleLogTime = (entry: TimeEntry) => {
    if (!currentHelperId || !ticketId) return
    // entry.date from drawer is en-GB (dd/mm/yyyy) -> convert to YYYY-MM-DD
    const dateParts = entry.date.split("/")
    const dateIso = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}` : new Date().toISOString().slice(0, 10)
    const timeMilliseconds = (entry.hours * 3600 + entry.minutes * 60) * 1000
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
        onError: () => toast.error("Failed to log time. Please try again."),
      }
    )
  }

  const getTotalLoggedTime = () => {
    const totalMinutes = timeEntries.reduce((acc, entry) => {
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
    captureTicket.isSuccess
  const paymentFailed = captureTicket.isError || paymentGate.status === "failed"
  const paymentProcessing =
    !paymentSettled &&
    !paymentFailed &&
    (captureTicket.isPending ||
      paymentGate.status === "authorized" ||
      paymentGate.status === "pending")
  const chargedLabel = isCancelledEnd
    ? "No charge"
    : paymentSettled && chargedSmallestUnit != null
      ? `$${(chargedSmallestUnit / 100).toFixed(2)}`
      : paymentProcessing
        ? "Processing…"
        : paymentFailed
          ? "Failed"
          : "—"

  return (
    <div className="flex h-screen overflow-hidden bg-bg-subtle">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative border-b border-border z-10">
          <Header
            title={`Ticket with ${project?.name || 'Support'}`}
            showBackButton={true}
            inlineRightContent={
              <span className="text-[13px] font-normal font-mono tabular-nums text-muted-foreground/80">ID: {ticketId}</span>
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
                <div className="bg-white rounded-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] flex-1 overflow-auto">
                  <div className="p-6">
                    <div className="flex flex-col" style={{ rowGap: '31.2px' }}>
                {/* Initial Ticket Info — first message in chat = "Info about issue" */}
                <div className="flex gap-3 items-start">
                  <ProfileAvatar
                    id={firstIssueMessage.senderId}
                    name={firstIssueMessage.senderName ?? "C"}
                    avatarUrl={firstIssueMessage.senderAvatarUrl ?? null}
                    size="sm"
                    radius="9.625px"
                  />
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>{firstIssueMessage.senderName}</span>
                        <span
                          className="text-xs"
                          style={{
                            color: 'rgba(0,0,0,0.5)',
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
                        <h3 className="text-sm font-medium mb-2" style={{ color: '#2E2D31' }}>Info about issue</h3>
                        <div className="space-y-3" style={{ color: '#2E2D31' }}>
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
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-card border border-border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground mb-1">Start price</p>
                          <p className="text-sm font-medium text-foreground tabular-nums">USD {startPrice}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
                          <p className="text-sm font-medium text-foreground tabular-nums">USD {first60Price}/min</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
                          <p className="text-sm font-medium text-foreground tabular-nums">USD {after60Price}/min</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {!isClaimed && (
                      <div className="flex gap-3">
                        <Button onClick={() => void handleClaimTicket()} variant="lavender" className="cursor-pointer">
                          Claim ticket
                        </Button>
                        <Button
                          onClick={handleRephraseWithAI}
                          variant="outline"
                          className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          Rephrase with AI
                        </Button>
                      </div>
                    )}

                    {isClaimed && !isTicketEnded && (
                      <div className="flex gap-3">
                        <Button
                          onClick={handleRephraseWithAI}
                          variant="outline"
                          className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          Rephrase with AI
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsEndTicketDrawerOpen(true)} className="cursor-pointer">
                          End ticket
                        </Button>
                      </div>
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
                              <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>{msg.senderName}</span>
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
                          {msg.sender !== "system" && (
                            <ProfileAvatar
                              id={msg.senderId}
                              name={msg.senderName ?? msg.avatar ?? "U"}
                              avatarUrl={msg.senderAvatarUrl ?? null}
                              size="sm"
                              radius="9.625px"
                            />
                          )}
                          <div className={`flex-1 ${msg.sender === "system" ? "text-center" : ""}`}>
                            {msg.sender !== "system" && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>{msg.senderName}</span>
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
                                msg.sender === "system"
                                  ? "bg-muted text-muted-foreground py-2 px-4 rounded-lg inline-block text-sm"
                                  : "text-sm"
                              }
                              style={msg.sender !== "system" ? { color: '#2E2D31' } : undefined}
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
                              </div>

                              {paymentFailed && (
                                <Button
                                  onClick={() =>
                                    captureTicket.mutate(
                                      { ticketId },
                                      { onError: () => toast.error("Failed to process payment. Please try again.") },
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

            <TicketChatInput
              value={message}
              onChange={setMessage}
              onSend={handleSendMessage}
              sendDisabled={!message.trim() || isTicketEnded}
              placeholder="Message #askanything"
              onImageClick={ticket?.project_id ? () => setIsImageUploadOpen(true) : undefined}
              toolbarEndContent={
                !isTicketEnded ? (
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

            {ticket?.project_id && (
              <ImageUploadModal
                open={isImageUploadOpen}
                onOpenChange={setIsImageUploadOpen}
                storagePath={`ticket-attachments/${ticket.project_id}/${ticketId}/${Date.now()}`}
                onUploadComplete={(url) => {
                  setMessage((prev) => prev + `\n![attachment](${url})\n`)
                }}
                title="Attach Image"
                description="Upload an image to attach to this ticket"
                privateBucket
              />
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-80 bg-white border-l border-border relative z-20 flex flex-col">
            <div className="flex-1 overflow-y-auto pl-5 pr-4 pt-6 pb-4">
              {/* People in Chat */}
              <div>
                <h3 className="mb-3 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>People in this chat</h3>
                {participantsLoading ? (
                  <div className="text-center text-muted-foreground text-[13px] py-4">Loading...</div>
                ) : allParticipants.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {allParticipants.map((participant) => {
                      const isCurrentUser = participant.participant_id === currentUser?.id
                      return (
                        <div key={participant.id} className="flex items-center gap-2">
                          <ProfileAvatar
                            id={participant.user.id}
                            name={participant.user.name}
                            avatarUrl={participant.user.avatar_url ?? null}
                            size="md"
                          />
                          <span className="text-[13px] text-muted-foreground">
                            {isCurrentUser ? "You" : participant.user.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-[13px] py-4">-</div>
                )}
                {!isTicketEnded && (
                  <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10">
                    <Plus className="w-4 h-4" />
                    Invite other helper
                  </Button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border my-6 -ml-5 -mr-4" />

              {/* Other Topics — from ticket keywords */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Other topics in this chat</h3>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
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
              <div className="border-t border-border my-6 -ml-5 -mr-4" />

              {/* Logged Time */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Logged time</h3>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                {timeEntries.length > 0 && (
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
                      <span className="text-[13px] text-foreground tabular-nums">{getTotalLoggedTime().formatted}</span>
                    </div>
                  </div>
                )}
                {!isTicketEnded && (
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
              <div className="border-t border-border my-6 -ml-5 -mr-4" />

              {/* Active Tickets — 3 latest claimed by this helper */}
              <div>
                <h3 className="mb-3 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Active tickets ({activeTicketsCount})</h3>
                <div className={`-ml-5 -mr-4 ${activeTicketsSidebar.length > 1 ? "max-h-72 overflow-y-auto" : ""}`}>
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
                            : "bg-white border-border hover:bg-muted"
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
          </div>
        </main>
      </div>

      {/* AI Rephrase Modal */}
      <AIRephraseModal
        isOpen={isRephraseModalOpen}
        onClose={() => setIsRephraseModalOpen(false)}
        originalText={originalTicketText}
      />

      {/* End Ticket Drawer */}
      <EndTicketDrawer
        isOpen={isEndTicketDrawerOpen}
        onClose={() => setIsEndTicketDrawerOpen(false)}
        onEndTicket={handleEndTicket}
        timeEntries={timeEntries}
      />

      <LogTimeDrawer
        isOpen={isLogTimeDrawerOpen}
        onClose={() => setIsLogTimeDrawerOpen(false)}
        onLogTime={handleLogTime}
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
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
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

