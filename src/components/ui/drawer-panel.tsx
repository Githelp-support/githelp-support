"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DrawerPanelProps {
  /** Whether the drawer is visible */
  isOpen: boolean
  /** Called when backdrop is clicked, Esc is pressed or the close button is used */
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
  /** Backdrop colour; default bg-black/20 */
  backdropClassName?: string
  /** Extra class for the panel container */
  className?: string
  /** Extra class for the footer wrapper (e.g. border-t-0 to remove the divider) */
  footerClassName?: string
}

/**
 * Reusable right-side drawer built on Radix Dialog: backdrop + panel with an
 * optional header (title + close) and footer. It slides in from the right over
 * duration-slow and out over duration-base, traps focus and closes on Esc.
 * Keep the component mounted while closed (don't `return null` around it) so
 * the exit animation can play. Below sm it is full width.
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
  footerClassName,
}: DrawerPanelProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
            backdropClassName,
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full flex-col border-l border-border bg-background shadow-modal outline-none rounded-l-xl",
            "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
            "max-sm:w-full max-sm:rounded-none max-sm:border-l-0",
            width,
            className,
          )}
        >
          {title != null ? (
            // Title is required for a11y even when the header is hidden.
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-5">
              <div className="flex items-center gap-3">
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:bg-surface-hover"
                    aria-label="Close"
                  >
                    <X className="size-[18px] stroke-[1.5]" />
                  </Button>
                </DialogPrimitive.Close>
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
                {headerAction}
              </div>
            </div>
          ) : (
            <>
              <DialogPrimitive.Title className="sr-only">Panel</DialogPrimitive.Title>
              {headerAction != null && (
                <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-5">
                  <div className="flex items-center gap-3">
                    <DialogPrimitive.Close asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:bg-surface-hover"
                        aria-label="Close"
                      >
                        <X className="size-[18px] stroke-[1.5]" />
                      </Button>
                    </DialogPrimitive.Close>
                    {headerAction}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {footer != null && (
            <div className={cn("shrink-0 border-t border-border-subtle px-6 py-4", footerClassName)}>{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
