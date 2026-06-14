"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Clock, Target, HelpCircle, Check } from "lucide-react"
import Link from "next/link"
import { useProject, useProjectBySlug, useProjectResources, useProjectBranding, useProjectPaymentSettings } from "@/hooks/useProject"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useParams, useSearchParams } from "next/navigation"
import { PublicSupportSidebar } from "@/components/layout/public-support-sidebar"
import { TicketChat, type TicketChatMessage } from "@/components/ticket-chat/ticket-chat"
import { useCreateTicket } from "@/hooks/useTickets"
import { useSendMessage, useTicketMessages } from "@/hooks/useTicketMessages"
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages"
import { useEnsureParticipant } from "@/hooks/useTicketParticipants"
import { loginUserGoogle } from "@/lib/supabase/auth"
import { supabase } from "@/lib/supabase/client"
import { getAvatarColorHexForId } from "@/lib/constants"

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
  const [searchQuery, setSearchQuery] = useState("")
  const { user, setProjectRole } = useUser()
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
  const startPrice = paymentSettings?.ticket_start_price ? (paymentSettings.ticket_start_price / 100).toFixed(2) : "10.00"
  const first60Price = paymentSettings?.ticket_price_minute_first_60 ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) : "1.50"
  const after60Price = paymentSettings?.ticket_price_minute_after_60 ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2) : "1.00"

  // Transform resources data
  const resources = resourcesData || []

  // Chat state for the "get-support" tab — mirrors src/app/support/chat/page.tsx
  const [message, setMessage] = useState("")
  const [ticketCreated, setTicketCreated] = useState(false)
  const [ticketId, setTicketId] = useState("")
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null)

  const createTicket = useCreateTicket()
  const sendMessage = useSendMessage()
  const ensureParticipant = useEnsureParticipant()
  const { data: messagesData } = useTicketMessages(ticketId)
  useRealtimeMessages(ticketId)

  const isAuthenticated = !!user?.id

  // Welcome message used as the prose copy in the intro block.
  const welcomeMessageContent = useMemo(
    () =>
      `Welcome to ${projectName}'s support chat.\nAsk your question and someone from our team will try to help you, as soon as we can.`,
    [projectName],
  )

  // Disclaimer text rendered inside the grey (muted) container at the top of
  // the chat thread — the first system message a visitor sees in the chat
  // window. Keeps the visitor informed that they're not charged before the
  // ticket is confirmed by both parties.
  const ticketDisclaimerContent =
    "You are not charged anything before both you and the helper have confirmed the ticket. Feel free to chat and clarify details before you confirm."

  const nowFormatted = useMemo(
    () =>
      new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  )

  const chatMessages: TicketChatMessage[] = useMemo(() => {
    const list: TicketChatMessage[] = [
      {
        id: "welcome",
        senderType: "system",
        content: ticketDisclaimerContent,
        senderName: `${projectName} Team`,
        senderAvatarUrl: projectLogo,
        timestamp: nowFormatted,
      },
    ]

    if (pendingFirstMessage) {
      list.push({
        id: "pending-first",
        senderType: "user",
        content: pendingFirstMessage,
        senderName: user?.name || "You",
        senderAvatarInitial: user?.name?.[0]?.toUpperCase() || "Y",
        senderId: user?.id,
        timestamp: nowFormatted,
      })
    }

    if (messagesData?.length) {
      messagesData.forEach(
        (msg: {
          id: string
          content: string
          created_at: string
          sender_type: string
          sender_id?: string
          sender: { id?: string; name?: string; avatar_url?: string } | null
        }) => {
          const senderType: TicketChatMessage["senderType"] =
            msg.sender_type === "user" ? "user" : msg.sender_type === "helper" ? "helper" : "system"
          list.push({
            id: msg.id,
            senderType,
            content: msg.content,
            senderName:
              msg.sender?.name ||
              (senderType === "user" ? user?.name || "You" : senderType === "helper" ? "Helper" : `${projectName} Team`),
            senderAvatarInitial:
              msg.sender?.name?.[0]?.toUpperCase() ||
              (senderType === "user" ? user?.name?.[0]?.toUpperCase() || "Y" : "H"),
            senderId: msg.sender_id ?? msg.sender?.id,
            timestamp: new Date(msg.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        },
      )
    }

    return list
  }, [
    ticketDisclaimerContent,
    projectName,
    projectLogo,
    nowFormatted,
    pendingFirstMessage,
    messagesData,
    user?.id,
    user?.name,
  ])

  const handleSendMessage = async () => {
    if (!message.trim()) return

    if (!ticketCreated && projectId) {
      try {
        const ticket = await createTicket.mutateAsync({
          project_id: projectId,
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
        content: message.trim(),
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleSignIn = async () => {
    try {
      const currentUrl = window.location.href
      await loginUserGoogle(`/auth/confirmed?redirect=${encodeURIComponent(currentUrl)}&skipOnboarding=true`)
    } catch (error) {
      console.error("Sign in error:", error)
    }
  }

  const faqs = [
    {
      question: "Who will I get help from?",
      answer:
        "You'll be connected with validated experts from our community who have proven experience in your specific area of need.",
    },
    {
      question: "How long will it take before someone will help me?",
      answer:
        "Response times vary based on your SLA agreement. Typically, you can expect a response within 1-4 hours during business hours.",
    },
    {
      question: "My employer will pay for the service. How do I facilitate that?",
      answer:
        "You can set up an SLA agreement with your employer. Contact us to arrange corporate billing and payment terms.",
    },
    {
      question: "How does the process work, from me reaching out to me getting help?",
      answer:
        "Simply submit your request, get matched with an expert, communicate through our platform, and receive help in real-time or asynchronously.",
    },
    {
      question: "How much will I pay?",
      answer:
        "Pricing depends on the complexity of your issue and response time requirements. Check our Rates and details tab for more information.",
    },
  ]

  const filteredFaqs = faqs.filter((faq) => faq.question.toLowerCase().includes(searchQuery.toLowerCase()))

  const supportAreas = [
    "Problems",
    "Bugs",
    "Dependencies",
    "Breaking changes",
    "Best practices",
    "Mentoring",
    "Code reviews",
    "Documentation",
  ]

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
    <div className="flex gap-3">
      {projectLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={projectLogo}
          alt={`${projectName} logo`}
          className="w-8 h-8 rounded-[11px] object-cover shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
          style={{ backgroundColor: getAvatarColorHexForId(projectId) }}
        >
          {projectName?.[0]?.toUpperCase() || "A"}
        </div>
      )}
      <div className="flex-1 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm" style={{ color: "#2E2D31", fontWeight: 550 }}>
              {projectName} Team
            </span>
            <span
              className="text-xs"
              style={{
                color: 'rgba(0,0,0,0.5)',
                fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {nowFormatted}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{welcomeMessageContent}</p>
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Rates</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">Start price</p>
              <p className="text-sm font-medium text-foreground">USD {startPrice}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
              <p className="text-sm font-medium text-foreground">USD {first60Price}/min</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
              <p className="text-sm font-medium text-foreground">USD {after60Price}/min</p>
            </div>
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
            <p className="text-xs text-[#868c98] mt-2">
              You can also start typing your message below to create a ticket. Signing in helps us track your support history.
            </p>
          </div>
        )}
      </div>
    </div>
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
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="flex flex-col items-center space-y-6">
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
                    style={{ backgroundColor: getAvatarColorHexForId(projectId) }}
                  >
                    {projectName?.[0]?.toUpperCase() || "A"}
                  </div>
                )}
                <h1 className="text-3xl font-normal text-[#444444] text-center">
                  Welcome to the support page for <span className="font-semibold">{projectName}</span>
                </h1>
                <p className="text-base font-medium text-[#444444] text-center">
                  Get help with an issue by an expert validated by {projectName}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setHasEnteredChat(true)}
                    className="bg-[#554abf] hover:bg-[#4a3fa3] text-white cursor-pointer"
                  >
                    Get support
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
                  >
                    I have an SLA ID
                  </Button>
                </div>
              </div>
            </div>
          ) : (
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
                  style={{ backgroundColor: getAvatarColorHexForId(projectId) }}
                >
                  {projectName?.[0]?.toUpperCase() || "A"}
                </div>
              )
            }
            showBackButton={false}
            intro={chatIntro}
            messages={chatMessages}
            message={message}
            onMessageChange={setMessage}
            onSend={handleSendMessage}
            sendDisabled={!message.trim() || createTicket.isPending}
            isEnded={false}
            attachmentStoragePrefix={ticketId && projectId ? `${projectId}/${ticketId}` : undefined}
            onImageUploaded={(url) => {
              setMessage((prev) => prev + `\n![attachment](${url})\n`)
            }}
          />
          )
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className={`max-w-7xl mx-auto py-12 ${activeTab === "rates" ? "px-[72px]" : "px-6"}`}>
              {activeTab === "rates" && (
                <div className="space-y-12">
                  {/* Rates section */}
                  <div>
                    <h2 className="text-[22px] font-normal text-[#444444] mb-8">{projectName}&apos;s rates</h2>

                    {/* Pricing cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-[18px] mb-12">
                      {/* Ticket start price */}
                      <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
                        <div className="bg-gradient-to-br from-[#c5b0ef] to-[#b8a0e8] px-6 py-4 text-center">
                          <div className="text-lg font-semibold text-[#2d2a49]">{startPrice} USD</div>
                        </div>
                        <div className="bg-white p-6 flex-1">
                          <h3 className="text-[14px] font-semibold text-[#444444] mb-2">Ticket start price</h3>
                          <p className="text-sm text-[#868c98]">
                            Price for starting the support. You will of course not pay anything if your ticket isn&apos;t picked up.
                          </p>
                        </div>
                      </div>

                      {/* First 60 minutes */}
                      <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
                        <div className="bg-gradient-to-br from-[#e7e5fd] to-[#d8d4f7] px-6 py-4 text-center">
                          <div className="text-lg font-semibold text-[#2d2a49]">{first60Price} USD/min</div>
                        </div>
                        <div className="bg-white p-6 flex-1">
                          <h3 className="text-[14px] font-semibold text-[#444444] mb-2">First 60 minutes</h3>
                          <p className="text-sm text-[#868c98]">
                            This is the price per minute for the first 60 minutes. Most issues are solved within that time.
                          </p>
                        </div>
                      </div>

                      {/* After 60 minutes */}
                      <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
                        <div className="bg-gradient-to-br from-[#f9f7ff] to-[#f0ecff] px-6 py-4 text-center">
                          <div className="text-lg font-semibold text-[#2d2a49]">{after60Price} USD/min</div>
                        </div>
                        <div className="bg-white p-6 flex-1">
                          <h3 className="text-[14px] font-semibold text-[#444444] mb-2">After 60 minutes</h3>
                          <p className="text-sm text-[#868c98]">
                            If the support is lengthy, the price drops to {after60Price} USD per minute after the first hour.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Info cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-[18px] mb-8">
                      {/* Average response time */}
                      <div className="bg-white rounded-lg p-6 shadow-none border border-[#E1E1E1]">
                        <Clock className="h-5 w-5 text-[#444444] mb-2" />
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-[14px] font-semibold text-[#444444]">Average response time</h3>
                          <HelpCircle className="h-4 w-4 text-[#868c98]" />
                        </div>
                        <p className="text-lg font-semibold text-[#2d2a49]">6 minutes</p>
                      </div>

                      {/* Core team support */}
                      <div className="bg-white rounded-lg p-6 shadow-none border border-[#E1E1E1]">
                        <Target className="h-5 w-5 text-[#444444] mb-2" />
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-[14px] font-semibold text-[#444444]">Core team support</h3>
                          <HelpCircle className="h-4 w-4 text-[#868c98]" />
                        </div>
                        <p className="text-lg font-semibold text-[#2d2a49]">Yes</p>
                      </div>
                    </div>

                    {/* Get an SLA button */}
                    <div className="flex items-start gap-2">
                      <Button
                        variant="outline"
                        className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
                      >
                        Get an SLA
                      </Button>
                      <HelpCircle className="h-4 w-4 text-[#868c98]" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "resources" && (
                <div className="space-y-8">
                  <h2 className="text-[22px] font-normal text-[#444444] mb-8">{projectName}&apos;s resources</h2>

                  {resourcesLoading ? (
                    <p className="text-[#868c98]">Loading resources...</p>
                  ) : resources.length === 0 ? (
                    <p className="text-[#868c98]">No resources available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {resources.map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center h-8 px-6 text-sm bg-gradient-to-r from-[#c5b0ef] to-[#b8a0e8] text-[#2d2a49] rounded-md font-medium hover:from-[#b8a0e8] hover:to-[#ab90e0] transition-all cursor-pointer shadow-sm hover:shadow-md"
                        >
                          {resource.name}
                        </a>
                      ))}
                    </div>
                  )}

                  <Card className="max-w-3xl border-[#E1E1E1] shadow-none rounded-lg">
                    <CardContent className="p-0">
                      <div className="px-6 py-6">
                        <h3 className="text-sm font-semibold text-[#444444] mb-6">Do you have any questions on how support works?</h3>

                        {/* Search input */}
                        <div className="relative mb-6">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868c98]" />
                          <Input
                            type="text"
                            placeholder="Search FAQs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-gray-200"
                          />
                        </div>
                      </div>

                      {/* FAQ Accordion */}
                      <Accordion type="single" collapsible className="w-full">
                        {filteredFaqs.map((faq, index) => (
                          <AccordionItem key={index} value={`item-${index}`} className="px-6">
                            <AccordionTrigger className="text-foreground hover:no-underline hover:text-brand-primary">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>

                      {filteredFaqs.length === 0 && (
                        <p className="text-center text-sm text-[#868c98] py-8">No FAQs found matching your search.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "about" && (
                <div className="space-y-16">
                  {/* How support works section */}
                  <div className="max-w-[37rem]">
                    <h2 className="text-[22px] font-normal text-[#444444] mb-6">How support works</h2>
                    <p className="text-sm text-[#444444] mb-4">
                      The <span className="font-semibold">{projectName}</span> team can help out with issues related to areas such
                      as:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {supportAreas.map((area) => (
                        <span
                          key={area}
                          className="px-4 py-2 border border-[#554abf] text-[#554abf] rounded-md text-sm"
                          style={{ fontFamily: 'Cousine, monospace' }}
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Get started section */}
                  <div>
                    <h2 className="text-xl font-normal text-[#444444] mb-6">Get started</h2>
                    <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
                      <div className="space-y-0 max-w-[36rem]">
                        {/* Step 1 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                            <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                          </div>
                          <div className="flex-1 pb-8">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Choose how to get help</h3>
                            <p className="text-sm text-[#868c98]">
                              You can get help through standard support or through an SLA. Getting help through an SLA requires
                              no registration, if accepted by your employer.
                            </p>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Register or share details</h3>
                            <p className="text-sm text-[#868c98]">
                              Register an account or share your email and card details before getting started. Registration only
                              takes a couple of minutes.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Receive help section */}
                  <div>
                    <h2 className="text-xl font-normal text-[#444444] mb-6">Receive help</h2>
                    <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
                      <div className="space-y-0 max-w-[36rem]">
                        {/* Step 1 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                            <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                          </div>
                          <div className="flex-1 pb-8">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Wait for a helper to connect</h3>
                            <p className="text-sm text-[#868c98]">
                              How long it takes varies. Looking into &quot;Rates and details&quot; will give you an idea about average
                              waiting time. The helper is normally someone on the core team of the project.
                            </p>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                            <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                          </div>
                          <div className="flex-1 pb-8">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Start chatting</h3>
                            <p className="text-sm text-[#868c98]">
                              Describe your issue, in text or by sharing code, and get help. If the helper can&apos;t help you, you
                              are normally not charged anything.
                            </p>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Issue is solved</h3>
                            <p className="text-sm text-[#868c98]">
                              When you are pleased with the assistance, the chat is ended, and time spent is logged by the
                              helper.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment and reports section */}
                  <div>
                    <h2 className="text-xl font-normal text-[#444444] mb-6">Payment and reports</h2>
                    <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
                      <div className="space-y-0 max-w-[36rem]">
                        {/* Step 1 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                            <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                          </div>
                          <div className="flex-1 pb-8">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Choose how to pay</h3>
                            <p className="text-sm text-[#868c98]">
                              If you are using support both privately and through your employer, you are asked to specify who
                              you want the support charged to. The amount is charged to your card.
                            </p>
                            <p className="text-sm text-[#868c98] mt-2">
                              Payment is then made to the helper, with a commission also going to the project you are getting
                              support with. In this case <span className="font-semibold">{projectName}</span>.
                            </p>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-[#444444] mb-2">Receive documentation</h3>
                            <p className="text-sm text-[#868c98]">
                              You will receive a report via cards or email, showing payment and support details. If you are
                              registered, you can also retrieve any support documentation from the Github user login page.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
