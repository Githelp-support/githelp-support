"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TicketUnavailableNoticeProps {
  /** A guest conversation is still being linked to this account (adoption pending). */
  linking: boolean
  /** Linking was refused for good (4xx): offer a fresh start. */
  failedFinal: boolean
  newConversationHref: string
  /** The user chose "ask me later" for the link prompt. */
  deferred?: boolean
  /** "Link conversation": show the link prompt now. */
  onLink?: () => void
  /** A saved guest conversation expired before it was linked (60 minutes). */
  expired?: boolean
  /**
   * The viewer is this browser's own guest and the ticket is hidden from
   * them: the chat window was closed for more than 30 minutes.
   */
  guestExpired?: boolean
  /** Runs when "Start a new conversation" is followed from the guest-expired notice. */
  onNewConversation?: () => void
}

/**
 * `/support/chat?ticket=X` when X isn't visible. Right after sign-in that is
 * usually because adoption hasn't finished (timeout / 5xx; it is retried),
 * so say so instead of "Ticket not found".
 */
export function TicketUnavailableNotice({
  linking,
  failedFinal,
  newConversationHref,
  deferred = false,
  onLink,
  expired = false,
  guestExpired = false,
  onNewConversation,
}: TicketUnavailableNoticeProps) {
  if (linking) {
    return (
      <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle" role="status">
        <h1 className="text-2xl font-medium text-foreground mb-2 flex items-center gap-2">
          {!deferred && <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />}
          {deferred ? "Link your guest conversation?" : "Linking your conversation…"}
        </h1>
        <p className="text-muted-foreground">
          {deferred
            ? "The conversation you started as a guest isn't linked to your account yet."
            : "We\u2019re moving the conversation you started as a guest to your account. This page updates by itself."}
        </p>
        {onLink && (
          <Button variant="lavender" className="mt-4 cursor-pointer" onClick={onLink}>
            Link conversation
          </Button>
        )}
      </div>
    )
  }
  if (guestExpired) {
    return (
      <div data-slot="guest-conversation-expired" className="bg-card rounded-lg border border-border-subtle p-8">
        <h1 className="text-title font-medium text-text-heading mb-2">Conversation no longer available</h1>
        <p className="text-sm text-text-muted">
          This guest conversation was closed because the chat window was closed for more than 30 minutes.
        </p>
        <p className="mt-4 text-sm">
          <Link
            href={newConversationHref}
            onClick={onNewConversation}
            className="rounded-sm font-medium text-brand-primary transition-colors duration-fast ease-out hover:text-brand-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            Start a new conversation
          </Link>
        </p>
      </div>
    )
  }
  if (expired) {
    return (
      <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle">
        <h1 className="text-2xl font-medium text-foreground mb-2">Conversation not linked</h1>
        <p className="text-muted-foreground">This guest conversation wasn&rsquo;t linked to your account in time.</p>
        <p className="mt-4">
          <Link href={newConversationHref} className="text-brand-primary font-medium hover:underline">
            Start a new conversation
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle">
      <h1 className="text-2xl font-medium text-foreground mb-2">Ticket not found</h1>
      <p className="text-muted-foreground">
        This ticket may have been removed or you may not have access to it.
      </p>
      {failedFinal && (
        <p className="mt-4">
          <Link href={newConversationHref} className="text-brand-primary font-medium hover:underline">
            Start a new conversation
          </Link>
        </p>
      )}
    </div>
  )
}
