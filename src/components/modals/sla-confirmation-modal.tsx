"use client"

import { useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Button } from "@/components/ui/button"
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
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — the modal can only be dismissed via "Cancel" */}
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
          <TooltipPrimitive.Provider delayDuration={150}>
            <TooltipPrimitive.Root open={tipOpen} onOpenChange={setTipOpen}>
              <TooltipPrimitive.Trigger asChild>
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
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={8}
                  className="z-[60] max-w-xs rounded-md bg-foreground px-3 py-2 font-sans text-xs leading-relaxed text-white shadow-md"
                >
                  {SLA_CREATION_UNAVAILABLE_TOOLTIP}
                  <TooltipPrimitive.Arrow className="fill-foreground" />
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </TooltipPrimitive.Provider>
        </div>
      </div>
    </>
  )
}
