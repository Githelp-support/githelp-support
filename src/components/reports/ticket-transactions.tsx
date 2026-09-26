"use client"

import { useCallback, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { transactionCountLabel } from "@/lib/ticket-groups"

/**
 * Shared pieces for Reports tables that show one record per ticket: a
 * toggle that says how many transactions the ticket has, and the indented
 * list of those transactions shown when it is expanded.
 */

/** Which ticket records are expanded, keyed by group key. */
export function useExpandedRows() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const isExpanded = useCallback((key: string) => expanded.has(key), [expanded])
  return { isExpanded, toggle }
}

export function transactionsPanelId(key: string): string {
  return `transactions-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

/** "2 transactions ›" under the ticket id; rendered only for tickets with more than one. */
export function TransactionsToggle({
  count,
  expanded,
  onToggle,
  panelId,
  noun = "transaction",
  className,
}: {
  count: number
  expanded: boolean
  onToggle: () => void
  panelId: string
  noun?: string
  className?: string
}) {
  if (count < 2) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={panelId}
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary hover:bg-brand-primary/15 cursor-pointer",
        className,
      )}
    >
      <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
      {transactionCountLabel(count, noun)}
    </button>
  )
}

export function TransactionsPanel({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      id={id}
      role="list"
      className={cn("mt-3 ml-8 rounded-md border border-border bg-muted/30 divide-y divide-border", className)}
    >
      {children}
    </div>
  )
}

/** One transaction under its ticket: "1 of 2 · date · description · amount · status · actions". */
export function TransactionLine({
  index,
  count,
  date,
  description,
  amount,
  status,
  actions,
}: {
  index: number
  count: number
  date: string
  description: ReactNode
  amount: ReactNode
  status: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      role="listitem"
      className="grid items-center gap-4 px-4 py-2 text-sm"
      style={{ gridTemplateColumns: "3.5rem 6rem minmax(0, 1fr) 8rem 9rem minmax(0, auto)" }}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {index + 1} of {count}
      </span>
      <span className="text-muted-foreground tabular-nums">{date}</span>
      <span className="truncate text-foreground">{description}</span>
      <span className="text-foreground tabular-nums">{amount}</span>
      <span>{status}</span>
      <span className="flex items-center justify-end gap-2">{actions}</span>
    </div>
  )
}
