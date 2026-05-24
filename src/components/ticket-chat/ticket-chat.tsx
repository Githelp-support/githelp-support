"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, Info, Plus } from "lucide-react"
import { MarkdownContent } from "@/components/ticket-chat/markdown-content"
import { TicketChatInput } from "@/components/ticket-chat/chat-input"
import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { getAvatarColorHexForId } from "@/lib/constants"

export type TicketChatMessage = {
  id: string
  senderType: "user" | "helper" | "system"
  senderName?: string | null
  senderId?: string | null
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
  /** Optional element rendered to the right of the page-header title (e.g. a ticket-ID pill). */
  headerTitlePill?: React.ReactNode
  /** Optional class name applied to the right info sidebar (lets pages override its width). */
  rightSidebarClassName?: string

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

// Shared style tokens for the Figma 719:8055 layout
const NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 700,
  fontSize: 17,
  color: "#0f0f11",
  letterSpacing: "-0.34px",
  lineHeight: 1.2,
}

const TIMESTAMP_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 600,
  fontSize: 12,
  color: "#818185",
  lineHeight: 1.2,
}

const BODY_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 400,
  fontSize: 17,
  color: "#0f0f11",
  letterSpacing: "-0.34px",
  lineHeight: 1.5,
}

const SECTION_HEADING_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 600,
  fontSize: 17,
  color: "#0f0f11",
  letterSpacing: "-0.34px",
  lineHeight: 1.2,
}

const SECTION_VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 400,
  fontSize: 17,
  color: "#0f0f11",
  letterSpacing: "-0.34px",
  lineHeight: 1.2,
}

const TAG_PILL_STYLE: React.CSSProperties = {
  border: "1px solid #55555d",
  borderRadius: 10,
  padding: "7px 10px",
  fontFamily: "var(--font-open-sans)",
  fontWeight: 400,
  fontSize: 15,
  color: "#55555d",
  lineHeight: 1.2,
  display: "inline-flex",
  alignItems: "center",
}

const PARTICIPANT_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 400,
  fontSize: 15,
  color: "#0f0f11",
  lineHeight: 1.2,
}

const PURPLE_LINK_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-open-sans)",
  fontWeight: 600,
  fontSize: 17,
  color: "#3c2ec5",
  letterSpacing: "-0.34px",
  lineHeight: 1.2,
}

function TagPill({ children }: { children: React.ReactNode }) {
  return <span style={TAG_PILL_STYLE}>{children}</span>
}

function MessageAvatar({
  initial,
  id,
  avatarUrl,
  name,
}: {
  initial: string | null | undefined
  id: string | null | undefined
  avatarUrl?: string | null
  name?: string | null
}) {
  const bgColor = getAvatarColorHexForId(id ?? name ?? initial ?? "")
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[12px]"
      style={{
        width: 35,
        height: 35,
        backgroundColor: bgColor,
      }}
    >
      {avatarUrl ? (
        // We keep the colored block as background; Avatar img sits on top when provided.
        <Avatar className="w-full h-full rounded-[12px]">
          <AvatarImage src={avatarUrl} alt={name || "avatar"} className="rounded-[12px]" />
          <AvatarFallback
            className="rounded-[12px] bg-transparent text-[#0f0f11]"
            style={{
              fontFamily: "var(--font-outfit)",
              fontWeight: 500,
              fontSize: 17,
            }}
          >
            {initial || "?"}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span
          style={{
            fontFamily: "var(--font-outfit)",
            fontWeight: 500,
            fontSize: 17,
            color: "#0f0f11",
            lineHeight: 1,
          }}
        >
          {initial || "?"}
        </span>
      )}
    </div>
  )
}

function ParticipantAvatar({
  initial,
  id,
}: {
  initial: string
  id: string
}) {
  const bgColor = getAvatarColorHexForId(id)
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[12px]"
      style={{
        width: 32,
        height: 32,
        backgroundColor: bgColor,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-outfit)",
          fontWeight: 500,
          fontSize: 15,
          color: "#0f0f11",
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  )
}

