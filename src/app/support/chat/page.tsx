"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { Sidebar } from "@/components/layout/sidebar"
import { TicketChat, type TicketChatMessage, type TicketChatParticipant } from "@/components/ticket-chat/ticket-chat"
import { Check, Info, Search } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useProject, useProjectBySlug, useProjectPaymentSettings, useProjectBranding, useProjects } from "@/hooks/useProject"
import { useCreateTicket } from "@/hooks/useTickets"
import { useTicketMessages, useSendMessage } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useTicketParticipants, useEnsureParticipant, type ParticipantWithUser } from "@/hooks/useTicketParticipants"
import { useTicketWithDetails, useUserActiveTicketsSidebar, useUserTickets } from "@/hooks/useTicketsWithDetails"
import { useTimeEntries, timeMillisecondsToHoursMinutes } from "@/hooks/useTimeEntries"
import { loginUserGoogle } from "@/lib/supabase/auth"
import { supabase } from "@/lib/supabase/client"
import { ensureUserOrganization } from "@/lib/organizations"
import { getAvatarColorHexForId } from "@/lib/constants"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"

interface Message {
  id: string
  sender: "user" | "helper" | "system"
  content: string
  timestamp: string
  avatar?: string
  senderName?: string
  senderId?: string
  codeBlock?: {
    language: string
    code: string
  }
  isSystemMessage?: boolean
}

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
  const [topics] = useState<string[]>([])
  const [helpType] = useState<string[]>([])
  const [projectSearch, setProjectSearch] = useState("")
  /** When user creates ticket without being signed in, first message is not persisted; we show it locally. */
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)

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
  const { data: userTicketsForResolve = [], isLoading: userTicketsLoadingForResolve } =
    useUserTickets(noParams && user?.id ? user.id : undefined)
  const { data: allProjects = [], isLoading: allProjectsLoading } = useProjects({
    enabled: noParams,
  })
  const latestUserTicket = userTicketsForResolve[0]

  // If the user has at least one ticket, redirect to the most recent one so
  // they land on their "last support page" instead of an empty chooser.
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
  const projectName = project?.name ?? "Support"
  const organizationName = hasSLA ? projectName : null
  const freeHelpRemaining: string | null = null
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)

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
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)
  const { data: participants, isLoading: participantsLoading } = useTicketParticipants(ticketId)
  const { data: timeEntriesFromDb = [] } = useTimeEntries(
    ticketId ? { ticketId } : undefined,
    { enabled: !!ticketId }
  )
  const { data: activeTicketsSidebar = [] } = useUserActiveTicketsSidebar(
    user?.id,
    ticketId || undefined,
    3
  )

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

  const claimer = useMemo(
    () => participants?.find((p) => p.claimed)?.user,
    [participants]
  )

  const welcomeMessage: Message = useMemo(
    () => ({
      id: "welcome",
      sender: "system",
      content: hasSLA
        ? `Welcome to ${projectName}'s support chat. You have entered the chat as ${organizationName}.\nAsk your question and someone from our team will try to help you, as soon as we can.`
        : `Welcome to ${projectName}'s support chat.\nAsk your question and someone from our team will try to help you, as soon as we can.`,
      timestamp: new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      senderName: `${projectName} Team`,
    }),
    [hasSLA, projectName, organizationName]
  )

  const messages: Message[] = useMemo(() => {
    const list: Message[] = [welcomeMessage]
    // Show "Ticket is claimed by [helper]" when a participant has claimed (same idea as helper page)
    if (claimer) {
      list.push({
        id: "system-claimed",
        sender: "system",
        content: `Ticket is claimed by ${claimer.name}`,
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
        isSystemMessage: true,
      })
    }
    if (pendingFirstMessage) {
      list.push({
        id: "pending-first",
        sender: "user",
        content: pendingFirstMessage,
        timestamp: new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: user?.avatar || "Y",
        senderName: user?.name || "You",
        senderId: user?.id,
      })
    }
    if (messagesData?.length) {
      messagesData.forEach((msg: { id: string; content: string; created_at: string; sender_type: string; sender_id?: string; sender: { id?: string; name?: string; avatar_url?: string } | null }) => {
        list.push({
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
          avatar: msg.sender?.name?.[0]?.toUpperCase() || (msg.sender_type === "user" ? (user?.name?.[0] || "Y") : "H"),
          senderName: msg.sender?.name || (msg.sender_type === "user" ? (user?.name || "You") : "Helper"),
          senderId: msg.sender_id ?? msg.sender?.id,
        })
      })
    }
    return list
  }, [welcomeMessage, claimer, pendingFirstMessage, messagesData, user?.id, user?.name, user?.avatar])

  // All participants: from tickets_participants, plus ticket creator if not already in (e.g. old tickets)
  const allParticipants: ParticipantWithUser[] = useMemo(() => {
    const list = [...(participants ?? [])]
    const creatorId = existingTicket?.created_by
    const creatorUser = existingTicket?.user
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
  }, [participants, existingTicket?.created_by, existingTicket?.user])

  // Logged time (read-only for user): display entries and total
  const { timeEntriesDisplay, totalLoggedFormatted } = useMemo(() => {
    const entries = timeEntriesFromDb.map((entry) => {
      const { hours, minutes } = timeMillisecondsToHoursMinutes(entry.time_milliseconds)
      return { id: entry.id, type: entry.type, date: entry.date, hours, minutes, note: entry.note ?? undefined }
    })
    const totalMs = timeEntriesFromDb.reduce((sum, e) => sum + e.time_milliseconds, 0)
    const totalMins = Math.floor(totalMs / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`
    return { timeEntriesDisplay: entries, totalLoggedFormatted: formatted }
  }, [timeEntriesFromDb])

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
      <div className="flex h-screen overflow-hidden bg-[#f7f9ff]">
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

  if (ticketIdParam && existingTicketLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f9ff]">
        <div className="text-muted-foreground">Loading ticket…</div>
      </div>
    )
  }

  if (ticketIdParam && !existingTicket?.id) {
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
        const firstMessageContent = message.trim()
        setMessage("")

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
        } else {
          setPendingFirstMessage(firstMessageContent)
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

  const handleSignIn = async () => {
    try {
      // Get current URL with project param to redirect back after auth
      // Pass skipOnboarding=true for support users (they don't need an organization)
      const currentUrl = window.location.href
      await loginUserGoogle(`/auth/confirmed?redirect=${encodeURIComponent(currentUrl)}&skipOnboarding=true`)
    } catch (error) {
      console.error("Sign in error:", error)
    }
  }

  const handleContinueWithoutSignIn = () => {
    // Allow continuing without sign in (for SLA users)
    // This doesn't set authentication, but allows ticket creation
    // The ticket will be created without a created_by user
  }

  const chatMessages: TicketChatMessage[] = messages.map((m) => ({
    id: m.id,
    senderType: m.isSystemMessage ? "system" : m.sender,
    senderName: m.senderName,
    senderAvatarInitial: m.avatar,
    senderAvatarUrl: m.id === "1" && m.sender === "system" ? projectLogo : undefined,
    senderId: m.senderId,
    timestamp: m.timestamp,
    content: m.content,
    kind: m.isSystemMessage ? "claimed" : undefined,
  }))

  const chatParticipants: TicketChatParticipant[] = allParticipants.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    avatarInitial: p.user.name?.[0]?.toUpperCase() ?? "U",
    isCurrentUser: p.participant_id === user?.id,
  }))

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9ff]">
      <Sidebar />

      <TicketChat
        headerTitle={`Ticket with ${projectName}`}
        headerSubtitle={ticketCreated ? `ID: ${ticketId}` : undefined}
        showBackButton={false}
        intro={
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0 overflow-hidden"
              style={{ backgroundColor: getAvatarColorHexForId(effectiveProjectId) }}
            >
              {projectLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={projectLogo}
                  alt={`${projectName} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                projectName?.[0]?.toUpperCase() || "A"
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 550 }}>{projectName} Team</span>
                  <span className="text-xs" style={{ color: '#818185' }}>
                    {new Date().toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{messages[0]?.content}</p>
              </div>

              {hasSLA && freeHelpRemaining && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Time of free help left this month:</span> {freeHelpRemaining}
                  </p>
                </div>
              )}

              <div>
                {!ticketCreated && hasSLA && <h3 className="text-[13px] font-semibold text-foreground mb-3">Help beyond free help</h3>}
                {!ticketCreated && !hasSLA && <h3 className="text-[13px] font-semibold text-foreground mb-3">{projectName}&apos;s rates</h3>}
                <div className="bg-white border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {!ticketCreated && (
                        <tr className="border-b border-border">
                          <td className="px-4 py-3 text-sm text-muted-foreground">Ticket start price</td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">USD {startPrice}</td>
                        </tr>
                      )}
                      <tr className="border-b border-border">
                        <td className="px-4 py-3 text-sm text-muted-foreground">First 60 min</td>
                        <td className="px-4 py-3 text-sm text-foreground text-right">USD {first60Price}/min</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">After 60 min</td>
                        <td className="px-4 py-3 text-sm text-foreground text-right">USD {after60Price}/min</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {isAuthenticated && !ticketCreated && (
                <div className="flex items-center gap-2 text-sm text-brand-primary">
                  <Check className="w-4 h-4" />
                  <span>You are signed in as {user?.name}</span>
                </div>
              )}

              {!isAuthenticated && !ticketCreated && (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleSignIn}
                    variant="outline"
                    className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                  >
                    Sign in with Google
                  </Button>
                  {hasSLA && (
                    <Button
                      onClick={handleContinueWithoutSignIn}
                      variant="outline"
                      className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                    >
                      Continue without signing in
                    </Button>
                  )}
                  <p className="text-xs text-[#868c98] mt-2">
                    You can also start typing your message below to create a ticket. Signing in helps us track your support history.
                  </p>
                </div>
              )}
            </div>
          </div>
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
        isEnded={false}
        attachmentStoragePrefix={ticketId && effectiveProjectId ? `${effectiveProjectId}/${ticketId}` : undefined}
        onImageUploaded={(url) => {
          setMessage((prev) => prev + `\n![attachment](${url})\n`)
        }}
        rightSidebarFooter={
          ticketId ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[13px] text-foreground" style={{ fontWeight: 550 }}>Logged time</h3>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                {timeEntriesDisplay.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {timeEntriesDisplay.map((entry) => (
                      <div key={entry.id} className="py-2 border-b border-border">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">{entry.type === "together" ? "T" : "S"}</span>
                            </div>
                            <span className="text-[13px] text-muted-foreground capitalize">{entry.type}</span>
                          </div>
                          <span className="text-[13px] text-muted-foreground">
                            {String(entry.hours).padStart(2, "0")}:{String(entry.minutes).padStart(2, "0")} h
                          </span>
                        </div>
                        {entry.note && <p className="text-xs text-muted-foreground mt-1 ml-8">{entry.note}</p>}
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 font-medium">
                      <span className="text-[13px] text-foreground">Total</span>
                      <span className="text-[13px] text-foreground">{totalLoggedFormatted}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No time logged yet.</p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border my-6 -ml-5 -mr-4" />

              {/* Active Tickets — latest active tickets for this user */}
              <div>
                <h3 className="text-[13px] text-foreground mb-3" style={{ fontWeight: 550 }}>Active tickets</h3>
                <div className={`-ml-5 -mr-4 ${activeTicketsSidebar.length > 1 ? "max-h-72 overflow-y-auto" : ""}`}>
                  {activeTicketsSidebar.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground px-3">No active tickets</p>
                  ) : (
                    activeTicketsSidebar.map((item) => (
                      <Link
                        key={item.id}
                        href={`/support/chat?ticket=${item.id}`}
                        className={`block w-full border cursor-pointer transition-colors ${
                          item.current
                            ? "bg-brand-primary/10 border-border border-l-4 border-l-brand-primary"
                            : "bg-white border-border hover:bg-muted"
                        }`}
                      >
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0 overflow-hidden"
                              style={{ backgroundColor: getAvatarColorHexForId(item.id) }}
                            >
                              {item.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.avatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.avatarInitial
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <h4 className="font-medium text-foreground text-[13px] truncate">{item.title}</h4>
                                {item.hasNotification && (
                                  <div className="w-2 h-2 bg-[#f09191] rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.subtitle}</p>
                              <p className="text-xs text-muted-foreground">{item.date}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
