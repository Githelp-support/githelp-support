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
}: TicketUnavailableNoticeProps) {
  if (linking) {
    return (
      <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle" role="status">
        <h1 className="text-2xl font-semibold text-foreground mb-2 flex items-center gap-2">
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
  if (expired) {
    return (
      <div className="bg-card rounded-lg p-8 shadow-sm border border-border-subtle">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Conversation not linked</h1>
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
      <h1 className="text-2xl font-semibold text-foreground mb-2">Ticket not found</h1>
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
