"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { Sidebar } from "@/components/layout/sidebar"
import { TicketChat, type TicketChatMessage, type TicketChatParticipant } from "@/components/ticket-chat/ticket-chat"
import { Search } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useProject, useProjectBySlug, useProjectPaymentSettings, useProjectBranding, useProjects } from "@/hooks/useProject"
import { useCreateTicket, useRequestEndSession } from "@/hooks/useTickets"
import { useCreateCheckoutForTicket } from "@/hooks/useCreateCheckoutForTicket"
import { ConfirmPaymentModal } from "@/components/payment/ConfirmPaymentModal"
import { useTicketMessages, useSendMessage } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useRealtimeTicket } from "@/hooks/useRealtimeTicket"
import { useEnsureParticipant } from "@/hooks/useTicketParticipants"
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
} from "@/lib/customer-chat-messages"
import { useTicketPaymentStatus } from "@/hooks/useTicketPaymentStatus"
import { SignInModal } from "@/components/modals/sign-in-modal"
import { supabase } from "@/lib/supabase/client"
import { ensureUserOrganization } from "@/lib/organizations"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"

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
  const router = useRouter()
  const { user, setProjectRole } = useUser()
  const [message, setMessage] = useState("")
  const [ticketCreated, setTicketCreated] = useState(false)
  const [ticketId, setTicketId] = useState("")
  /** Ticket created in this session (signed-in flow pushes it into the URL). */
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)
  const [topics] = useState<string[]>([])
  const [helpType] = useState<string[]>([])
  const [projectSearch, setProjectSearch] = useState("")
  // Sign-in options open in a modal so the visitor keeps the page (and its
  // project context in the URL); the modal redirects back here after auth.
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  /** When user creates ticket without being signed in, first message is not persisted; we show it locally. */
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)
  /** SCA prompt (payment_requires_action) already resolved or dismissed in this session. */
  const [handledScaMessageId, setHandledScaMessageId] = useState<string | null>(null)

  // Get project_id and optional existing ticket from query params
  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const ticketIdParam = searchParams.get("ticket")
  const slaId = searchParams.get("sla")
  const hasSLA = !!slaId
  const noParams = !hasSLA && !projectIdParam && !slugParam && !ticketIdParam

  // When the page is opened without any context (e.g. clicking "Support" in
  // the sidebar), we need to either send the user to their last ticket or let
  // them pick a project to get support from. These hooks only fetch when
  // `noParams` is true so they don't run on the normal chat flow.
  const { data: latestUserTicket, isLoading: userTicketsLoadingForResolve } =
    useLatestUserActiveTicket(noParams && user?.id ? user.id : undefined)
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
  const projectPageHref = project?.slug
    ? `/support/${encodeURIComponent(project.slug)}`
    : effectiveProjectId
      ? `/support?project=${encodeURIComponent(effectiveProjectId)}`
      : undefined
  const projectName = project?.name ?? "Support"
  const organizationName = hasSLA ? projectName : null
  const freeHelpRemaining: string | null = null
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)

  // Ticket-ended summary for the customer: reflect that the helper closed the
  // session and what was charged. Payment status is realtime so the amount
  // settles from "Processing…" to the captured value without a reload.
  const ticketEnded =
    existingTicket?.status === "completed" || existingTicket?.status === "cancelled"
  const paymentStatus = useTicketPaymentStatus(existingTicket?.id ?? null, { slaId })

  // "End session" from the customer only signals intent: the helper logs any
  // remaining time and ends from their side. Until then the customer can keep
  // chatting or withdraw the request. Realtime on the ticket row keeps
  // `end_requested_at` fresh on both ends.
  const requestEndSession = useRequestEndSession()
  const endSessionRequestedAt = existingTicket?.end_requested_at ?? null
  const handleRequestEndSession = async (cancel: boolean) => {
    if (!existingTicket?.id || !user?.id) return
    try {
      await requestEndSession.mutateAsync({ ticketId: existingTicket.id, userId: user.id, cancel })
      toast.success(cancel ? "End request cancelled." : "The helper has been notified.")
    } catch (error) {
      console.error("Failed to update end-session request:", error)
      toast.error(cancel ? "Couldn't cancel the request. Please try again." : "Couldn't notify the helper. Please try again.")
    }
  }

  // When opening an existing ticket from URL, set ticket state
  useEffect(() => {
    if (ticketIdParam && existingTicket?.id) {
      setTicketId(existingTicket.id)
      setTicketCreated(true)
    }
  }, [ticketIdParam, existingTicket?.id])
  
  // Get user's role in this project
  const { data: projectRole } = useProjectRole(projectId || undefined)
  
  // Check if user is a support user (has "user" role preference from localStorage)
  const isSupportUser = typeof window !== "undefined" && localStorage.getItem("userRole") === "user"
  
  // Update user context with project role
  // Support users don't get a projectRole - they're users of support, not project members
  useEffect(() => {
    if (isSupportUser) {
      // Support users should not have a projectRole set
      setProjectRole(null)
    } else if (projectId && projectRole) {
      setProjectRole(projectRole)
    } else if (!projectId) {
      setProjectRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectRole, isSupportUser])

  // Check authentication state on mount (must run before any conditional return)
  useEffect(() => {
    const checkAuth = async () => {
      await supabase.auth.getSession()
      // User context updates when session changes; this runs the check on mount.
    }
    checkAuth()
  }, [])

  // Fetch payment settings
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")
  
  // Fetch branding for project logo
  const { data: brandingData } = useProjectBranding(projectId || "")
  const projectLogo = brandingData?.logo_url || null
  
  // Format payment values (convert cents to dollars)
  const startPrice = paymentSettings?.ticket_start_price ? (paymentSettings.ticket_start_price / 100).toFixed(2) : "10.00"
  const first60Price = paymentSettings?.ticket_price_minute_first_60 ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) : "1.50"
  const after60Price = paymentSettings?.ticket_price_minute_after_60 ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2) : "1.00"

  // Ticket creation and messaging
  const createTicket = useCreateTicket()
  const createCheckout = useCreateCheckoutForTicket()
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)
  useRealtimeTicket(ticketId)
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
  } = useCustomerTicketSidebar(ticketId || undefined, user?.id)

  // Check if user is authenticated (has an id)
  const isAuthenticated = !!user?.id

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

  const welcomeText = hasSLA
    ? `Welcome to ${projectName}'s support chat. You have entered the chat as ${organizationName}.\nAsk your question and someone from our team will try to help you, as soon as we can.`
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
      currentUser: { id: user?.id, name: user?.name, avatarUrl: user?.avatarUrl },
    })
    if (ticketEnded) {
      const cancelled = existingTicket?.status === "cancelled"
      list.push(
        buildSessionEndedMessage({
          cancelled,
          totalLoggedFormatted,
          chargedLine: describeChargedLine({
            cancelled,
            slaCovered: !!slaId,
            paymentStatus: paymentStatus.status,
            capturedAmountSmallestUnit: paymentStatus.capturedAmountSmallestUnit,
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
    ticketEnded,
    totalLoggedFormatted,
    slaId,
    paymentStatus.status,
    paymentStatus.capturedAmountSmallestUnit,
    user?.id,
    user?.name,
    user?.avatarUrl,
  ])

  // Off-session hold that landed in requires_action (SCA) → ConfirmPaymentModal.
  // Derived from the thread; `handledScaMessageId` stops a handled prompt reopening.
  const pendingSca = useMemo(
    () => findPendingSca(chatMessages, handledScaMessageId),
    [chatMessages, handledScaMessageId],
  )

  if (noParams) {
    // While we look up the user's latest ticket, show a small loading state.
    // The redirect to that ticket is handled by the effect above.
    const resolving =
      (isAuthenticated && userTicketsLoadingForResolve) || !!latestUserTicket
    if (resolving) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#f7f9ff]">
          <div className="text-muted-foreground">Loading your support…</div>
        </div>
      )
    }

    // No tickets (or not signed in) → let the user pick a project to get
    // support from.
    const filteredProjects = allProjects.filter((p) =>
      p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()),
    )

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-[#f7f9ff]">
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

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            <div className="bg-white rounded-lg border border-border overflow-hidden">
              {allProjectsLoading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading projects…
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No projects match &ldquo;{projectSearch}&rdquo;.
                </div>
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
      </div>
    )
  }

  // A ticket created in this session is already on screen; don't swap it for
  // the loading/not-found screens while its ?ticket= lookup catches up.
  const openingOtherTicket = !!ticketIdParam && ticketIdParam !== createdTicketId
  if (openingOtherTicket && existingTicketLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f9ff]">
        <div className="text-muted-foreground">Loading ticket…</div>
      </div>
    )
  }

  if (openingOtherTicket && !existingTicket?.id) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Ticket not found</h1>
          <p className="text-muted-foreground">
            This ticket may have been removed or you may not have access to it.
          </p>
        </div>
      </div>
    )
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    if (!ticketCreated && effectiveProjectId) {
      try {
        const ticket = await createTicket.mutateAsync({
          project_id: effectiveProjectId,
          title: message.substring(0, 100) || "Support Request",
          description: message,
          created_by: user?.id || null,
          status: "available",
          priority: "medium",
        })

        setTicketCreated(true)
        setTicketId(ticket.id)
        setCreatedTicketId(ticket.id)
        const firstMessageContent = message.trim()
        setMessage("")
        // Show the question immediately; it's replaced by the persisted
        // message once the messages query includes it.
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

          // Put the new ticket in the URL so the page behaves exactly like a
          // reopened ticket from here on (ticket details, claimed banner,
          // end-of-session summary all key off `?ticket=`). Signed-in users
          // only: an anonymous creator (created_by = null) can't read the row
          // back under RLS, so for them the lookup would land on "Ticket not
          // found" — they keep the in-memory ticket instead.
          const params = new URLSearchParams(searchParams.toString())
          params.set("ticket", ticket.id)
          params.set("project", effectiveProjectId)
          router.replace(`/support/chat?${params.toString()}`)
        }

        supabase.functions.invoke("classify-ticket", {
          body: {
            ticket_id: ticket.id,
            project_id: effectiveProjectId,
            title: ticket.title,
            description: ticket.description ?? firstMessageContent,
          },
        }).then(() => {}).catch(() => {})
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
        content: message.trim(),
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleSignIn = () => setIsSignInModalOpen(true)

  const handleContinueWithoutSignIn = () => {
    // Allow continuing without sign in (for SLA users)
    // This doesn't set authentication, but allows ticket creation
    // The ticket will be created without a created_by user
  }

  // "People in this chat": tickets_participants, plus the ticket creator if
  // they have no participant row (e.g. old tickets).
  const creatorUser = existingTicket?.user as { name?: string; avatar_url?: string | null } | null | undefined
  const chatParticipants: TicketChatParticipant[] = toChatParticipants(
    participants,
    user?.id,
    existingTicket?.created_by && creatorUser
      ? { id: existingTicket.created_by, name: creatorUser.name, avatar_url: creatorUser.avatar_url }
      : null,
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <Sidebar projectPageHref={projectPageHref} />

      <TicketChat
        headerTitle={`Ticket with ${projectName}`}
        headerSubtitle={ticketCreated ? `ID: ${ticketId}` : undefined}
        showBackButton={false}
        intro={
          <CustomerChatIntro
            projectId={effectiveProjectId}
            projectName={projectName}
            projectLogo={projectLogo}
            welcomeText={welcomeText}
            timestamp={nowFormatted}
            rates={{ startPrice, first60Price, after60Price }}
            isAuthenticated={isAuthenticated}
            ticketCreated={ticketCreated}
            userName={user?.name}
            onSignIn={handleSignIn}
            signedOutExtra={
              hasSLA ? (
                <Button
                  onClick={handleContinueWithoutSignIn}
                  variant="outline"
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                >
                  Continue without signing in
                </Button>
              ) : undefined
            }
          >
            {hasSLA && freeHelpRemaining && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Time of free help left this month:</span> {freeHelpRemaining}
                </p>
              </div>
            )}
          </CustomerChatIntro>
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
        isEnded={ticketEnded}
        onRequestEndSession={
          existingTicket?.id && user?.id ? () => handleRequestEndSession(false) : undefined
        }
        onCancelEndSessionRequest={() => handleRequestEndSession(true)}
        endSessionRequestedAt={endSessionRequestedAt}
        endSessionRequestPending={requestEndSession.isPending}
        attachmentStoragePrefix={ticketId && effectiveProjectId ? `${effectiveProjectId}/${ticketId}` : undefined}
        onImageUploaded={(url) => {
          setMessage((prev) => prev + `\n![attachment](${url})\n`)
        }}
        onPaymentCtaClick={async (msg) => {
          const metaTicketId = msg.paymentMetadata?.ticket_id as string | undefined
          const target = metaTicketId || ticketId
          if (!target) return
          try {
            const out = await createCheckout.mutateAsync({ ticketId: target })
            window.location.assign(out.checkoutUrl)
          } catch (err) {
            console.error("Failed to start Stripe Checkout:", err)
          }
        }}
        paymentCtaLoading={createCheckout.isPending}
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
    </div>
  )
}
