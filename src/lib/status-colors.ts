/**
 * Centralized status and priority badge colors using design tokens.
 * Use these instead of hardcoded hex in tickets, reports, and helpers.
 */

/**
 * Badge shape shared by every status/priority badge: rounded-md, h-5, px-2,
 * text-xs/400 (the Badge primitive sets the same, so this is safe to spread).
 */
export const BADGE_SHAPE_CLASS = "h-5 rounded-md border-transparent px-2 text-xs font-normal"

/** Report/generic status → Tailwind badge classes */
export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "available":
    case "completed":
    case "resolved":
    case "paid out":
    case "paid":
      return "bg-status-success-bg text-status-success-text"
    case "claimed":
    case "in progress":
    case "pending":
    case "on hold":
    case "action required":
      return "bg-status-warning-bg text-status-warning-text"
    case "failed":
      return "bg-status-high-bg text-status-high-text"
    case "cancelled":
    default:
      return "bg-muted text-muted-foreground"
  }
}

export type TicketStatusBadgeVariant = "info" | "neutral" | "success" | "subdued" | "type"

export interface TicketStatusBadgeStyle {
  variant: TicketStatusBadgeVariant
  /** UIcons class shown before the label; unknown statuses have none. */
  icon?: `fi-${string}`
}

/**
 * Ticket status → Badge variant + icon. Case-insensitive; accepts raw DB values
 * ("available", "in-progress") and display labels ("Unclaimed", "In Progress").
 */
export function getTicketStatusBadge(status: string): TicketStatusBadgeStyle {
  switch (status.trim().toLowerCase()) {
    case "available":
    case "unclaimed":
      return { variant: "info", icon: "fi-rr-circle-dashed" }
    case "claimed":
    case "in-progress":
    case "in progress":
      return { variant: "neutral", icon: "fi-rr-circle-half-stroke" }
    case "completed":
      return { variant: "success", icon: "fi-rr-check-circle" }
    case "cancelled":
      return { variant: "subdued", icon: "fi-rr-cross-circle" }
    default:
      return { variant: "type" }
  }
}

export type PriorityStyle =
  | { kind: "text"; className: string }
  | { kind: "badge"; variant: "urgent" }

/**
 * Priority → how to render it. Low/medium/high are plain text (no fill);
 * urgent is the only one drawn as a Badge. The data type is low | medium | high
 * today, so `urgent` is supported here but never rendered.
 */
export function getPriorityStyle(priority: string): PriorityStyle {
  switch (priority.trim().toLowerCase()) {
    case "urgent":
      return { kind: "badge", variant: "urgent" }
    case "high":
      return { kind: "text", className: "text-xs font-semibold text-badge-emphasis-text" }
    case "low":
    case "medium":
    default:
      return { kind: "text", className: "text-xs font-normal text-badge-muted-text" }
  }
}

/** Helper category (raw value or label) → tier dot colour; undefined when unknown. */
export function getCategoryDotClass(category: string): string | undefined {
  switch (category.trim().toLowerCase()) {
    case "core":
    case "core team":
      return "bg-badge-dot-core"
    case "community":
      return "bg-badge-dot-community"
    case "extended":
    case "extended team":
      return "bg-badge-dot-extended"
    default:
      return undefined
  }
}
