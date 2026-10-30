"use client"

import { useUser } from "@/contexts/user-context"
import { useGuestPresence } from "@/hooks/useGuestPresence"

/**
 * Mounted by the support layout: while this browser's own guest is on any
 * /support page (chat, rates, resources, about, tickets), keep their open
 * guest tickets alive so reading the rates doesn't get the conversation
 * closed as "visitor left". `user.guestId` is only set for our own guest.
 */
export function SupportGuestPresence() {
  const { user } = useUser()
  const isOwnGuest = !user.id && !!user.guestId
  useGuestPresence(null, isOwnGuest)
  return null
}
