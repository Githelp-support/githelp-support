/**
 * How a guest (a visitor who isn't signed in) is named in ticket lists and
 * threads. A guest is an anonymous auth user, so the only things known about
 * them are their user id (`tickets.created_by`, the same for every ticket
 * they open in that guest session) and an email if one is ever stored.
 */

export interface GuestIdentity {
  /** Stable guest identifier: the anonymous user's id. */
  id?: string | null
  email?: string | null
}

export interface GuestLabel {
  /** Text shown as the guest's name. */
  label: string
  /** Full email or identifier for the tooltip; null when nothing identifies the guest. */
  full: string | null
}

const GUEST_NAME = "Guest"
const GUEST_CODE_LENGTH = 4

/** Email when there is one, else "Guest · " + the first 4 characters of the id, else "Guest". */
export function guestLabel(guest?: GuestIdentity | null): GuestLabel {
  const email = guest?.email?.trim()
  if (email) return { label: email, full: email }
  const id = guest?.id?.trim()
  if (id) return { label: `${GUEST_NAME} · ${id.slice(0, GUEST_CODE_LENGTH)}`, full: id }
  return { label: GUEST_NAME, full: null }
}
