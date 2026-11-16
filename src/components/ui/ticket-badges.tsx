import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import {
  getCategoryDotClass,
  getPriorityStyle,
  getTicketStatusBadge,
} from "@/lib/status-colors"
import { cn } from "@/lib/utils"

type BadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant" | "children">

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Ticket status badge: variant and icon from `getTicketStatusBadge`, label defaults to the status. */
function TicketStatusBadge({
  status,
  label,
  ...props
}: BadgeProps & { status: string; label?: React.ReactNode }) {
  const { variant, icon } = getTicketStatusBadge(status)
  return (
    <Badge variant={variant} {...props}>
      {icon && <Icon name={icon} size={3} />}
      {label ?? status}
    </Badge>
  )
}

/** Priority: plain text for low/medium/high, a Badge only for urgent. */
function TicketPriority({
  priority,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { priority: string }) {
  const style = getPriorityStyle(priority)
  const label = capitalize(priority)
  if (style.kind === "badge") {
    return (
      <Badge variant={style.variant} className={className} {...props}>
        {label}
      </Badge>
    )
  }
  return (
    <span data-slot="ticket-priority" className={cn(style.className, className)} {...props}>
      {label}
    </span>
  )
}

/** Helper category badge: outlined, with the tier dot before the label. */
function CategoryBadge({
  category,
  label,
  ...props
}: BadgeProps & { category: string; label: React.ReactNode }) {
  return (
    <Badge variant="category" {...props}>
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full shrink-0", getCategoryDotClass(category))}
      />
      {label}
    </Badge>
  )
}

export { TicketStatusBadge, TicketPriority, CategoryBadge }
