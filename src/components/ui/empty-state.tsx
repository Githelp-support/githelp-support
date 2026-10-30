import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import { SQUIRCLE_RADIUS } from "@/lib/constants"

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Lucide icon shown in the tinted tile. Defaults to an inbox. */
  icon?: LucideIcon
  /** Short, plain title, e.g. "No tickets to show". */
  title: React.ReactNode
  /** One optional sentence under the title. */
  description?: React.ReactNode
  /** Optional action (a Button or Link) that leads to an existing flow. */
  action?: React.ReactNode
  /** Compact variant for rows inside a list card. */
  size?: "default" | "sm"
}

/**
 * The shared empty state for lists and panels: a muted icon in a brand-tinted
 * squircle tile (like the stats cards), a title, an optional one-line
 * description and an optional action. Use it instead of ad-hoc "No X" text.
 */
function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-6 py-8" : "gap-3 px-6 py-12",
        className,
      )}
      {...props}
    >
      <div
        data-testid="empty-state-icon"
        className={cn(
          "flex items-center justify-center bg-brand-primary/10 text-brand-primary",
          size === "sm" ? `size-8 ${SQUIRCLE_RADIUS[32]}` : `size-[42px] ${SQUIRCLE_RADIUS[42]}`,
        )}
      >
        <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-ui text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1 flex items-center gap-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
