import { useSyncExternalStore } from "react"
import type { GuestAdoptionChoice, GuestTicketPreview } from "@/lib/guest-adoption"

/**
 * "Link your guest conversation to this account?" — a promise-based request
 * the adoption flow awaits; <GuestAdoptionConfirmDialog /> (root layout)
 * renders it. Only one request is shown at a time.
 */
export interface GuestAdoptionConfirmRequest {
  tickets: GuestTicketPreview[]
  /** E-mail or name of the signed-in account the conversation would join. */
  account: string
  resolve: (choice: GuestAdoptionChoice) => void
}

let current: GuestAdoptionConfirmRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function requestGuestAdoptionConfirm(tickets: GuestTicketPreview[], account: string): Promise<GuestAdoptionChoice> {
  current?.resolve("superseded")
  return new Promise<GuestAdoptionChoice>((resolve) => {
    let settled = false
    const request: GuestAdoptionConfirmRequest = {
      tickets,
      account,
      resolve: (choice) => {
        if (settled) return
        settled = true
        if (current === request) current = null
        emit()
        resolve(choice)
      },
    }
    current = request
    emit()
  })
}

/** Close an open request for the user (another tab took over / signed out): not remembered as "later". */
export function cancelGuestAdoptionConfirm(): void {
  current?.resolve("superseded")
}

export function getGuestAdoptionConfirmRequest(): GuestAdoptionConfirmRequest | null {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useGuestAdoptionConfirmRequest(): GuestAdoptionConfirmRequest | null {
  return useSyncExternalStore(subscribe, getGuestAdoptionConfirmRequest, () => null)
}
