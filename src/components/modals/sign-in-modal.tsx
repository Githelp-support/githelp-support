"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SignInOptions } from "@/components/auth/sign-in-options"

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Path (relative to the site origin) to land on after sign-in. Defaults to
   * returning the visitor to the page they opened the modal from.
   */
  confirmPath?: string
  description?: string
}

/**
 * Sign-in options in a modal so a visitor can authenticate without leaving
 * the page (e.g. the public support/ticket page, where the URL carries the
 * project context they came in with).
 */
export function SignInModal({ isOpen, onClose, confirmPath, description }: SignInModalProps) {
  // Resolved lazily so `window` is only touched on the client, and so the
  // redirect always reflects the URL at the time the modal is opened.
  const resolvedConfirmPath =
    confirmPath ??
    (typeof window !== "undefined"
      ? `/auth/confirmed?redirect=${encodeURIComponent(window.location.href)}&skipOnboarding=true`
      : "/auth/confirmed")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            {description ?? "Signing in helps us track your support history."}
          </DialogDescription>
        </DialogHeader>
        <SignInOptions confirmPath={resolvedConfirmPath} dividerBgClassName="bg-background" />
      </DialogContent>
    </Dialog>
  )
}
