"use client"

import type React from "react"
import { useEffect, useMemo, useRef } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, Info, Plus } from "lucide-react"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"

export type TicketChatMessage = {
  id: string
  senderType: "user" | "helper" | "system"
  senderName?: string | null
  senderAvatarInitial?: string | null
  senderAvatarUrl?: string | null
  timestamp: string
  content: string
  kind?: "claimed" | "ended"
}

export type TicketChatParticipant = {
  id: string
  name: string
  avatarInitial: string
  isCurrentUser?: boolean
}

export interface TicketChatProps {
  headerTitle: string
  headerSubtitle?: string
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

  // Right-side extras
  rightSidebarFooter?: React.ReactNode
}

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
    headerSubtitle,
    showBackButton,
    intro,
    messages,
    participants,
    participantsLoading,
    topics = [],
    helpTypes = [],
    message,
    onMessageChange,
    onSend,
    sendDisabled,
    isEnded,
    rightSidebarFooter,
  } = props

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  const thread = useMemo(() => messages ?? [], [messages])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="relative border-b border-border z-10">
        <Header title={headerTitle} subtitle={headerSubtitle} showBackButton={showBackButton} />
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 p-4 flex flex-col min-h-0">
              {/* Chat Messages Container */}
              <div className="bg-white rounded-t-[10px] shadow-[0px_4px_15px_0px_rgba(134,140,152,0.2)] flex-1 overflow-auto">
                <div className="p-4">
                  <div className="max-w-4xl space-y-8">
                    {intro}

                    {/* Chat Messages */}
                    <div className="space-y-6">
                      {thread.map((msg) => (
                        <div key={msg.id} className="flex gap-3">
                          {msg.senderType === "system" && (msg.kind === "claimed" || msg.kind === "ended") ? (
                            <div className="flex items-center gap-3 w-full">
                              <Avatar className="w-8 h-8">
                                {msg.senderAvatarUrl && <AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName || "System"} />}
                                <AvatarFallback className="bg-brand-primary text-white">
                                  {msg.senderAvatarInitial || "M"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-foreground">
                                    {msg.senderName || "System"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                                  <MarkdownContent content={msg.content} className="text-sm text-muted-foreground" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.senderType !== "system" && (
                                <Avatar className="w-8 h-8">
                                  {msg.senderAvatarUrl && <AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName || "User"} />}
                                  <AvatarFallback
                                    className={`text-white text-sm ${
                                      msg.senderType === "helper"
                                        ? "bg-brand-primary"
                                        : "bg-muted text-foreground"
                                    }`}
                                  >
                                    {msg.senderAvatarInitial || "U"}
                                  </AvatarFallback>
                                </Avatar>
                              )}

                              <div className={`flex-1 ${msg.senderType === "system" ? "text-center" : ""}`}>
                                {msg.senderType !== "system" && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-foreground">
                                      {msg.senderName || "Unknown"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                                  </div>
                                )}
                                <div
                                  className={
                                    msg.senderType === "system"
                                      ? "bg-muted text-muted-foreground py-2 px-4 rounded-lg inline-block text-sm"
                                      : "text-sm text-muted-foreground"
                                  }
                                >
                                  <MarkdownContent content={msg.content} />
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

          <TicketChatInput
            value={message}
            onChange={onMessageChange}
            onSend={onSend}
            sendDisabled={sendDisabled}
            placeholder="Message #askanything"
            toolbarEndContent={
              !isEnded ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-foreground font-semibold text-[15px] hover:bg-transparent"
                >
                  End session
                </Button>
              ) : undefined
            }
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-border relative z-20 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-6">
            {/* People in Chat */}
            <div>
              <h3 className="font-medium text-foreground mb-3">People in this chat</h3>

              {participantsLoading ? (
                <div className="text-center text-muted-foreground text-sm py-4">Loading...</div>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback
                          className={`${
                            p.isCurrentUser ? "bg-brand-primary text-white" : "bg-muted text-foreground"
                          } text-xs`}
                        >
                          {p.avatarInitial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">-</div>
              )}

              {!isEnded && (
                <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10">
                  <Plus className="w-4 h-4 mr-2" />
                  Invite other helper
                </Button>
              )}
            </div>

            {/* Other Topics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-medium text-foreground">Other topics in this chat</h3>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>

              {topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">-</div>
              )}
            </div>

            {/* Type of Help */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-medium text-foreground">Type of help</h3>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              {helpTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {helpTypes.map((h) => (
                    <Badge key={h} variant="secondary" className="bg-muted text-muted-foreground">
                      {h}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">-</div>
              )}
            </div>

            {rightSidebarFooter}
          </div>
        </div>
      </main>
    </div>
  )
}


