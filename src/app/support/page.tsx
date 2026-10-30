"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import { useProject, useProjectBySlug, useProjectResources, useProjectBranding, useProjectPaymentSettings } from "@/hooks/useProject"
import { formatTicketRates, isFreeSupport } from "@/lib/ticket-pricing"
import { useProjectAverageResponseTime } from "@/hooks/useProjectResponseTime"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { GuestBanner } from "@/components/support/guest-banner"
import { startGuestSignIn } from "@/lib/guest-adoption"
import { ensureSupportSession, findGuestOpenTicket, isOwnGuestSession } from "@/lib/guest-session"
import { useResumableGuestTicket } from "@/hooks/useResumableGuestTicket"
import { useGuestAdoptionRetry } from "@/hooks/useGuestAdoptionRetry"
import { GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE, guestTicketCreateAction } from "@/lib/guest-ticket-errors"
import { chooseSupportSignInRedirect, setSupportSignInRedirect } from "@/lib/support-sign-in-redirect"
import { signInHref } from "@/lib/sign-in-href"
import { clearSupportDraft, registerSupportDraftSource, saveSupportDraft } from "@/lib/support-draft"
import { PublicSupportSidebar } from "@/components/layout/public-support-sidebar"
import { TicketChat, type TicketChatMessage, type TicketChatParticipant } from "@/components/ticket-chat/ticket-chat"
import { CustomerTicketSidebarFooter } from "@/components/ticket-chat/customer-sidebar-footer"
import { useTicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { CustomerChatIntro } from "@/components/ticket-chat/customer-chat-intro"
import {
  buildCustomerThreadMessages,
  buildSessionEndedMessage,
  describeChargedLine,
  findPendingSca,
  formatChatTimestamp,
  hasVisitorLeft,
} from "@/lib/customer-chat-messages"
import { useCreateTicket, useRequestEndSession, useTicket } from "@/hooks/useTickets"
import { useConfirmTimeEntries, getReviewTimeEntryErrorHint } from "@/hooks/useTimeEntries"
import type { TimeEntrySummaryDecline } from "@/components/ticket-chat/time-entry-review"
import { useCreateCheckoutForTicket } from "@/hooks/useCreateCheckoutForTicket"
import { useRetryTicketPayment } from "@/hooks/useRetryTicketPayment"
import { ConfirmPaymentModal } from "@/components/payment/ConfirmPaymentModal"
import { useSendMessage, useTicketMessages } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useRealtimeTicket } from "@/hooks/useRealtimeTicket"
import { useEnsureParticipant, useUpdateLastReadMessage } from "@/hooks/useTicketParticipants"
import { useCustomerTicketSidebar, toChatParticipants } from "@/hooks/useCustomerTicketSidebar"
import { SignInModal } from "@/components/modals/sign-in-modal"
import { supabase } from "@/lib/supabase/client"
import { getAvatarColorHexForId, ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { prepareOutgoingMessage } from "@/lib/code-format"
import { stripTicketAttachments } from "@/lib/ticket-attachments"
import { RatesAndDetailsContent } from "@/components/support/rates-and-details-content"
import { ResourcesContent } from "@/components/support/resources-content"
import { AboutSupportContent } from "@/components/support/about-support-content"

type TabKey = "get-support" | "rates" | "resources" | "about"

const TAB_LABEL_TO_KEY: Record<string, TabKey> = {
  "Get support": "get-support",
  "Rates and details": "rates",
  "Resources": "resources",
  "About support": "about",
}

const TAB_KEY_TO_LABEL: Record<TabKey, string> = {
  "get-support": "Get support",
  "rates": "Rates and details",
  "resources": "Resources",
  "about": "About support",
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("get-support")
  const [hasEnteredChat, setHasEnteredChat] = useState(false)
  const { user, setProjectRole } = useUser()
  // Guests (anonymous session, see user-context) chat without an account:
  // `user.id` stays undefined for them, `guestId` carries their auth id.
  const sessionUserId = user?.id ?? user?.guestId
  const isGuest = !user?.id && !!user?.guestId
  const router = useRouter()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams<{ slug?: string }>()
  // Where sign-in should bring the visitor back to (this page incl. ?project/?slug).
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`

  const projectIdParam = searchParams.get("project")
  const slugParam = params?.slug || searchParams.get("slug")
  const { data: projectById } = useProject(projectIdParam || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : projectBySlug
  const projectId = project?.project_id

  // Get user's role in this project
  const { data: projectRole } = useProjectRole(projectId || undefined)

  // Update user context with project role
  useEffect(() => {
    if (projectId && projectRole) {
      setProjectRole(projectRole)
    } else if (!projectId) {
      setProjectRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectRole])

  // Fetch resources and branding from database
  const { data: resourcesData, isLoading: resourcesLoading } = useProjectResources(projectId || "")
  const { data: brandingData } = useProjectBranding(projectId || "")
  const { data: paymentSettings, isLoading: paymentSettingsLoading } = useProjectPaymentSettings(projectId || "")
  const { data: avgResponseSeconds, isPending: avgResponseLoading } = useProjectAverageResponseTime(projectId || "")

  // Get project logo from branding only
  const projectLogo = brandingData?.logo_url || null
  const projectName = project?.name || "Support"


  // Transform resources data
  const resources = resourcesData || []

  // Chat state for the "get-support" tab — mirrors src/app/support/chat/page.tsx
  const [message, setMessage] = useState("")
  const [ticketCreated, setTicketCreated] = useState(false)
  const [ticketId, setTicketId] = useState("")
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)
  // In-flight guard: the mutation's isPending only flips after the lazy-loaded
  // formatter has run, so a fast double Enter would otherwise send twice.
  const [isSending, setIsSending] = useState(false)
  const sendingRef = useRef(false)

  // A guest who reloads (or comes back) resumes their open ticket on this
  // project instead of an empty composer that would hit guest_ticket_limit.
  const [resumedTicketId, setResumedTicketId] = useState<string | null>(null)
  const { data: resumableGuestTicket } = useResumableGuestTicket(
    !ticketId ? user?.guestId : undefined,
    isGuest,
    projectId || undefined,
  )
  if (resumableGuestTicket && !ticketId && resumableGuestTicket.id !== resumedTicketId) {
    setResumedTicketId(resumableGuestTicket.id)
    setTicketId(resumableGuestTicket.id)
    setTicketCreated(true)
    setHasEnteredChat(true)
  }

  const createTicket = useCreateTicket()
  const createCheckout = useCreateCheckoutForTicket()
  const retryPayment = useRetryTicketPayment()
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)
  useRealtimeTicket(ticketId)
  const { data: liveTicket } = useTicket(ticketId)
  // Billing uses the ticket's pricing snapshot (taken at creation); prefer it over live settings.
  const ticketPricingSnapshot = (liveTicket as { pricing_snapshot?: Record<string, number> | null } | undefined | null)?.pricing_snapshot
  const effectivePricing = ticketPricingSnapshot && paymentSettings ? { ...paymentSettings, ...ticketPricingSnapshot } : paymentSettings
  // Format payment values (convert cents to dollars); null until the project
  // has payment settings — no placeholder prices. An open ticket shows its snapshot.
  const rates = formatTicketRates(effectivePricing)

  // Signed in with a real account (guests are not).
  const isAuthenticated = !!user?.id
  // A guest adoption that failed transiently at sign-in is retried here.
  useGuestAdoptionRetry(isAuthenticated, router.replace)

  // Right sidebar data — same hook as /support/chat so "People in this chat",
  // "Logged time" and "Active tickets" behave identically on both pages.
  // Anonymous visitors (no user id) get participants only; the footer below
  // is rendered for signed-in users.
  const {
    participants,
    participantsLoading,
    claimer,
    timeEntriesDisplay,
    totalLoggedFormatted,
    activeTicketsSidebar,
    activeTicketsCount,
  } = useCustomerTicketSidebar(ticketId || undefined, sessionUserId)
  const chatParticipants: TicketChatParticipant[] = toChatParticipants(participants, sessionUserId)

  // Confirm the logged-time summary the helper sent (one action for every
  // pending entry; declines carry a reason the RPC posts into the chat).
  // Only the ticket creator may confirm — the RPC enforces it too.
  const confirmTimeEntries = useConfirmTimeEntries()
  const canConfirmTimeEntries = !!ticketId && !!user?.id && liveTicket?.created_by === user.id
  const handleConfirmTimeEntries = async (declines: TimeEntrySummaryDecline[]) => {
    if (!ticketId) return
    try {
      const accepted = await confirmTimeEntries.mutateAsync({ ticketId: ticketId, declines })
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

  // Customer "End session" = ask the helper to finalise (see useRequestEndSession).
  const requestEndSession = useRequestEndSession()
  const handleRequestEndSession = async (cancel: boolean) => {
    if (!ticketId || !sessionUserId) return
    try {
      await requestEndSession.mutateAsync({ ticketId, userId: sessionUserId, cancel })
      toast.success(cancel ? "End request cancelled." : "The helper has been notified.")
    } catch (error) {
      console.error("Failed to update end-session request:", error)
      toast.error(cancel ? "Couldn't cancel the request. Please try again." : "Couldn't notify the helper. Please try again.")
    }
  }
  const ticketEnded = liveTicket?.status === "completed" || liveTicket?.status === "cancelled"
  const liveTicketIsGuest = !!(liveTicket as { guest?: boolean } | null | undefined)?.guest
  // Presence for a guest's open ticket runs in the support layout
  // (SupportGuestPresence), on every /support page.
  // The top-bar / sidebar "Sign in" keep the unsent message too.
  const messageRef = useRef(message)
  useEffect(() => {
    messageRef.current = message
  }, [message])
  useEffect(() => {
    registerSupportDraftSource(() => ({ projectId, text: messageRef.current }))
    return () => registerSupportDraftSource(null)
  }, [projectId])
  // Sign-in returns to the chat page with this ticket (now owned by the real
  // account after adoption), else to /support/chat for this project.
  const guestSignInRedirect = chooseSupportSignInRedirect({
    ticketId: ticketId || null,
    projectId: projectId ?? null,
    fallback: currentHref,
  })
  // Every other sign-in entry point on this page (sidebar, top bar) returns
  // to the same place, so the conversation is on screen after sign-in.
  useEffect(() => {
    setSupportSignInRedirect(guestSignInRedirect)
    return () => setSupportSignInRedirect(null)
  }, [guestSignInRedirect])
  const handleGuestSignIn = () => {
    // Keep an unsent question across the sign-in round-trip.
    saveSupportDraft(projectId, message)
    void startGuestSignIn(guestSignInRedirect, (href) => router.push(href))
  }
  // SLA coverage comes from the ticket row only (never from the URL).
  const slaId = liveTicket?.sla_id ?? null
  const paymentStatus = useTicketPaymentStatus(ticketId || null, {
    slaId,
    isFree: isFreeSupport(effectivePricing),
    ticketStatus: liveTicket?.status ?? null,
  })

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

  // Welcome message used as the prose copy in the intro block.
  const welcomeMessageContent = useMemo(
    () =>
      `Welcome to ${projectName}'s support chat.\nAsk your question and someone from our team will try to help you, as soon as we can.`,
    [projectName],
  )


  const nowFormatted = useMemo(() => formatChatTimestamp(new Date()), [])

  // Thread: disclaimer → claimed banner → (pending first message) → persisted
  // messages → session summary once ended. Shared with /support/chat.
  const chatMessages: TicketChatMessage[] = useMemo(() => {
    const list = buildCustomerThreadMessages({
      projectName,
      projectLogo,
      nowFormatted,
      messagesData,
      claimer,
      pendingFirstMessage,
      fallbackDescription: liveTicket?.description ?? null,
      fallbackTimestamp: liveTicket?.created_at ?? null,
      ticketStatus: liveTicket?.status ?? null,
      currentUser: { id: sessionUserId, name: isGuest ? "Guest" : user?.name, avatarUrl: user?.avatarUrl },
      avgResponseSeconds,
    })
    // A guest ticket closed because the visitor left carries its own
    // visitor_left message — no helper "session ended" summary.
    if (ticketEnded && !hasVisitorLeft(messagesData, liveTicket?.status)) {
      const cancelled = liveTicket?.status === "cancelled"
      list.push(
        buildSessionEndedMessage({
          cancelled,
          totalLoggedFormatted,
          chargedLine: describeChargedLine({
            cancelled,
            slaCovered: !!slaId,
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
    liveTicket?.description,
    liveTicket?.created_at,
    liveTicket?.status,
    slaId,
    avgResponseSeconds,
    ticketEnded,
    totalLoggedFormatted,
    paymentStatus.status,
    paymentStatus.capturedAmountSmallestUnit,
    paymentStatus.failureReason,
    sessionUserId,
    isGuest,
    user?.name,
    user?.avatarUrl,
  ])

  // Off-session hold that landed in requires_action (SCA): open the existing
  // ConfirmPaymentModal with the client_secret from the system message. The
  // webhook then marks the payment authorized and a follow-up system message
  // confirms. Derived from the thread (no effect) — `handledScaMessageId`
  // keeps a resolved/cancelled prompt from reopening.
  const [handledScaMessageId, setHandledScaMessageId] = useState<string | null>(null)
  const pendingSca = useMemo(
    () => findPendingSca(chatMessages, handledScaMessageId),
    [chatMessages, handledScaMessageId],
  )

  const handlePaymentCta = async (msg: TicketChatMessage) => {
    const metaTicketId = msg.paymentMetadata?.ticket_id as string | undefined
    const target = metaTicketId || ticketId
    if (!target) return
    // Failed final charge → save a new card; the backend retries the charge
    // as soon as Stripe confirms it.
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
      // Stripe Checkout returns to /support/chat?ticket=… which now renders
      // the same chat/sidebar as this page.
      const out = await createCheckout.mutateAsync({ ticketId: target })
      window.location.assign(out.checkoutUrl)
    } catch (err) {
      console.error("Failed to start Stripe Checkout:", err)
      // useCreateCheckoutForTicket throws toEdgeFunctionError, so the message
      // is the backend's mapped copy (same as /support/chat).
      toast.error(err instanceof Error ? err.message : "Couldn't open Stripe Checkout. Please try again.")
    }
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

      if (!ticketCreated && projectId) {
        let ticket
        try {
          ticket = await createTicket.mutateAsync({
            project_id: projectId,
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
            const existing = await findGuestOpenTicket(senderId, projectId)
            if (existing) {
              setResumedTicketId(existing.id)
              setTicketId(existing.id)
              setTicketCreated(true)
              toast.info("You already have an open conversation here, so we reopened it.")
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
        clearSupportDraft(projectId)
        setTicketId(ticket.id)
        const firstMessageContent = await prepareOutgoingMessage(message)
        setMessage("")
        // Show the question immediately; hidden once the persisted message arrives.
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

        supabase.functions
          .invoke("classify-ticket", {
            body: {
              ticket_id: ticket.id,
              project_id: projectId,
              title: ticket.title,
              description: ticket.description ?? firstMessageContent,
            },
          })
          .then((resp: { error?: { message?: string } | null }) => {
            if (resp?.error) console.warn("classify-ticket failed:", resp.error.message)
          })
          .catch(() => {})
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

  // Sign-in options open in a modal so the visitor keeps the page (and its
  // project context in the URL); the modal redirects back here after auth.
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  // Decide "guest" from the session itself (not only user.guestId, which
  // lags right after the first send), so the guest is always saved.
  const handleSignIn = () => {
    void isOwnGuestSession().then((ownGuest) => (ownGuest ? handleGuestSignIn() : setIsSignInModalOpen(true)))
  }

  // visitor_left: the guest ticket was closed; start over in this chat.
  const handleStartNewConversation = () => {
    void queryClient.removeQueries({ queryKey: ["resumable-ticket"] })
    setTicketId("")
    setTicketCreated(false)
    setPendingFirstMessage(null)
    setMessage("")
  }

  // "Get support": signed-in users are routed into the user-portal chat
  // experience on /support/chat — same CustomerChatIntro/ticket-creation flow
  // as the in-page chat below, but with the user-portal Sidebar (Tickets,
  // Support, Reports, Settings, …) instead of the PublicSupportSidebar. The
  // same project context is passed via the URL. Unauthenticated/incognito
  // visitors have no user portal, so they keep the in-page chat flow here.
  const handleGetSupport = () => {
    if (isAuthenticated) {
      if (projectId) {
        router.push(`/support/chat?project=${encodeURIComponent(projectId)}`)
        return
      }
      if (slugParam) {
        router.push(`/support/chat?slug=${encodeURIComponent(slugParam)}`)
        return
      }
    }
    setHasEnteredChat(true)
  }

  if (!projectIdParam && !slugParam) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h1 className="text-2xl font-semibold text-[#444444] mb-2">Missing project identifier</h1>
          <p className="text-[#868c98] mb-6">
            This support page is project-specific. Please open it using a link that includes either a project <span className="font-semibold">slug</span> or <span className="font-semibold">id</span>.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild className="bg-[#554abf] hover:bg-[#4a3fa3] text-white cursor-pointer">
              <Link href={signInHref(currentHref, { support: true })}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-200 text-[#444444] bg-transparent cursor-pointer">
              <Link href="/">Go to home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const chatIntro = (
    <CustomerChatIntro
      projectId={projectId ?? ""}
      projectName={projectName}
      projectLogo={projectLogo}
      primaryColor={brandingData?.primary_color}
      welcomeText={welcomeMessageContent}
      timestamp={nowFormatted}
      rates={rates}
      isFree={isFreeSupport(effectivePricing)}
      isAuthenticated={isAuthenticated}
      ticketCreated={ticketCreated}
      userName={user?.name}
      onSignIn={handleSignIn}
    />
  )

  return (
    // Fill exactly the viewport area BELOW the sticky `TopBar` (rendered from
    // the root layout). Previously this used `h-[calc(100dvh-61px)]`, which
    // assumed the `TopBar` was always exactly 61px tall. For an unauthenticated/
    // Incognito visitor the `TopBar` is actually shorter (the project dropdown
    // is hidden for the "user" role), so subtracting a fixed 61px left an
    // unsightly blank strip at the bottom of the screen.
    //
    // `SupportLayout` now chains its `<main>` as a `flex flex-col` shell that
    // fills the area below the `TopBar`, so the page can simply use
    // `flex-1 min-h-0` to consume whatever vertical space remains — regardless
    // of the `TopBar`'s actual rendered height. `min-h-0` is required so the
    // nested `overflow-hidden` / `overflow-auto` scrollers (the message thread
    // and the right sidebar) calculate correctly. This keeps:
    //   • the left sidebar non-scrollable with its bottom Incognito profile
    //     always visible,
    //   • only the message thread inside `TicketChat` scrolling, and
    //   • the right sidebar with its own internal scroll when needed,
    // while eliminating the blank space at the bottom.
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <PublicSupportSidebar
        activeTab={TAB_KEY_TO_LABEL[activeTab]}
        onTabChange={(label) => {
          const next = TAB_LABEL_TO_KEY[label]
          if (next) setActiveTab(next)
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "get-support" ? (
          !hasEnteredChat ? (
            <div className="flex-1 flex flex-col px-[72px] pt-[160px]">
              <div className="flex flex-col items-start space-y-6">
                {projectLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={projectLogo}
                    alt={`${projectName} logo`}
                    className="w-20 h-20 rounded-[12px] object-cover border border-[#E1E4EA]"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-[12px] flex items-center justify-center text-2xl font-medium text-foreground border border-[#E1E4EA]"
                    style={{ backgroundColor: brandingData?.primary_color || getAvatarColorHexForId(projectId) }}
                  >
                    {projectName?.[0]?.toUpperCase() || "A"}
                  </div>
                )}
                <h1 className="text-3xl font-normal text-[#444444] text-left">
                  Welcome to the support page for <span className="font-semibold">{projectName}</span>
                </h1>
                <p className="text-base font-medium text-[#444444] text-left">
                  Get help with an issue by an expert validated by {projectName}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleGetSupport}
                    className="bg-[#554abf] hover:bg-[#4a3fa3] text-white cursor-pointer"
                  >
                    Get support
                  </Button>
                  <Button
                    title={ILLUSTRATIVE_BUTTON_TOOLTIP}
                    variant="outline"
                    className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
                  >
                    I have an SLA ID
                  </Button>
                </div>
              </div>
            </div>
          ) : (
          <>
          <TicketChat
            headerTitle={projectName}
            subtitle={`Welcome to the support page for ${projectName}`}
            // Header container background stays white (the Header's default
            // `bg-background`). The project Branding color is no longer applied
            // here per the latest design — the header sits on a plain white
            // background.
            headerLeadingIcon={
              projectLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={projectLogo}
                  alt={`${projectName} logo`}
                  // 1px grey stroke around the project (dp) icon next to the
                  // header — only on this icon, not on any other avatar icon in
                  // the chat.
                  className="w-11 h-11 rounded-[12px] object-cover border border-[#E1E4EA]"
                />
              ) : (
                <div
                  // 1px grey stroke around the project (dp) icon next to the
                  // header — only on this icon, not on any other avatar icon in
                  // the chat.
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center text-base font-medium text-foreground border border-[#E1E4EA]"
                  style={{ backgroundColor: brandingData?.primary_color || getAvatarColorHexForId(projectId) }}
                >
                  {projectName?.[0]?.toUpperCase() || "A"}
                </div>
              )
            }
            showBackButton={false}
            intro={chatIntro}
            messages={chatMessages}
            participants={chatParticipants}
            participantsLoading={participantsLoading}
            message={message}
            onMessageChange={setMessage}
            onSend={handleSendMessage}
            sendDisabled={!message.trim() || createTicket.isPending}
            sending={isSending}
            isEnded={ticketEnded}
            paymentStatus={paymentStatus.status}
            // Signed-out visitors get the composer: the first send starts a
            // guest session. While a guest, a banner above it offers sign-in.
            composerBanner={isGuest ? <GuestBanner redirectTo={guestSignInRedirect} onSignIn={handleGuestSignIn} /> : undefined}
            onStartNewConversation={handleStartNewConversation}
            paymentRequiresSignIn={isGuest}
            onSignInClick={handleGuestSignIn}
            // Nobody but an admin can end a guest ticket: no "End session" for the guest.
            onRequestEndSession={
              ticketId && sessionUserId && !isGuest && !liveTicketIsGuest ? () => handleRequestEndSession(false) : undefined
            }
            onCancelEndSessionRequest={() => handleRequestEndSession(true)}
            endSessionRequestedAt={liveTicket?.end_requested_at ?? null}
            endSessionRequestPending={requestEndSession.isPending}
            timeReviewRequestedAt={liveTicket?.time_review_requested_at ?? null}
            timeEntrySummary={timeEntriesDisplay}
            onConfirmTimeEntries={canConfirmTimeEntries ? handleConfirmTimeEntries : undefined}
            timeEntryConfirmPending={confirmTimeEntries.isPending}
            timeReviewHelperName={claimer?.name ?? null}
            // Before the first message there is no ticket yet: uploads go to the
            // user's own folder (see lib/ticket-attachments).
            attachmentStoragePrefix={sessionUserId && projectId ? `${projectId}/${ticketId || sessionUserId}` : undefined}
            onPaymentCtaClick={handlePaymentCta}
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
          {pendingSca && (
            <ConfirmPaymentModal
              clientSecret={pendingSca.clientSecret}
              mode={project?.sandbox ? "test" : "live"}
              onResolved={() => setHandledScaMessageId(pendingSca.messageId)}
              onCancel={() => setHandledScaMessageId(pendingSca.messageId)}
            />
          )}
          <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
          </>
          )
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className={`max-w-7xl mx-auto py-12 ${activeTab === "rates" ? "px-[72px]" : "px-6"}`}>
              {activeTab === "rates" && (
                <RatesAndDetailsContent
                  projectName={projectName}
                  isFree={isFreeSupport(effectivePricing)}
                  rates={rates}
                  avgResponseSeconds={avgResponseSeconds}
                  avgResponseLoading={avgResponseLoading}
                />
              )}

              {activeTab === "resources" && (
                <ResourcesContent
                  projectName={projectName}
                  resources={resources}
                  resourcesLoading={resourcesLoading}
                />
              )}

              {activeTab === "about" && <AboutSupportContent projectName={projectName} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
