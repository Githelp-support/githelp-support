"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UnsavedChangesModalProps {
  open: boolean
  /** Optional override for the description copy. */
  message?: string
  /** Called when the user chooses to stay (buttons, overlay click or Escape). */
  onStay: () => void
  /** Called when the user confirms leaving and discarding their changes. */
  onLeave: () => void
}

const DEFAULT_MESSAGE =
  "You have unsaved changes on this page. If you leave now, your changes will be lost."

/**
 * Confirmation dialog shown when the user tries to navigate away from a page
 * that has unsaved changes. Closing via overlay/Escape counts as "Stay".
 */
export function UnsavedChangesModal({ open, message, onStay, onLeave }: UnsavedChangesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStay()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            Unsaved changes
          </DialogTitle>
          <DialogDescription className="mt-[3px]">{message ?? DEFAULT_MESSAGE}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-[3px]">
          <Button variant="outline" onClick={onStay}>
            Stay on page
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Leave without saving
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
