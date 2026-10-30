"use client"

import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { Sidebar } from "@/components/layout/sidebar"
import { TicketChat, type TicketChatMessage, type TicketChatParticipant } from "@/components/ticket-chat/ticket-chat"
import { Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useState, useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { GuestBanner } from "@/components/support/guest-banner"
import { TicketUnavailableNotice } from "@/components/support/ticket-unavailable-notice"
import { wasGuestAdoptionExpired } from "@/lib/guest-adoption-storage"
import { clearSupportDraft, registerSupportDraftSource, saveSupportDraft, takeSupportDraft } from "@/lib/support-draft"
import { startGuestSignIn } from "@/lib/guest-adoption"
import { ensureSupportSession, findGuestOpenTicket, isOwnGuestSession } from "@/lib/guest-session"
import { useResumableGuestTicket } from "@/hooks/useResumableGuestTicket"
import { useGuestAdoptionRetry } from "@/hooks/useGuestAdoptionRetry"
import { GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE, guestTicketCreateAction } from "@/lib/guest-ticket-errors"
import { chooseSupportSignInRedirect, setSupportSignInRedirect } from "@/lib/support-sign-in-redirect"
import { useProject, useProjectBySlug, useProjectPaymentSettings, useProjectBranding, useProjects, PROJECT_SEARCH_MIN_LENGTH } from "@/hooks/useProject"
import { useRequestProjectSupport } from "@/hooks/useRequestProjectSupport"
import { formatTicketRates, isFreeSupport } from "@/lib/ticket-pricing"
import { useCreateTicket, useRequestEndSession } from "@/hooks/useTickets"
import { useConfirmTimeEntries, getReviewTimeEntryErrorHint } from "@/hooks/useTimeEntries"
import type { TimeEntrySummaryDecline } from "@/components/ticket-chat/time-entry-review"
import { useCreateCheckoutForTicket } from "@/hooks/useCreateCheckoutForTicket"
import { useRetryTicketPayment } from "@/hooks/useRetryTicketPayment"
import { useHoldTicketAfterSetup } from "@/hooks/useHoldTicketAfterSetup"
import { ConfirmPaymentModal } from "@/components/payment/ConfirmPaymentModal"
import { useTicketMessages, useSendMessage } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useRealtimeTicket } from "@/hooks/useRealtimeTicket"
import { useEnsureParticipant, useUpdateLastReadMessage } from "@/hooks/useTicketParticipants"
import { useTicketWithDetails, useLatestUserActiveTicket } from "@/hooks/useTicketsWithDetails"
import { useCustomerTicketSidebar, toChatParticipants } from "@/hooks/useCustomerTicketSidebar"
import { CustomerTicketSidebarFooter } from "@/components/ticket-chat/customer-sidebar-footer"
import { CustomerChatIntro } from "@/components/ticket-chat/customer-chat-intro"
import {
  buildCustomerThreadMessages,
  buildSessionEndedMessage,
  describeChargedLine,
  findPendingSca,
  formatChatTimestamp,
  hasVisitorLeft,
} from "@/lib/customer-chat-messages"
import { useTicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { useProjectAverageResponseTime } from "@/hooks/useProjectResponseTime"
import { SignInModal } from "@/components/modals/sign-in-modal"
import { supabase } from "@/lib/supabase/client"
import { ensureUserOrganization } from "@/lib/organizations"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import { prepareOutgoingMessage } from "@/lib/code-format"
import { stripTicketAttachments } from "@/lib/ticket-attachments"

interface Person {
  name: string
  avatar: string
  color: string
}

// Note: support chat previously had inline syntax highlighting. The new shared TicketChat UI
// renders plain message content for now; we keep these imports available for future parity work.
void csharp
void javascript
void typescript
void python

export default function UserSupportChatPage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, setProjectRole } = useUser()
  // Guests (anonymous session, see user-context) chat without an account:
  // `user.id` stays undefined for them, `guestId` carries their auth id.
  const sessionUserId = user?.id ?? user?.guestId
  const isGuest = !user?.id && !!user?.guestId
  // Where sign-in should bring the visitor back to (this page incl. its query).
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const [message, setMessage] = useState("")
  // In-flight guard: the mutation's isPending only flips after the lazy-loaded
  // formatter has run, so a fast double Enter would otherwise send twice.
  const [isSending, setIsSending] = useState(false)
  const sendingRef = useRef(false)
  const [ticketCreated, setTicketCreated] = useState(false)
  const [ticketId, setTicketId] = useState("")
  /** Ticket created in this session (signed-in flow pushes it into the URL). */
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)
  const [topics] = useState<string[]>([])
  const [helpType] = useState<string[]>([])
  const [projectSearch, setProjectSearch] = useState("")
  // Short search terms only run when the user presses Search / Enter.
  const [projectSearchSubmitted, setProjectSearchSubmitted] = useState(false)
  // Project name the user asked us to reach out to (shows the confirmation).
  const [requestedProjectName, setRequestedProjectName] = useState<string | null>(null)
  const requestProjectSupport = useRequestProjectSupport()
  // Sign-in options open in a modal so the visitor keeps the page (and its
  // project context in the URL); the modal redirects back here after auth.
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  /** The first message right after creation, shown until the persisted copy arrives. */
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)
  /** SCA prompt (payment_requires_action) already resolved or dismissed in this session. */
  const [handledScaMessageId, setHandledScaMessageId] = useState<string | null>(null)
  /** 3-D Secure confirmation returned directly by the hold placed after card setup. */
  const [returnScaSecret, setReturnScaSecret] = useState<string | null>(null)
  /** Client secret already confirmed or dismissed, so its chat prompt doesn't reopen the modal. */
  const [handledScaSecret, setHandledScaSecret] = useState<string | null>(null)
  const holdAfterSetup = useHoldTicketAfterSetup()
  /** Checkout sessions already handled (effects run twice in dev). */
  const handledSetupSessions = useRef(new Set<string>())

  // Get project_id and optional existing ticket from query params
  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const ticketIdParam = searchParams.get("ticket")
  // `?sla=` is deliberately ignored: SLA coverage is read from the loaded
  // ticket row (`tickets.sla_id`) only, never from the URL.
  const noParams = !projectIdParam && !slugParam && !ticketIdParam

  // When the page is opened without any context (e.g. clicking "Support" in
  // the sidebar), we need to either send the user to their last ticket or let
  // them pick a project to get support from. These hooks only fetch when
  // `noParams` is true so they don't run on the normal chat flow.
  const { data: latestUserTicket, isLoading: userTicketsLoadingForResolve } =
    useLatestUserActiveTicket(noParams && sessionUserId ? sessionUserId : undefined)
  const { data: allProjects = [], isLoading: allProjectsLoading } = useProjects({
    enabled: noParams,
  })

  // If the user has at least one ticket, redirect to the one they were most
  // recently active in (ordered by updated_at desc) so they land on their
  // "last support page" instead of an empty chooser.
  useEffect(() => {
    if (!noParams) return
    if (!latestUserTicket) return
    router.replace(
      `/support/chat?ticket=${latestUserTicket.id}&project=${latestUserTicket.project_id}`,
    )
  }, [noParams, latestUserTicket, router])

  const { data: existingTicket, isLoading: existingTicketLoading } = useTicketWithDetails(ticketIdParam || undefined)
  const projectIdFromTicket = existingTicket?.project_id
  const projectId = projectIdParam || projectIdFromTicket
  const { data: projectById } = useProject(projectId || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : (slugParam ? projectBySlug : projectById)
  // Use the project's UUID when only a slug is provided, or fall back to projectId from URL/ticket
  const effectiveProjectId = project?.project_id || projectId || ""

  // A guest on ?project=/?slug= without ?ticket= resumes their open guest
  // ticket (after a reload) instead of an empty composer — a guest can't
  // open a second one. Signed-in users may open several tickets, so they
  // are never bounced (their post-sign-in redirect carries ?ticket=).
  const { data: resumableTicket } = useResumableGuestTicket(
    !ticketIdParam && !createdTicketId ? user?.guestId : undefined,
    isGuest,
    effectiveProjectId || undefined,
  )
  useEffect(() => {
    if (!resumableTicket || ticketIdParam) return
    router.replace(
      `/support/chat?ticket=${encodeURIComponent(resumableTicket.id)}&project=${encodeURIComponent(resumableTicket.project_id)}`,
    )
  }, [resumableTicket, ticketIdParam, router])
  const projectPageHref = project?.slug
    ? `/support/${encodeURIComponent(project.slug)}`
    : effectiveProjectId
      ? `/support?project=${encodeURIComponent(effectiveProjectId)}`
      : undefined
  const { data: avgResponseSeconds } = useProjectAverageResponseTime(effectiveProjectId)
  const projectName = project?.name ?? "Support"
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)

  // Ticket-ended summary for the customer: reflect that the helper closed the
  // session and what was charged. Payment status is realtime so the amount
  // settles from "Processing…" to the captured value without a reload.
  const ticketEnded =
    existingTicket?.status === "completed" || existingTicket?.status === "cancelled"
  // SLA coverage from the ticket row only (billing copy and the payment gate).
  const slaId = existingTicket?.sla_id ?? null
  const slaCovered = !!slaId
  // Fetch payment settings (the payment status needs them: free support has no payment)
  // effectiveProjectId also covers the ?slug= entry, so the displayed prices are always loaded.
  const { data: paymentSettings, isLoading: paymentSettingsLoading } = useProjectPaymentSettings(effectiveProjectId)
  // Billing uses the ticket's pricing snapshot (taken at creation); prefer it over live settings.
  const ticketPricingSnapshot = (existingTicket as { pricing_snapshot?: Record<string, number> | null } | undefined | null)?.pricing_snapshot
  const effectivePricing = ticketPricingSnapshot && paymentSettings ? { ...paymentSettings, ...ticketPricingSnapshot } : paymentSettings
  const paymentStatus = useTicketPaymentStatus(existingTicket?.id ?? null, {
    slaId,
    isFree: isFreeSupport(effectivePricing),
    ticketStatus: existingTicket?.status ?? null,
  })

  // "End session" from the customer only signals intent: the helper logs any
  // remaining time and ends from their side. Until then the customer can keep
  // chatting or withdraw the request. Realtime on the ticket row keeps
  // `end_requested_at` fresh on both ends.
  const requestEndSession = useRequestEndSession()
  const endSessionRequestedAt = existingTicket?.end_requested_at ?? null
  const handleRequestEndSession = async (cancel: boolean) => {
    if (!existingTicket?.id || !sessionUserId) return
    try {
      await requestEndSession.mutateAsync({ ticketId: existingTicket.id, userId: sessionUserId, cancel })
      toast.success(cancel ? "End request cancelled." : "The helper has been notified.")
    } catch (error) {
      console.error("Failed to update end-session request:", error)
      toast.error(cancel ? "Couldn't cancel the request. Please try again." : "Couldn't notify the helper. Please try again.")
    }
  }

  // Back from Stripe Checkout:
  // - "Add payment method" (card=added / setup_cancelled): the Checkout only
  //   saved the card, so place the ticket's hold on it now. Stripe's page
  //   never showed an amount; the chat explains the hold instead.
  // - "Update payment method" (card=updated / cancelled, see
  //   payments-retry-ticket-payment): the retry charge runs from the webhook
  //   and the summary updates via realtime — just tell the user what to expect.
  const cardParam = searchParams.get("card")
  const sessionIdParam = searchParams.get("session_id")
  useEffect(() => {
    if (!ticketIdParam || !cardParam) return
    if (cardParam === "updated") {
      toast.success("Card updated. We're retrying the payment now…")
    } else if (cardParam === "cancelled") {
      toast.info("Card update cancelled. Your previous card is still on file.")
    } else if (cardParam === "setup_cancelled") {
      toast.info("No card was added, so nothing is held.")
    } else if (cardParam === "added" && sessionIdParam && !handledSetupSessions.current.has(sessionIdParam)) {
      handledSetupSessions.current.add(sessionIdParam)
      holdAfterSetup
        .mutateAsync({ ticketId: ticketIdParam, sessionId: sessionIdParam })
        .then((result) => {
          const amount =
            typeof result.holdAmountSmallestUnit === "number"
              ? `$${(result.holdAmountSmallestUnit / 100).toFixed(2)}`
              : "the estimated amount"
          switch (result.status) {
            case "authorized":
              toast.success(`Card added. A temporary hold of ${amount} is placed on it (not a charge).`)
              break
            case "requires_action":
              if (result.clientSecret) setReturnScaSecret(result.clientSecret)
              break
            case "declined":
              toast.error(
                `Your card was saved, but your bank declined the ${amount} hold${result.declineMessage ? ` (${result.declineMessage})` : ""}. Nothing was charged. Please add a different card.`,
              )
              break
            case "pending":
              toast.info("Card added. We're placing the hold now…")
              break
            case "superseded":
              toast.info("Card saved. This ticket is already using a card you added more recently; check the chat if it still needs confirming.")
              break
            default:
              toast.success("Card added.")
          }
        })
        .catch((err) => {
          console.error("Failed to place the hold after card setup:", err)
          toast.error("Your card was saved, but we couldn't place the hold. Please try adding it again.")
        })
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete("card")
    params.delete("session_id")
    router.replace(`/support/chat?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketIdParam, cardParam])

  // When opening an existing ticket from URL, set ticket state
  const openedTicketId = ticketIdParam && existingTicket?.id ? existingTicket.id : null
  const [syncedOpenedTicketId, setSyncedOpenedTicketId] = useState<string | null>(null)
  if (openedTicketId !== syncedOpenedTicketId) {
    setSyncedOpenedTicketId(openedTicketId)
    if (openedTicketId) {
      setTicketId(openedTicketId)
      setTicketCreated(true)
    }
  }
  
  // Get user's role in this project
  const { data: projectRole } = useProjectRole(effectiveProjectId || undefined)
  
  // Check if user is a support user (has "user" role preference from localStorage)
  const isSupportUser = typeof window !== "undefined" && localStorage.getItem("userRole") === "user"
  
  // Update user context with project role
  // Support users don't get a projectRole - they're users of support, not project members
  useEffect(() => {
    if (isSupportUser) {
      // Support users should not have a projectRole set
      setProjectRole(null)
    } else if (effectiveProjectId && projectRole) {
      setProjectRole(projectRole)
    } else if (!effectiveProjectId) {
      setProjectRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProjectId, projectRole, isSupportUser])

  // Check authentication state on mount (must run before any conditional return)
  useEffect(() => {
    const checkAuth = async () => {
      await supabase.auth.getSession()
      // User context updates when session changes; this runs the check on mount.
    }
    checkAuth()
  }, [])

  // Fetch branding for project logo
  const { data: brandingData } = useProjectBranding(effectiveProjectId)
  const projectLogo = brandingData?.logo_url || null
  
  // Format payment values (convert cents to dollars); null until the project
  // has payment settings — no placeholder prices.
  const rates = formatTicketRates(effectivePricing)

  // Ticket creation and messaging
  const createTicket = useCreateTicket()
  const createCheckout = useCreateCheckoutForTicket()
  const retryPayment = useRetryTicketPayment()
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)
  useRealtimeTicket(ticketId)

  // Mark the latest message as read so the sidebar's unread dot clears for
  // the customer too (mirrors the helper page). Depend on ids only: the
  // mutation object changes identity and would loop with the invalidation.
  const updateLastReadMessage = useUpdateLastReadMessage()
  const lastMessageId = messagesData && messagesData.length > 0 ? messagesData[messagesData.length - 1].id : null
  useEffect(() => {
    if (!ticketId || !sessionUserId || !lastMessageId) return
    updateLastReadMessage.mutate({ ticketId, participantId: sessionUserId, messageId: lastMessageId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable; including updateLastReadMessage causes an update loop
  }, [ticketId, sessionUserId, lastMessageId])
  // Right sidebar data (participants / logged time / active tickets) — shared
  // with the /support Get support tab so both entry points render the same.
  const {
    participants,
    participantsLoading,
    claimer,
    timeEntriesDisplay,
    totalLoggedFormatted,
    activeTicketsSidebar,
    activeTicketsCount,
  } = useCustomerTicketSidebar(ticketId || undefined, sessionUserId)

  // Signed in with a real account (guests are not).
  const isAuthenticated = !!user?.id

  // Presence for a guest's open ticket runs in the support layout
  // (SupportGuestPresence), on every /support page.

  // Guest → sign in: save the guest session (its tickets are adopted after
  // sign-in), then come back to this chat.
  // Sign-in returns to this conversation (with ?ticket=); the sidebar and top
  // bar use the same target.
  const guestSignInRedirect = chooseSupportSignInRedirect({
    ticketId: ticketIdParam || createdTicketId || ticketId || null,
    projectId: effectiveProjectId || null,
    fallback: currentHref,
  })
  useEffect(() => {
    setSupportSignInRedirect(guestSignInRedirect)
    return () => setSupportSignInRedirect(null)
  }, [guestSignInRedirect])
  // A guest adoption that failed transiently at sign-in is retried here.
  const adoptionRetry = useGuestAdoptionRetry(isAuthenticated, router.replace)
  const handleGuestSignIn = () => {
    // Keep an unsent question across the sign-in round-trip.
    saveSupportDraft(effectiveProjectId, message)
    void startGuestSignIn(guestSignInRedirect, (href) => router.push(href))
  }
  // …and put it back once they return (shown in the composer, not sent).
  // Taken once: it never pre-fills a later new-ticket composer.
  useEffect(() => {
    if (!effectiveProjectId) return
    const draft = takeSupportDraft(effectiveProjectId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
    if (draft) setMessage((current) => current || draft)
  }, [effectiveProjectId])
  // The top-bar / sidebar "Sign in" keep the unsent message too.
  const messageRef = useRef(message)
  useEffect(() => {
    messageRef.current = message
  }, [message])
  useEffect(() => {
    registerSupportDraftSource(() => ({ projectId: effectiveProjectId, text: messageRef.current }))
    return () => registerSupportDraftSource(null)
  }, [effectiveProjectId])

  // Confirm the logged-time summary the helper sent (one action for every
  // pending entry; declines carry a reason the RPC posts into the chat).
  // Only the ticket creator may confirm — the RPC enforces it too.
  const confirmTimeEntries = useConfirmTimeEntries()
  const canConfirmTimeEntries = !!existingTicket?.id && !!user?.id && existingTicket.created_by === user.id
  const handleConfirmTimeEntries = async (declines: TimeEntrySummaryDecline[]) => {
    if (!existingTicket?.id) return
    try {
      const accepted = await confirmTimeEntries.mutateAsync({ ticketId: existingTicket?.id, declines })
      toast.success(
        declines.length > 0
          ? `Logged time confirmed. ${declines.length === 1 ? "1 entry was" : `${declines.length} entries were`} declined and the helper has been told why.`
          : accepted > 0
            ? "Logged time confirmed. The helper can now end the session."
            : "Nothing was left to confirm.",
      )
    } catch (error) {
      console.error("Failed to confirm time entries:", error)
      const hint = getReviewTimeEntryErrorHint(error)
      toast.error(
        hint === "reason_required"
          ? "Please explain why you declined the logged time."
          : hint === "nothing_to_confirm"
            ? "There is no logged time waiting for your confirmation."
            : hint === "ticket_ended"
              ? "The session has already ended."
              : hint === "review_withdrawn"
                ? "The helper changed the logged time. Wait for the updated summary."
              : "Couldn't save your confirmation. Please try again.",
      )
      throw error
    }
  }

  // Ensure support users always have an organization and a selected organization
  useEffect(() => {
    if (!isAuthenticated || !isSupportUser || selectedOrganizationId) return

    const ensureOrg = async () => {
      const result = await ensureUserOrganization("support")
      if (result?.selectedOrganizationId) {
        setSelectedOrganizationId(result.selectedOrganizationId)
      }
    }

    void ensureOrg()
  }, [isAuthenticated, isSupportUser, selectedOrganizationId])

  const nowFormatted = useMemo(() => formatChatTimestamp(new Date()), [])

  const welcomeText = slaCovered
    ? `Welcome to ${projectName}'s support chat. This ticket is covered by your SLA.\nAsk your question and someone from our team will try to help you, as soon as we can.`
    : `Welcome to ${projectName}'s support chat.\nAsk your question and someone from our team will try to help you, as soon as we can.`

  // Thread: disclaimer → claimed banner → (pending first message) → persisted
  // messages → session summary once ended. Shared with the /support page.
  const chatMessages: TicketChatMessage[] = useMemo(() => {
    const list = buildCustomerThreadMessages({
      projectName,
      projectLogo,
      nowFormatted,
      messagesData,
      claimer,
      pendingFirstMessage,
      fallbackDescription: existingTicket?.description ?? null,
      fallbackTimestamp: existingTicket?.created_at ?? null,
      ticketStatus: existingTicket?.status ?? null,
      currentUser: { id: sessionUserId, name: isGuest ? "Guest" : user?.name, avatarUrl: user?.avatarUrl },
      avgResponseSeconds,
    })
    // A guest ticket closed because the visitor left carries its own
    // visitor_left message — no helper "session ended" summary.
    if (ticketEnded && !hasVisitorLeft(messagesData, existingTicket?.status)) {
      const cancelled = existingTicket?.status === "cancelled"
      list.push(
        buildSessionEndedMessage({
          cancelled,
          totalLoggedFormatted,
          chargedLine: describeChargedLine({
            cancelled,
            slaCovered,
            paymentStatus: paymentStatus.status,
            capturedAmountSmallestUnit: paymentStatus.capturedAmountSmallestUnit,
            failureReason: paymentStatus.failureReason,
          }),
        }),
      )
    }
    return list
  }, [
    projectName,
    projectLogo,
    nowFormatted,
    messagesData,
    claimer,
    pendingFirstMessage,
    existingTicket?.description,
    existingTicket?.created_at,
    existingTicket?.status,
    avgResponseSeconds,
    ticketEnded,
    totalLoggedFormatted,
    slaCovered,
    paymentStatus.status,
    paymentStatus.capturedAmountSmallestUnit,
    paymentStatus.failureReason,
    sessionUserId,
    isGuest,
    user?.name,
    user?.avatarUrl,
  ])

  // Off-session hold that landed in requires_action (SCA) → ConfirmPaymentModal.
  // Derived from the thread; `handledScaMessageId` stops a handled prompt reopening.
  const pendingSca = useMemo(
    () => findPendingSca(chatMessages, handledScaMessageId),
    [chatMessages, handledScaMessageId],
  )
  // The hold placed on return from card setup hands back its confirmation
  // directly; it can also arrive as a chat prompt, which must not reopen the
  // modal once handled.
  const scaToConfirm: { clientSecret: string; messageId: string | null } | null = returnScaSecret
    ? { clientSecret: returnScaSecret, messageId: null }
    : pendingSca && pendingSca.clientSecret !== handledScaSecret
      ? pendingSca
      : null
  const closeSca = (sca: { clientSecret: string; messageId: string | null }) => {
    setHandledScaSecret(sca.clientSecret)
    setReturnScaSecret(null)
    if (sca.messageId) setHandledScaMessageId(sca.messageId)
  }

  if (noParams) {
    // While we look up the user's latest ticket, show a small loading state.
    // The redirect to that ticket is handled by the effect above.
    const resolving =
      (!!sessionUserId && userTicketsLoadingForResolve) || !!latestUserTicket
    if (resolving) {
      return (
        <div className="flex flex-1 min-h-0 overflow-hidden bg-page-muted">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading your support…</div>
          </main>
        </div>
      )
    }

    // No tickets (or not signed in) → let the user pick a project to get
    // support from. Results only show once the term is long enough, or the
    // user explicitly pressed Search for a shorter one.
    const projectTerm = projectSearch.trim()
    const canSearchProjects =
      projectTerm.length >= PROJECT_SEARCH_MIN_LENGTH ||
      (projectSearchSubmitted && projectTerm.length > 0)
    const filteredProjects = canSearchProjects
      ? allProjects.filter((p) => p.name.toLowerCase().includes(projectTerm.toLowerCase()))
      : []
    const requestAlreadySent =
      !!requestedProjectName && requestedProjectName.toLowerCase() === projectTerm.toLowerCase()

    const handleProjectSearchChange = (value: string) => {
      setProjectSearch(value)
      setProjectSearchSubmitted(false)
    }

    const handleRequestProjectSupport = async () => {
      if (isGuest) {
        handleGuestSignIn()
        return
      }
      if (!isAuthenticated) {
        setIsSignInModalOpen(true)
        return
      }
      try {
        await requestProjectSupport.mutateAsync({ projectName: projectTerm })
        setRequestedProjectName(projectTerm)
      } catch (error: unknown) {
        console.error("Failed to request project support:", error)
        toast.error(error instanceof Error ? error.message : "Failed to send your request. Please try again.")
      }
    }

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-page-muted">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Which project do you need support with?
            </h1>
            <p className="text-muted-foreground mb-6">
              {isAuthenticated
                ? "You have no support tickets yet. Pick a project to start a new conversation."
                : "Pick a project to start a new support conversation."}
            </p>

            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects"
                  value={projectSearch}
                  onChange={(e) => handleProjectSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && projectTerm) setProjectSearchSubmitted(true)
                  }}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setProjectSearchSubmitted(true)}
                disabled={!projectTerm || canSearchProjects}
              >
                Search
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {canSearchProjects
                ? "Pick a project below to start a conversation."
                : `Type at least ${PROJECT_SEARCH_MIN_LENGTH} characters, or press Search.`}
            </p>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {allProjectsLoading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading projects…
                </div>
              ) : !canSearchProjects ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Start typing the name of the project you need help with.
                </div>
              ) : filteredProjects.length === 0 ? (
                requestAlreadySent ? (
                  <div className="px-4 py-6 text-sm">
                    <p className="font-medium text-foreground">We&rsquo;re on it!</p>
                    <p className="text-muted-foreground mt-1">
                      {projectTerm} isn&rsquo;t on Githelp yet. We&rsquo;re reaching out to them for you, and
                      you&rsquo;ll be notified as soon as you can get support for it here.
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No projects match &ldquo;{projectTerm}&rdquo;. It may not be on Githelp yet &mdash; we can
                      reach out to them for you.
                    </p>
                    <Button
                      onClick={handleRequestProjectSupport}
                      disabled={requestProjectSupport.isPending}
                      variant="brand"
                    >
                      {requestProjectSupport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Request to get help
                    </Button>
                  </div>
                )
              ) : (
                <ul className="divide-y divide-border">
                  {filteredProjects.map((p) => (
                    <li key={p.project_id}>
                      <Link
                        href={`/support/chat?slug=${encodeURIComponent(p.slug)}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Get support
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
        <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
      </div>
    )
  }

  // A ticket created in this session is already on screen; don't swap it for
  // the loading/not-found screens while its ?ticket= lookup catches up.
  const openingOtherTicket = !!ticketIdParam && ticketIdParam !== createdTicketId
  if (openingOtherTicket && existingTicketLoading) {
    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-page-muted">
        <Sidebar projectPageHref={projectPageHref} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading ticket…</div>
        </main>
      </div>
    )
  }

  if (openingOtherTicket && !existingTicket?.id) {
    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-page-muted">
        <Sidebar projectPageHref={projectPageHref} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <TicketUnavailableNotice
              linking={adoptionRetry.linking}
              failedFinal={adoptionRetry.failedFinal}
              deferred={adoptionRetry.deferred}
              onLink={adoptionRetry.linkNow}
              // The guest conversation's key ran out before it was linked.
              expired={isAuthenticated && !adoptionRetry.linking && wasGuestAdoptionExpired()}
              newConversationHref={
                projectIdParam ? `/support/chat?project=${encodeURIComponent(projectIdParam)}` : "/support/chat"
              }
            />
          </div>
        </main>
      </div>
    )
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return
    if (ticketEnded) {
      toast.error("This ticket is closed, so new messages can't be sent.")
      return
    }
    // A new ticket must be created against prices the customer has actually seen.
    if (!ticketCreated && (paymentSettingsLoading || !paymentSettings)) {
      toast.error(paymentSettingsLoading ? "Loading the project's rates — try again in a moment." : "This project isn't accepting tickets yet.")
      return
    }
    if (sendingRef.current) return
    sendingRef.current = true
    setIsSending(true)

    try {
      // No session yet: start an anonymous guest session so the visitor can
      // ask without an account (tickets need created_by = auth.uid()).
      let senderId = sessionUserId
      if (!senderId) {
        const guest = await ensureSupportSession()
        if (!guest.ok) {
          toast.error("Couldn't start the conversation. Please try again.", { description: guest.message })
          return
        }
        senderId = guest.userId
      }

      if (!ticketCreated && effectiveProjectId) {
        let ticket
        try {
          ticket = await createTicket.mutateAsync({
            project_id: effectiveProjectId,
            title: stripTicketAttachments(message).substring(0, 100) || "Support Request",
            description: message,
            created_by: senderId,
            status: "available",
            priority: "medium",
            // The prices the customer was shown; the database refuses the ticket if
            // they no longer match, so nobody is billed at prices they never saw.
            ...(paymentSettings
              ? {
                  pricing_snapshot: {
                    ticket_start_price: paymentSettings.ticket_start_price,
                    ticket_price_minute_first_60: paymentSettings.ticket_price_minute_first_60,
                    ticket_price_minute_after_60: paymentSettings.ticket_price_minute_after_60,
                  },
                }
              : {}),
          } as Parameters<typeof createTicket.mutateAsync>[0])
        } catch (error) {
          console.error("Failed to create ticket:", error)
          const hint = (error as { hint?: string } | null)?.hint
          const guestAction = guestTicketCreateAction(error)
          if (hint === "ticket_prices_changed") {
            toast.error("The project's prices just changed.", {
              description: "Please review the updated rates, then send your message again.",
            })
            void queryClient.invalidateQueries({ queryKey: ["project-payment-settings"] })
          } else if (hint === "project_pricing_missing") {
            toast.error("This project isn't accepting tickets yet.", {
              description: "Its pricing hasn't been set up. Please try again later.",
            })
          } else if (guestAction?.kind === "resume") {
            // guest_open_ticket_exists: reopen their conversation here (the
            // typed message stays in the composer); if it's on another
            // project, say so.
            const existing = await findGuestOpenTicket(senderId, effectiveProjectId)
            if (existing) {
              toast.info("You already have an open conversation here, so we reopened it.")
              router.replace(
                `/support/chat?ticket=${encodeURIComponent(existing.id)}&project=${encodeURIComponent(existing.project_id)}`,
              )
            } else {
              toast.error(GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE, {
                action: { label: "Sign in", onClick: handleGuestSignIn },
              })
            }
          } else if (guestAction?.kind === "sign-in") {
            toast.error(guestAction.message, { action: { label: "Sign in", onClick: handleGuestSignIn } })
          } else {
            toast.error("Couldn't create your ticket. Please try again.", {
              description: error instanceof Error ? error.message : undefined,
            })
          }
          return
        }

        setTicketCreated(true)
        clearSupportDraft(effectiveProjectId)
        setTicketId(ticket.id)
        setCreatedTicketId(ticket.id)
        const firstMessageContent = await prepareOutgoingMessage(message)
        setMessage("")
        // Show the question immediately; it's replaced by the persisted
        // message once the messages query includes it.
        setPendingFirstMessage(firstMessageContent)

        try {
          await ensureParticipant.mutateAsync({
            ticketId: ticket.id,
            participantId: senderId,
            claimed: false,
          })
          await sendMessage.mutateAsync({
            ticket_id: ticket.id,
            sender_id: senderId,
            sender_type: "user",
            content: firstMessageContent,
          })
        } catch (error) {
          // The ticket exists (with the question as its description); only the
          // chat copy of the first message failed.
          console.error("Failed to post the first message:", error)
          toast.error("Your ticket was created, but the message couldn't be posted to the chat.", {
            description: error instanceof Error ? error.message : undefined,
          })
        }

        // Put the new ticket in the URL so the page behaves exactly like a
        // reopened ticket from here on (ticket details, claimed banner,
        // end-of-session summary all key off `?ticket=`).
        const params = new URLSearchParams(searchParams.toString())
        params.set("ticket", ticket.id)
        params.set("project", effectiveProjectId)
        router.replace(`/support/chat?${params.toString()}`)

        supabase.functions.invoke("classify-ticket", {
          body: {
            ticket_id: ticket.id,
            project_id: effectiveProjectId,
            title: ticket.title,
            description: ticket.description ?? firstMessageContent,
          },
        }).then((resp: { error?: { message?: string } | null }) => {
          if (resp?.error) console.warn("classify-ticket failed:", resp.error.message)
        }).catch(() => {})
        return
      }

      if (!ticketId) return
      try {
        await sendMessage.mutateAsync({
          ticket_id: ticketId,
          sender_id: senderId,
          sender_type: "user",
          content: await prepareOutgoingMessage(message),
        })
        setMessage("")
      } catch (error) {
        console.error("Failed to send message:", error)
        toast.error("Couldn't send your message. Please try again.", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    } finally {
      sendingRef.current = false
      setIsSending(false)
    }
  }

  // Decide "guest" from the session itself (not only user.guestId, which
  // lags right after the first send), so the guest is always saved.
  const handleSignIn = () => {
    void isOwnGuestSession().then((ownGuest) => (ownGuest ? handleGuestSignIn() : setIsSignInModalOpen(true)))
  }

  // visitor_left: the guest ticket was closed; start over on this project.
  const handleStartNewConversation = () => {
    void queryClient.removeQueries({ queryKey: ["resumable-ticket"] })
    setTicketId("")
    setTicketCreated(false)
    setCreatedTicketId(null)
    setPendingFirstMessage(null)
    setMessage("")
    router.push(
      effectiveProjectId
        ? `/support/chat?project=${encodeURIComponent(effectiveProjectId)}`
        : "/support/chat",
    )
  }

  // "People in this chat": tickets_participants, plus the ticket creator if
  // they have no participant row (e.g. old tickets).
  const creatorUser = existingTicket?.user as { name?: string; avatar_url?: string | null } | null | undefined
  const chatParticipants: TicketChatParticipant[] = toChatParticipants(
    participants,
    sessionUserId,
    existingTicket?.created_by && creatorUser
      ? { id: existingTicket.created_by, name: creatorUser.name, avatar_url: creatorUser.avatar_url }
      : null,
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <Sidebar projectPageHref={projectPageHref} />

      <TicketChat
        headerTitle={`Ticket with ${projectName}`}
        headerTitleClassName="text-xl"
        headerSubtitle={ticketCreated ? `ID: ${ticketId}` : undefined}
        showBackButton={false}
        intro={
          <CustomerChatIntro
            projectId={effectiveProjectId}
            projectName={projectName}
            projectLogo={projectLogo}
            primaryColor={brandingData?.primary_color}
            welcomeText={welcomeText}
            timestamp={nowFormatted}
            rates={rates}
            isFree={isFreeSupport(effectivePricing)}
            isAuthenticated={isAuthenticated}
            ticketCreated={ticketCreated}
            userName={user?.name}
            onSignIn={handleSignIn}
          />
        }
        messages={chatMessages}
        participants={chatParticipants}
        participantsLoading={participantsLoading}
        topics={topics}
        helpTypes={helpType}
        message={message}
        onMessageChange={setMessage}
        onSend={handleSendMessage}
        sendDisabled={!message.trim() || createTicket.isPending}
        sending={isSending}
        isEnded={ticketEnded}
        paymentStatus={paymentStatus.status}
        // Signed-out visitors get the composer: the first send starts a guest
        // session. While a guest, a banner above it offers sign-in.
        composerBanner={isGuest ? <GuestBanner redirectTo={guestSignInRedirect} onSignIn={handleGuestSignIn} /> : undefined}
        onStartNewConversation={handleStartNewConversation}
        paymentRequiresSignIn={isGuest}
        onSignInClick={handleGuestSignIn}
        // Nobody but an admin can end a guest ticket: no "End session" for the guest.
        onRequestEndSession={
          existingTicket?.id && sessionUserId && !isGuest && !existingTicket.guest
            ? () => handleRequestEndSession(false)
            : undefined
        }
        onCancelEndSessionRequest={() => handleRequestEndSession(true)}
        endSessionRequestedAt={endSessionRequestedAt}
        endSessionRequestPending={requestEndSession.isPending}
        timeReviewRequestedAt={existingTicket?.time_review_requested_at ?? null}
        timeEntrySummary={timeEntriesDisplay}
        onConfirmTimeEntries={canConfirmTimeEntries ? handleConfirmTimeEntries : undefined}
        timeEntryConfirmPending={confirmTimeEntries.isPending}
        timeReviewHelperName={claimer?.name ?? null}
        // Before the first message there is no ticket yet: uploads go to the
        // user's own folder (see lib/ticket-attachments).
        attachmentStoragePrefix={sessionUserId && effectiveProjectId ? `${effectiveProjectId}/${ticketId || sessionUserId}` : undefined}
        onPaymentCtaClick={async (msg) => {
          const metaTicketId = msg.paymentMetadata?.ticket_id as string | undefined
          const target = metaTicketId || ticketId
          if (!target) return
          // Failed final charge → save a new card; the backend retries the
          // charge as soon as Stripe confirms it.
          if (msg.paymentMetadata?.kind === "payment_failed") {
            try {
              const out = await retryPayment.mutateAsync({ ticketId: target })
              window.location.assign(out.checkoutUrl)
            } catch (err) {
              console.error("Failed to start card update:", err)
              toast.error(err instanceof Error ? err.message : "Couldn't open Stripe Checkout. Please try again.")
            }
            return
          }
          try {
            const out = await createCheckout.mutateAsync({ ticketId: target })
            window.location.assign(out.checkoutUrl)
          } catch (err) {
            console.error("Failed to start Stripe Checkout:", err)
            toast.error(err instanceof Error ? err.message : "Couldn't open Stripe Checkout. Please try again.")
          }
        }}
        paymentCtaLoading={createCheckout.isPending || retryPayment.isPending}
        rightSidebarFooter={
          isAuthenticated ? (
            <CustomerTicketSidebarFooter
              ticketId={ticketId || undefined}
              hasClaimer={!!claimer}
              timeEntries={timeEntriesDisplay}
              totalLoggedFormatted={totalLoggedFormatted}
              activeTickets={activeTicketsSidebar}
              activeTicketsCount={activeTicketsCount}
            />
          ) : undefined
        }
      />
      {scaToConfirm && (
        <ConfirmPaymentModal
          clientSecret={scaToConfirm.clientSecret}
          mode={project?.sandbox ? "test" : "live"}
          onResolved={() => closeSca(scaToConfirm)}
          onCancel={() => closeSca(scaToConfirm)}
        />
      )}
      <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
    </div>
  )
}
