"use client"

import { useEffect, useState } from "react"
import { CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface RequestPdfModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional callback fired when the user confirms the PDF request */
  onConfirm?: () => void
}

export function RequestPdfModal({ open, onOpenChange, onConfirm }: RequestPdfModalProps) {
  const [requested, setRequested] = useState(false)

  // Reset to the initial state whenever the modal is reopened
  useEffect(() => {
    if (open) {
      setRequested(false)
    }
  }, [open])

  const handleConfirm = () => {
    onConfirm?.()
    setRequested(true)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!requested ? (
          <>
            <DialogHeader>
              <DialogTitle>Request PDF</DialogTitle>
              <DialogDescription>
                At the moment, PDF-reports must be requested. We hope to offer
                directly downloadable PDFs for all reports shortly.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="lavender" onClick={handleConfirm}>
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="items-center text-center sm:text-center">
              <CheckCircle
                className={cn("size-10 text-green-600 dark:text-green-500")}
                aria-hidden="true"
              />
              <DialogTitle className="sr-only">Request received</DialogTitle>
              <DialogDescription>
                We have received your request. We will share the requested PDF
                to your registered email address as soon as possible. Thank you.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
