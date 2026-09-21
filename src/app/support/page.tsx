"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import { useProject, useProjectBySlug, useProjectResources, useProjectBranding, useProjectPaymentSettings } from "@/hooks/useProject"
import { formatTicketRates, isFreeSupport } from "@/lib/ticket-pricing"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
} from "@/lib/customer-chat-messages"
import { useCreateTicket, useRequestEndSession, useTicket } from "@/hooks/useTickets"
import { useCreateCheckoutForTicket } from "@/hooks/useCreateCheckoutForTicket"
import { useRetryTicketPayment } from "@/hooks/useRetryTicketPayment"
import { ConfirmPaymentModal } from "@/components/payment/ConfirmPaymentModal"
import { useSendMessage, useTicketMessages } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useRealtimeTicket } from "@/hooks/useRealtimeTicket"
import { useEnsureParticipant } from "@/hooks/useTicketParticipants"
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ slug?: string }>()

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
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")

  // Get project logo from branding only
  const projectLogo = brandingData?.logo_url || null
  const projectName = project?.name || "Support"

  // Format payment values (convert cents to dollars)
  const { startPrice, first60Price, after60Price } = formatTicketRates(paymentSettings)

  // Transform resources data
  const resources = resourcesData || []

  // Chat state for the "get-support" tab — mirrors src/app/support/chat/page.tsx
  const [message, setMessage] = useState("")
  const [ticketCreated, setTicketCreated] = useState(false)
  const [ticketId, setTicketId] = useState("")
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)

  const createTicket = useCreateTicket()
  const createCheckout = useCreateCheckoutForTicket()
  const retryPayment = useRetryTicketPayment()
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)
  useRealtimeTicket(ticketId)
  const { data: liveTicket } = useTicket(ticketId)

  const isAuthenticated = !!user?.id

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
  } = useCustomerTicketSidebar(ticketId || undefined, user?.id)
  const chatParticipants: TicketChatParticipant[] = toChatParticipants(participants, user?.id)

  // Customer "End session" = ask the helper to finalise (see useRequestEndSession).
  const requestEndSession = useRequestEndSession()
  const handleRequestEndSession = async (cancel: boolean) => {
    if (!ticketId || !user?.id) return
    try {
      await requestEndSession.mutateAsync({ ticketId, userId: user.id, cancel })
      toast.success(cancel ? "End request cancelled." : "The helper has been notified.")
    } catch (error) {
      console.error("Failed to update end-session request:", error)
      toast.error(cancel ? "Couldn't cancel the request. Please try again." : "Couldn't notify the helper. Please try again.")
    }
  }
  const ticketEnded = liveTicket?.status === "completed" || liveTicket?.status === "cancelled"
  const paymentStatus = useTicketPaymentStatus(ticketId || null, { isFree: isFreeSupport(paymentSettings) })

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
      currentUser: { id: user?.id, name: user?.name, avatarUrl: user?.avatarUrl },
    })
    if (ticketEnded) {
      const cancelled = liveTicket?.status === "cancelled"
      list.push(
        buildSessionEndedMessage({
          cancelled,
          totalLoggedFormatted,
          chargedLine: describeChargedLine({
            cancelled,
            slaCovered: false,
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
    ticketEnded,
    totalLoggedFormatted,
    paymentStatus.status,
    paymentStatus.capturedAmountSmallestUnit,
    paymentStatus.failureReason,
    user?.id,
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
      toast.error("Couldn't open Stripe Checkout. Please try again.")
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    if (!ticketCreated && projectId) {
      try {
        const ticket = await createTicket.mutateAsync({
          project_id: projectId,
          title: stripTicketAttachments(message).substring(0, 100) || "Support Request",
          description: message,
          created_by: user?.id || null,
          status: "available",
          priority: "medium",
        })

        setTicketCreated(true)
        setTicketId(ticket.id)
        const firstMessageContent = await prepareOutgoingMessage(message)
        setMessage("")
        // Show the question immediately; hidden once the persisted message arrives.
        setPendingFirstMessage(firstMessageContent)

        if (user?.id) {
          await ensureParticipant.mutateAsync({
            ticketId: ticket.id,
            participantId: user.id,
            claimed: false,
          })
          await sendMessage.mutateAsync({
            ticket_id: ticket.id,
            sender_id: user.id,
            sender_type: "user",
            content: firstMessageContent,
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
          .then(() => {})
          .catch(() => {})
      } catch (error) {
        console.error("Failed to create ticket:", error)
        return
      }
      return
    }

    if (!ticketId || !user?.id) return
    try {
      await sendMessage.mutateAsync({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: "user",
        content: await prepareOutgoingMessage(message),
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  // Sign-in options open in a modal so the visitor keeps the page (and its
  // project context in the URL); the modal redirects back here after auth.
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const handleSignIn = () => setIsSignInModalOpen(true)

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
              <Link href="/signin">Sign in</Link>
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
      rates={{ startPrice, first60Price, after60Price }}
      isFree={isFreeSupport(paymentSettings)}
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
            isEnded={ticketEnded}
            onRequestEndSession={ticketId && user?.id ? () => handleRequestEndSession(false) : undefined}
            onCancelEndSessionRequest={() => handleRequestEndSession(true)}
            endSessionRequestedAt={liveTicket?.end_requested_at ?? null}
            endSessionRequestPending={requestEndSession.isPending}
            // Before the first message there is no ticket yet: uploads go to the
            // user's own folder (see lib/ticket-attachments).
            attachmentStoragePrefix={user?.id && projectId ? `${projectId}/${ticketId || user.id}` : undefined}
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
                  isFree={isFreeSupport(paymentSettings)}
                  startPrice={startPrice}
                  first60Price={first60Price}
                  after60Price={after60Price}
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
