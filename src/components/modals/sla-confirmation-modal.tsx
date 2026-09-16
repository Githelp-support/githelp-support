"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle, Copy, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SLAConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Row id of the created SLA (for the "View agreement" link). */
  slaId: string | null
  /** The XXXX-XXXX-XXXX code the customer types to link their organization. */
  accessCode: string | null
  slaName?: string | null
}

/**
 * Shown right after an SLA is created: surfaces the real access code so the
 * admin can hand it to the customer.
 */
export function SLAConfirmationModal({ open, onOpenChange, slaId, accessCode, slaName }: SLAConfirmationModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!accessCode) return
    try {
      await navigator.clipboard.writeText(accessCode)
      setCopied(true)
      toast.success("Access code copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy. Select the code and copy it manually.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <CheckCircle className="size-7 text-green-600 dark:text-green-500" aria-hidden="true" />
          <DialogTitle>SLA created</DialogTitle>
          <DialogDescription className="mt-[3px]">
            {slaName ? `"${slaName}" is ready.` : "Your agreement is ready."} Share this code with your
            customer. They enter it under Support → I have an SLA code to link their organization and
            start using the agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <span className="font-mono text-lg tracking-widest text-foreground select-all">
            {accessCode ?? "—"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!accessCode}
            className="text-muted-foreground border-border hover:bg-muted bg-transparent"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <DialogFooter className="mt-[3px] sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {slaId && (
            <Button asChild variant="lavender">
              <Link href={`/slas/${slaId}`}>View agreement</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
