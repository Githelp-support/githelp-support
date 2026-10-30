import { getPostgresHint } from "@/lib/functions-error"

/**
 * What to do when creating a ticket fails with a guest-limit hint (migration
 * 20261029150000_guest_tickets):
 * - `guest_open_ticket_exists`: the guest already has an open ticket — resume
 *   it (if it's on another project, say so and offer sign-in);
 * - `guest_ticket_limit` (5 per 24 h) / `guest_project_busy` (the project's
 *   hourly guest cap) / `guest_not_allowed`: offer sign-in.
 */
export type GuestTicketCreateAction =
  | { kind: "resume" }
  | { kind: "sign-in"; message: string }

export const GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE =
  "You have an open guest conversation on another project. Sign in to open more."

export const GUEST_TICKET_SIGN_IN_MESSAGES: Record<string, string> = {
  guest_ticket_limit: "You've reached the limit for guest conversations today. Sign in to open more tickets.",
  guest_project_busy:
    "This project is receiving a lot of guest conversations right now. Sign in to open your ticket.",
  guest_not_allowed: "Please sign in to do that.",
}

export function guestTicketCreateAction(error: unknown): GuestTicketCreateAction | null {
  const hint = getPostgresHint(error)
  if (!hint) return null
  if (hint === "guest_open_ticket_exists") return { kind: "resume" }
  const message = GUEST_TICKET_SIGN_IN_MESSAGES[hint]
  return message ? { kind: "sign-in", message } : null
}
