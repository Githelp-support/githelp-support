import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Shared list chrome. Pages keep their own column grids, sorting, links and
 * click handlers; these only standardise the header band and the row frame.
 *
 * - `ListHeader`: GitHelp's lavender header band (brand-primary/10), h-10,
 *   px-6, text-xs/500 in text-muted (muted-foreground is only 4.1:1 on the
 *   tint), hairline below. Sort buttons inside keep their brand hover.
 * - `ListRow` / `listRowClass`: min-h-12, px-6, text-ui, hover surface and,
 *   when interactive, a visible focus ring. Use `bordered` when the rows are
 *   not inside a `divide-y` container.
 */

function ListHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="list-header"
      className={cn(
        "flex min-h-10 items-center border-b border-border-subtle bg-brand-primary/10 px-6 py-2 text-xs font-medium text-text-muted",
        "[&_button]:cursor-pointer [&_button]:rounded-sm [&_button:hover]:text-brand-primary [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-brand-primary/40",
        "[&>*]:flex-1",
        className,
      )}
      {...props}
    />
  )
}

export interface ListRowOptions {
  /** Row navigates or expands: pointer cursor plus a focus ring. */
  interactive?: boolean
  /** Visual tone. `subtle` is the grey background of unclaimed tickets. */
  tone?: "default" | "subtle"
  /** Draw the hairline on the row itself (rows outside a `divide-y` parent). */
  bordered?: boolean
  className?: string
}

/** Class string for rows rendered as links or buttons (see `ListRow` for a div). */
function listRowClass({ interactive = false, tone = "default", bordered = false, className }: ListRowOptions = {}) {
  return cn(
    "min-h-12 px-6 py-3 text-ui transition-colors duration-fast ease-out hover:bg-surface-hover",
    tone === "subtle" && "bg-bg-subtle/50",
    bordered && "border-b border-border-subtle last:border-b-0",
    interactive &&
      "cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40",
    className,
  )
}

type ListRowProps = React.ComponentProps<"div"> & Omit<ListRowOptions, "className">

function ListRow({ interactive, tone, bordered, className, ...props }: ListRowProps) {
  return <div data-slot="list-row" className={listRowClass({ interactive, tone, bordered, className })} {...props} />
}

export { ListHeader, ListRow, listRowClass }
