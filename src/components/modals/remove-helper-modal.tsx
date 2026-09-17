"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RemoveHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  helperName: string
  isRemoving?: boolean
  onConfirm: () => void
}

/**
 * Confirmation dialog shown before a helper is removed from the project.
 * Removing archives the helper (their history is kept) and ends their
 * membership; it does not delete anything.
 */
export function RemoveHelperModal({
  open,
  onOpenChange,
  helperName,
  isRemoving = false,
  onConfirm,
}: RemoveHelperModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!isRemoving || next) && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isRemoving}>
        <DialogHeader>
          <DialogTitle>Remove {helperName}?</DialogTitle>
          <DialogDescription className="mt-[3px]">
            {helperName} will lose access to this project&apos;s helper tools and will no longer
            receive new tickets. Their tickets, logged time and payouts are kept for your records.
            You can invite them again later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-[3px]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? "Removing..." : "Remove helper"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
