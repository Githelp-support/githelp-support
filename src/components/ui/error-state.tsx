"use client"

import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SQUIRCLE_RADIUS } from "@/lib/constants"

export interface ErrorStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Short, plain title. Defaults to "Something went wrong". */
  title?: React.ReactNode
  /** One optional sentence. Defaults to a generic retry hint. */
  description?: React.ReactNode
  /** Called by the "Try again" button; pass the query's refetch. */
  onRetry?: () => void
  /** Compact variant for rows inside a list card. */
  size?: "default" | "sm"
}

/**
 * The shared error state for a list or page query that failed. Same layout as
 * EmptyState, with a "Try again" button that calls the query's refetch.
 */
function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
  size = "default",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-6 py-8" : "gap-3 px-6 py-12",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center justify-center bg-status-high-bg text-status-high-text",
          size === "sm" ? `size-8 ${SQUIRCLE_RADIUS[32]}` : `size-[42px] ${SQUIRCLE_RADIUS[42]}`,
        )}
      >
        <AlertCircle className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-ui text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
