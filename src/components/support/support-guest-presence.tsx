"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/contexts/user-context"
import { useGuestPresence } from "@/hooks/useGuestPresence"

/**
 * Mounted by the support layout: while this browser's own guest is on any
 * /support page (chat, rates, resources, about, tickets), keep their open
 * guest tickets alive so reading the rates doesn't get the conversation
 * closed as "visitor left". `user.guestId` is only set for our own guest.
 *
 * A guest who closed the window and comes back within 30 minutes re-enters
 * their ticket: the first heartbeat reopens it on the server. The page may
 * have loaded the ticket just before that (still closed, or not resumable),
 * so the guest's ticket queries are refetched once the heartbeat is through.
 */
export function SupportGuestPresence() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const isOwnGuest = !user.id && !!user.guestId
  const refreshGuestTicket = useCallback(() => {
    for (const key of ["resumable-ticket", "ticket", "ticket-with-details", "ticket-messages"]) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }, [queryClient])
  useGuestPresence(null, isOwnGuest, refreshGuestTicket)
  return null
}
