"use client"

import { useCallback, useEffect, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { shortTicketId } from "@/lib/customer-chat-messages"
import { cn } from "@/lib/utils"

/**
 * The ticket id next to the chat title: the short id ("b435097a..") on a grey
 * pill with a button that copies the full id.
 */
export function TicketIdPill({ ticketId, className }: { ticketId: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ticketId)
      setCopied(true)
    } catch {
      // Clipboard unavailable (insecure context / permissions) — nothing to do.
    }
  }, [ticketId])

  return (
    <span
      data-slot="ticket-id-pill"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-bg-subtle pl-2 pr-1 font-mono text-xs text-text-muted",
        className
      )}
    >
      <span>{shortTicketId(ticketId)}..</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy full ticket ID"
        title={copied ? "Copied" : "Copy full ticket ID"}
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-text-tertiary outline-none transition-colors duration-fast ease-out hover:bg-surface-hover hover:text-foreground active:bg-surface-active focus-visible:ring-2 focus-visible:ring-brand-primary/40"
      >
        <span key={String(copied)} className="inline-flex animate-fade-in">
          <Icon name={copied ? "fi-rr-check" : "fi-rr-copy"} size={3.5} />
        </span>
      </button>
      <span aria-live="polite" className={cn("font-sans", !copied && "sr-only")}>
        {copied ? "Copied" : ""}
      </span>
    </span>
  )
}