export function TicketChat(props: TicketChatProps) {
  const {
    headerTitle,
    headerSubtitle,
    showBackButton,
    headerTitlePill,
    rightSidebarClassName,
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
      <div className="relative border-b border-border-subtle z-10">
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          showBackButton={showBackButton}
          titlePill={headerTitlePill}
        />
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
                      {thread.map((msg) => {
                        const isClaimedOrEnded =
                          msg.senderType === "system" &&
                          (msg.kind === "claimed" || msg.kind === "ended")
                        const isPlainSystem = msg.senderType === "system" && !isClaimedOrEnded

                        if (isClaimedOrEnded) {
                          // Centered inline pill ("You are signed in"-style confirmation)
                          return (
                            <div key={msg.id} className="w-full flex justify-center">
                              <div
                                className="inline-flex items-center gap-2 rounded-[10px]"
                                style={{ padding: 10 }}
                              >
                                <Check
                                  className="w-4 h-4 shrink-0"
                                  style={{ color: "#3c2ec5" }}
                                />
                                <span
                                  style={{
                                    fontFamily: "var(--font-open-sans)",
                                    fontWeight: 600,
                                    fontSize: 15,
                                    color: "#3c2ec5",
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {msg.content || msg.senderName || "You are signed in"}
                                </span>
                              </div>
                            </div>
                          )
                        }

                        if (isPlainSystem) {
                          // Generic system message — centered subtle text
                          return (
                            <div key={msg.id} className="w-full flex justify-center">
                              <div
                                className="inline-block text-center"
                                style={{
                                  ...BODY_STYLE,
                                  fontSize: 15,
                                  color: "#55555d",
                                }}
                              >
                                <MarkdownContent content={msg.content} />
                              </div>
                            </div>
                          )
                        }

                        // Regular user/helper message row
                        return (
                          <div key={msg.id} className="flex gap-3">
                            <MessageAvatar
                              initial={msg.senderAvatarInitial}
                              id={msg.senderId ?? msg.senderName}
                              avatarUrl={msg.senderAvatarUrl}
                              name={msg.senderName}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span style={NAME_STYLE}>
                                  {msg.senderName || "Unknown"}
                                </span>
                                <span style={TIMESTAMP_STYLE}>{msg.timestamp}</span>
                              </div>
                              <div style={BODY_STYLE}>
                                <MarkdownContent content={msg.content} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Other topics + Type of help below message stream */}
                    {(topics.length > 0 || helpTypes.length > 0) && (
                      <div className="space-y-6 pt-2">
                        {topics.length > 0 && (
                          <div>
                            <h3 style={SECTION_HEADING_STYLE} className="mb-3">
                              Other topics
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {topics.map((t) => (
                                <TagPill key={t}>{t}</TagPill>
                              ))}
                            </div>
                          </div>
                        )}

                        {helpTypes.length > 0 && (
                          <div>
                            <h3 style={SECTION_HEADING_STYLE} className="mb-3">
                              Type of help
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {helpTypes.map((h) => (
                                <TagPill key={h}>{h}</TagPill>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
              storagePath={`ticket-attachments/${attachmentStoragePrefix}/${Date.now()}`}
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
        <div
          className={`bg-white border-l border-border-subtle relative z-20 flex flex-col ${
            rightSidebarClassName ?? "w-80"
          }`}
        >
          <div className="flex-1 overflow-y-auto p-5 pt-6">
            {/* People in this chat */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <h3 style={SECTION_HEADING_STYLE}>People in this chat</h3>
                <Info className="w-3.5 h-3.5 text-[#818185]" />
              </div>

              {participantsLoading ? (
                <div className="text-center text-[#55555d] text-sm py-4">Loading...</div>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <ParticipantAvatar initial={p.avatarInitial} id={p.id} />
                      <span style={PARTICIPANT_NAME_STYLE}>
                        {p.isCurrentUser ? "You" : p.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#55555d] text-sm py-4">-</div>
              )}

              {!isEnded && (
                <button
                  type="button"
                  className="flex items-center gap-1 mt-2 cursor-pointer bg-transparent border-0 p-0"
                  style={PURPLE_LINK_STYLE}
                >
                  <Plus className="w-4 h-4" style={{ color: "#3c2ec5" }} />
                  Invite other helper
                </button>
              )}
            </div>

            {/* Divider */}
            <div
              className="my-6 -ml-5 -mr-5"
              style={{ borderTop: "1px solid #e1e1e1" }}
            />

            {/* Other topics in this chat */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <h3 style={SECTION_HEADING_STYLE}>Other topics in this chat</h3>
                <Info className="w-3.5 h-3.5 text-[#818185]" />
              </div>

              {topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <TagPill key={t}>{t}</TagPill>
                  ))}
                </div>
              ) : (
                <div className="text-[#55555d] text-sm py-1">-</div>
              )}
            </div>

            {rightSidebarFooter && (
              <>
                <div
                  className="my-6 -ml-5 -mr-5"
                  style={{ borderTop: "1px solid #e1e1e1" }}
                />
                {rightSidebarFooter}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Public style tokens — exported so parent pages can render the rightSidebarFooter
 * (e.g. "Logged time" and "Active tickets") with consistent typography.
 */
export const ticketChatStyles = {
  sectionHeading: SECTION_HEADING_STYLE,
  sectionValue: SECTION_VALUE_STYLE,
  purpleLink: PURPLE_LINK_STYLE,
  tagPill: TAG_PILL_STYLE,
  divider: { borderTop: "1px solid #e1e1e1" } as React.CSSProperties,
}
