/**
 * One-time entrance of a new ticket's welcome group in TicketChat. The create
 * mutation marks the ticket; the creator's chat reveals the welcome once and
 * clears the mark, so reloads, later visits and helpers see it immediately.
 */
const key = (ticketId: string) => `welcome-reveal:${ticketId}`

/** Delay before the welcome group appears in a freshly created ticket's chat. */
export const WELCOME_REVEAL_DELAY_MS = 400

export function markWelcomeReveal(ticketId: string) {
  try {
    sessionStorage.setItem(key(ticketId), "1")
  } catch {
    /* storage unavailable: no entrance */
  }
}

export function hasWelcomeReveal(ticketId: string): boolean {
  try {
    return sessionStorage.getItem(key(ticketId)) === "1"
  } catch {
    return false
  }
}

export function clearWelcomeReveal(ticketId: string) {
  try {
    sessionStorage.removeItem(key(ticketId))
  } catch {
    /* ignore */
  }
}
