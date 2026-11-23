"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

const COPIED_MS = 1500

/**
 * Short ticket id ("b435097a..") on a grey pill with a copy button. The
 * button copies the full id and the pill reads "Copied" for 1.5s.
 */
export function TicketIdPill({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id)
    } catch {
      // Clipboard unavailable (insecure context or denied): don't claim success.
      return
    }
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <span
      data-slot="ticket-id-pill"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-bg-subtle pr-0.5 pl-2 font-mono text-xs text-text-muted",
        className,
      )}
    >
      {/* Both labels share one grid cell, so the pill keeps its width while it reads "Copied". */}
      <span className="grid">
        <span className={cn("col-start-1 row-start-1", copied && "invisible")}>{id.slice(0, 8)}..</span>
        <span aria-live="polite" className="col-start-1 row-start-1">
          {copied ? <span className="animate-fade-in">Copied</span> : null}
        </span>
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy full ticket ID"
        className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-text-tertiary transition-colors duration-fast ease-out hover:bg-surface-hover hover:text-foreground active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
      >
        <Icon key={copied ? "check" : "copy"} name={copied ? "fi-rr-check" : "fi-rr-copy"} size={3.5} className="animate-fade-in" />
      </button>
    </span>
  )
}
