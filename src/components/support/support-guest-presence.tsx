"use client"

import { useUser } from "@/contexts/user-context"
import { useGuestPresence } from "@/hooks/useGuestPresence"

/**
 * Mounted by the support layout: while this browser's own guest is on any
 * /support page (chat, rates, resources, about, tickets), keep their open
 * guest tickets alive so reading the rates doesn't get the conversation
 * closed as "visitor left". `user.guestId` is only set for our own guest.
 * This is also the one place that reports the guest closing the window
 * (`pagehide` in `useGuestPresence`); the layout stays mounted across in-app
 * navigation, so moving between /support pages never counts as leaving.
 */
export function SupportGuestPresence() {
  const { user } = useUser()
  const isOwnGuest = !user.id && !!user.guestId
  useGuestPresence(null, isOwnGuest)
  return null
}
