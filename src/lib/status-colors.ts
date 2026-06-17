/**
 * Centralized status and priority badge colors using design tokens.
 * Use these instead of hardcoded hex in tickets, reports, and helpers.
 */

/** Report/generic status → Tailwind badge classes */
export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "available":
    case "completed":
    case "resolved":
    case "paid out":
      return "bg-status-success-bg text-status-success-text"
    case "claimed":
    case "in progress":
    case "pending":
      return "bg-status-warning-bg text-status-warning-text"
    case "failed":
      return "bg-status-high-bg text-status-high-text"
    default:
      return "bg-muted text-muted-foreground"
  }
}

/** Ticket status with in-progress using brand primary */
export function getTicketStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-status-success-bg text-status-success-text"
    case "claimed":
    case "in-progress":
      return "bg-status-warning-bg text-status-warning-text"
    case "available":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

/** Priority → Tailwind badge classes */
export function getPriorityBadgeClass(priority: string): string {
  switch (priority.toLowerCase()) {
    case "high":
      return "bg-status-high-bg text-status-high-text"
    case "medium":
      return "bg-status-warning-bg text-status-warning-text"
    case "low":
      return "bg-status-success-bg text-status-success-text"
    default:
      return "bg-muted text-muted-foreground"
  }
}
