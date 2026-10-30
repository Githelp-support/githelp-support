"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useGuestAdoptionConfirmRequest } from "@/lib/guest-adoption-confirm"

/**
 * Asks the signed-in user before a guest conversation is linked to their
 * account (see lib/guest-adoption), naming that account. Only the buttons
 * decide: dismissing (Escape / outside click / close) means "ask me later" —
 * the saved guest session is kept and nothing is linked.
 */
export function GuestAdoptionConfirmDialog() {
  const request = useGuestAdoptionConfirmRequest()
  if (!request) return null
  return (
    <Dialog open onOpenChange={(open) => { if (!open) request.resolve("later") }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link your guest conversation to this account?</DialogTitle>
          <DialogDescription>
            You chatted as a guest in this browser. Linking keeps the conversation and lets the helper take it on.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm text-foreground space-y-1">
          {request.tickets.map((ticket) => (
            <li key={ticket.id}>
              {ticket.title}
              {ticket.project_name ? ` — ${ticket.project_name}` : ""}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Linking to: <span className="font-medium text-foreground">{request.account}</span>
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => request.resolve("discard")}>
            Not mine — discard
          </Button>
          <Button variant="lavender" onClick={() => request.resolve("link")}>
            Link to my account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
