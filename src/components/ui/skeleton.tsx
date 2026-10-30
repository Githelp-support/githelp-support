import * as React from "react"

import { cn } from "@/lib/utils"

/** A decorative placeholder block. Size it with height and width classes. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-hover", className)}
      {...props}
    />
  )
}

interface ListSkeletonProps extends React.ComponentProps<"div"> {
  /** Number of placeholder rows (default 5). */
  rows?: number
  /** Show the avatar placeholder at the start of each row (default true). */
  avatar?: boolean
  /** Show the badge placeholder at the end of each row (default true). */
  badge?: boolean
}

/**
 * Placeholder rows for a list that is loading: avatar, title + meta line and a
 * badge. Matches the ListRow layout (min-h-12, px-6, hairline dividers).
 */
function ListSkeleton({ rows = 5, avatar = true, badge = true, className, ...props }: ListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-live="polite"
      className={cn("divide-y divide-border-subtle", className)}
      {...props}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} data-slot="skeleton-row" className="flex min-h-12 items-center gap-4 px-6 py-3">
          {avatar && <Skeleton className="size-8 shrink-0 rounded-[11px]" />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5" style={{ width: `${48 + ((i * 17) % 32)}%` }} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          {badge && <Skeleton className="h-5 w-16 shrink-0" />}
        </div>
      ))}
    </div>
  )
}

/**
 * Content-area placeholder used by route-level loading UI: a header bar and a
 * few card blocks. Renders inside the AppShell so the sidebar stays visible.
 */
function PageSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-live="polite"
      className={cn("flex flex-1 min-h-0 flex-col overflow-hidden", className)}
      {...props}
    >
      <div className="border-b border-border-subtle px-8 py-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2.5 h-3.5 w-72" />
      </div>
      <div className="flex flex-col gap-8 px-8 py-6">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border-subtle p-5">
              <Skeleton className="size-8 rounded-[11px]" />
              <Skeleton className="mt-4 h-6 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <div className="h-10 border-b border-border-subtle bg-brand-primary/10" />
          <ListSkeleton rows={4} role="presentation" aria-label={undefined} aria-live={undefined} />
        </div>
      </div>
    </div>
  )
}

export { Skeleton, ListSkeleton, PageSkeleton }
