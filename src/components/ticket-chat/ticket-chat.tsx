"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Info, Plus } from "lucide-react"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { getAvatarColorHexForId } from "@/lib/constants"

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

  /**
   * When provided, enables the image attachment button in the chat toolbar.
   * Format: "{projectId}/{ticketId}" — used as the storage path prefix under the ticket-attachments bucket.
   */
  attachmentStoragePrefix?: string
  /** Called after a successful image upload with the resolved URL */
  onImageUploaded?: (url: string) => void

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
    attachmentStoragePrefix,
    onImageUploaded,
    rightSidebarFooter,
  } = props

  const [imageUploadOpen, setImageUploadOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  const thread = useMemo(() => messages ?? [], [messages])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="relative border-b border-border z-10">
        <Header
          title={headerTitle}
          showBackButton={showBackButton}
          inlineRightContent={
            headerSubtitle ? (
              <span className="text-[13px] font-normal font-mono tabular-nums text-muted-foreground/80">{headerSubtitle}</span>
            ) : undefined
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
                <div className="px-6 py-5">
                  <div className="flex flex-col" style={{ rowGap: '31.2px' }}>
                    {intro}

                    {/* Chat Messages */}
                    <div className="flex flex-col" style={{ rowGap: '16px' }}>
                      {thread.map((msg) => (
                        <div key={msg.id} className="flex gap-3 items-start">
                          {msg.senderType === "system" && (msg.kind === "claimed" || msg.kind === "ended") ? (
                            <div className="flex items-start gap-3 w-full">
                              <div
                                className="w-7 h-7 rounded-[9.625px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                                style={{ backgroundColor: getAvatarColorHexForId(msg.senderId) }}
                              >
                                {msg.senderAvatarInitial || "M"}
                              </div>
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
                                <div
                                  className="w-7 h-7 rounded-[9.625px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                                  style={{ backgroundColor: getAvatarColorHexForId(msg.senderId) }}
                                >
                                  {msg.senderAvatarInitial || "U"}
                                </div>
                              )}

                              <div className="flex-1">
                                {msg.senderType !== "system" && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm" style={{ color: '#2E2D31', fontWeight: 500 }}>
                                      {msg.senderName || "Unknown"}
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
                                      ? "bg-muted text-muted-foreground py-2 px-4 rounded-lg text-sm text-left ml-11"
                                      : "text-sm"
                                  }
                                  style={msg.senderType !== "system" ? { color: '#2E2D31' } : undefined}
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
            onImageClick={attachmentStoragePrefix ? () => setImageUploadOpen(true) : undefined}
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

          {attachmentStoragePrefix && (
            <ImageUploadModal
              open={imageUploadOpen}
              onOpenChange={setImageUploadOpen}
              storagePath={`ticket-attachments/${attachmentStoragePrefix}/${new Date().getTime()}`}
              onUploadComplete={(url) => {
                // Insert the image as a markdown reference into the message
                const imageMarkdown = `\n![attachment](${url})\n`
                onMessageChange(message + imageMarkdown)
                onImageUploaded?.(url)
              }}
              title="Attach Image"
              description="Upload an image to attach to this ticket"
              privateBucket
            />
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-border relative z-20 flex flex-col">
          <div className="flex-1 overflow-y-auto pl-5 pr-4 py-6">
            {/* People in Chat */}
            <div>
              <h3
                className="mb-3 uppercase"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  color: 'rgba(0,0,0,0.5)',
                  fontWeight: 500,
                }}
              >
                People in this chat
              </h3>

              {participantsLoading ? (
                <div className="text-center text-muted-foreground text-[13px] py-4">Loading...</div>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                        style={{ backgroundColor: getAvatarColorHexForId(p.id) }}
                      >
                        {p.avatarInitial}
                      </div>
                      <span className="text-[13px] text-muted-foreground">{p.isCurrentUser ? "You" : p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-[13px] py-4">-</div>
              )}

              {!isEnded && (
                <Button variant="ghost" className="w-full justify-start text-brand-primary hover:bg-brand-primary/10">
                  <Plus className="w-4 h-4" />
                  Invite other helper
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6 -ml-5 -mr-4" />

            {/* Other Topics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3
                  className="mb-3 uppercase"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    color: 'rgba(0,0,0,0.5)',
                    fontWeight: 500,
                  }}
                >
                  Other topics in this chat
                </h3>
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
                <div className="text-center text-muted-foreground text-[13px] py-4">-</div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6 -ml-5 -mr-4" />

            {/* Type of Help */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[13px] text-foreground" style={{ fontWeight: 550 }}>Type of help</h3>
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
                <div className="text-center text-muted-foreground text-[13px] py-4">-</div>
              )}
            </div>

            {rightSidebarFooter}
          </div>
        </div>
      </main>
    </div>
  )
}


