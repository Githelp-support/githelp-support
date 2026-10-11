"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, Check } from "lucide-react"

interface SLAConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  slaId: string
}

const CREATION_UNAVAILABLE_MESSAGE =
  "Creating SLAs is not available yet. This setup flow is shown for illustration only."

export function SLAConfirmationModal({ isOpen, onClose, slaId }: SLAConfirmationModalProps) {
  const [copied, setCopied] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(slaId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop (non-closing: the modal can only be dismissed via Cancel) */}
      <div className="fixed inset-0 bg-black/20 z-50" />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-xl z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Confirming new SLA</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Support space ID for this SLA:</p>

          <div className="flex items-center justify-center space-x-2 p-4 bg-muted rounded-lg">
            <span className="font-mono text-sm text-foreground select-all">{slaId}</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:bg-brand-primary/10 p-1">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="p-6 border-t border-border flex space-x-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <TooltipProvider>
            <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="lavender"
                  aria-disabled="true"
                  className="flex-1"
                  // Intentional no-op: SLA creation is not available yet.
                  // Opening the tooltip on click makes the message reachable on touch devices.
                  onClick={() => setTooltipOpen(true)}
                >
                  Confirm creation
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-xs text-center">
                {CREATION_UNAVAILABLE_MESSAGE}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  )
}
