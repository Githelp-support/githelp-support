"use client"

import { useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Copy, Check } from "lucide-react"
import { SLA_CREATION_UNAVAILABLE_TOOLTIP } from "@/lib/constants"

interface SLAConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Intentionally not invoked: SLA creation is not available yet, so the
   * "Confirm creation" button only shows an explanatory tooltip. Kept so
   * existing callers continue to type-check.
   */
  onConfirm?: () => void
  slaId: string
}

export function SLAConfirmationModal({ isOpen, onClose, slaId }: SLAConfirmationModalProps) {
  const [copied, setCopied] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(slaId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    // The modal can only be dismissed via "Cancel": no close button, and the
    // backdrop / Esc are ignored.
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 p-0 sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-border-subtle p-6">
          <DialogTitle className="text-lg font-semibold text-foreground">Confirming new SLA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">Support space ID for this SLA:</p>

          <div className="flex items-center justify-center space-x-2 rounded-lg bg-muted p-4">
            <span className="select-all font-mono text-sm text-foreground">{slaId}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy ID"}
              className="text-muted-foreground hover:bg-brand-primary/10"
            >
              <span key={String(copied)} className="inline-flex animate-fade-in">
                {copied ? <Check className="h-4 w-4 text-status-success-text" /> : <Copy className="h-4 w-4" />}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-row gap-3 border-t border-border-subtle p-6 sm:justify-start">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Tooltip open={tipOpen} onOpenChange={setTipOpen}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="lavender"
                className="flex-1"
                // Show the explanation on tap as well as on hover.
                onClick={(e) => {
                  e.preventDefault()
                  setTipOpen(true)
                }}
              >
                Confirm creation
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {SLA_CREATION_UNAVAILABLE_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
