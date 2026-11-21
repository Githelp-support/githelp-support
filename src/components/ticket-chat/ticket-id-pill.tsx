"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { shortTicketId } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface TicketIdPillProps {
  /** Full ticket ID; the pill shows its first 8 characters and copies all of it. */
  ticketId: string
  className?: string
}

/**
 * Ticket ID in the chat header: the short ID in a grey pill with a button that
 * copies the full ID. For 1.5s the button swaps to a checkmark and "Copied"
 * shows beside it (also announced to screen readers).
 */
export function TicketIdPill({ ticketId, className }: TicketIdPillProps) {
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
      // Clipboard unavailable (insecure context / permissions): nothing to do.
    }
  }, [ticketId])

  return (
    <span
      data-slot="ticket-id-pill"
      className={cn("bg-bg-subtle rounded-md px-2 h-6 inline-flex items-center gap-1", className)}
    >
      <span className="font-mono text-xs font-normal tabular-nums text-text-muted" title={ticketId}>
        {shortTicketId(ticketId)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        aria-label="Copy full ticket ID"
        className="-mr-1 size-5 rounded-sm text-text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-primary/40"
      >
        <span key={String(copied)} className="inline-flex animate-fade-in">
          <Icon name={copied ? "fi-rr-check" : "fi-rr-copy"} size={3} />
        </span>
      </Button>
      <span
        aria-live="polite"
        className={copied ? "text-xs text-text-muted animate-fade-in" : "sr-only"}
      >
        {copied ? "Copied" : ""}
      </span>
    </span>
  )
}
