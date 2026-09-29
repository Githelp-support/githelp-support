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
      aria-controls={expanded ? panelId : undefined}
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

/**
 * How the expanded list is laid out:
 * - "default": an indented panel with its own columns.
 * - "table": the lines share the column tracks of the table row above them.
 *   The panel must then be a sibling of that row's grid (same containing
 *   width), and each line gets the row's grid template through `columns`.
 */
export type TransactionsAlign = "default" | "table"

const DEFAULT_LINE_COLUMNS = "3.5rem 6rem minmax(0, 1fr) 8rem 9rem minmax(0, auto)"

export function TransactionsPanel({
  id,
  children,
  className,
  align = "default",
}: {
  id: string
  children: ReactNode
  className?: string
  align?: TransactionsAlign
}) {
  return (
    <div
      id={id}
      role="list"
      data-align={align}
      className={cn(
        "mt-3 overflow-x-auto rounded-md bg-muted/30 divide-y divide-border",
        align === "table"
          ? // Bleeds 1rem out on both sides, which the lines' px-4 takes back, so
            // their content box is exactly the parent row's. A ring instead of a
            // border, because a border would narrow that box by 2px.
            "-mx-4 ring-1 ring-border"
          : "ml-8 border border-border",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * One transaction under its ticket: "1 of 2 · date · description · amount · status · actions".
 *
 * With `align="table"` the line starts with an empty cell (the table's checkbox
 * column) and uses `columns`, the parent table's grid template:
 * checkbox | 1 of 2 | date | description | amount | status | actions.
 *
 * A table without a column for the description leaves `description` out (the
 * cell is then not rendered) and can pass a `reference`, shown under "1 of 2".
 */
export function TransactionLine({
  index,
  count,
  date,
  description,
  reference,
  amount,
  status,
  actions,
  align = "default",
  columns,
  className,
}: {
  index: number
  count: number
  date: string
  /** Omit to render no description cell. */
  description?: ReactNode
  /** Shown under "1 of 2", in the same cell. */
  reference?: ReactNode
  amount: ReactNode
  status: ReactNode
  actions?: ReactNode
  align?: TransactionsAlign
  /** Overrides the line's `grid-template-columns`. */
  columns?: string
  className?: string
}) {
  const table = align === "table"
  return (
    <div
      role="listitem"
      data-align={align}
      className={cn("grid items-center gap-4 px-4 py-2 text-sm", !table && "min-w-[36rem]", className)}
      style={{ gridTemplateColumns: columns ?? DEFAULT_LINE_COLUMNS }}
    >
      {table && <span aria-hidden="true" data-slot="transaction-line-spacer" />}
      <span className="min-w-0 text-xs text-muted-foreground tabular-nums">
        {index + 1} of {count}
        {reference !== undefined && (
          <span data-slot="transaction-line-reference" className="block truncate">
            {reference}
          </span>
        )}
      </span>
      <span className="text-muted-foreground tabular-nums">{date}</span>
      {description !== undefined && <span className="truncate text-foreground">{description}</span>}
      <span className="text-foreground tabular-nums">{amount}</span>
      <span>{status}</span>
      <span className="flex items-center justify-end gap-2">{actions}</span>
    </div>
  )
}
