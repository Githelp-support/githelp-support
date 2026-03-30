"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DrawerPanelProps {
  /** Whether the drawer is visible */
  isOpen: boolean
  /** Called when backdrop is clicked or close button is used */
  onClose: () => void
  /** Optional title shown in the header */
  title?: string
  /** Optional node to render next to the title (e.g. icon) */
  headerAction?: React.ReactNode
  /** Main content; use flex-1 and overflow-auto in your content wrapper if needed */
  children: React.ReactNode
  /** Optional footer (e.g. Cancel / Submit buttons) */
  footer?: React.ReactNode
  /** Panel width; default w-96. Use e.g. w-[500px] for wider drawers */
  width?: string
  /** Backdrop opacity; default bg-black/20 */
  backdropClassName?: string
  /** Extra class for the panel container */
  className?: string
}

/**
 * Reusable right-side drawer: backdrop + panel with optional header (title + close) and footer.
 * Single-purpose: layout and behavior only; content is passed as children.
 */
export function DrawerPanel({
  isOpen,
  onClose,
  title,
  headerAction,
  children,
  footer,
  width = "w-96",
  backdropClassName = "bg-black/20",
  className,
}: DrawerPanelProps) {
  if (!isOpen) return null

  return (
    <>
      <div
        className={cn("fixed inset-0 z-40", backdropClassName)}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "fixed right-0 top-0 h-full bg-background shadow-2xl z-50 flex flex-col border-border border-l rounded-l-2xl",
          width,
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
      >
        {(title != null || headerAction != null) && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              {title != null && (
                <h2 id="drawer-title" className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {headerAction}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
        {footer != null && (
          <div className="px-6 py-4 border-t border-border flex-shrink-0">{footer}</div>
        )}
      </div>
    </>
  )
}
