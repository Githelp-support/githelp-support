import { describe, it, expect } from "vitest"
import {
  GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE,
  GUEST_TICKET_SIGN_IN_MESSAGES,
  guestTicketCreateAction,
} from "../guest-ticket-errors"
import { chooseSupportSignInRedirect, getSupportSignInRedirect, setSupportSignInRedirect } from "../support-sign-in-redirect"

describe("guestTicketCreateAction", () => {
  it("resumes on guest_open_ticket_exists", () => {
    expect(guestTicketCreateAction({ hint: "guest_open_ticket_exists" })).toEqual({ kind: "resume" })
  })

  it("asks to sign in with distinct copy for the limits", () => {
    const limit = guestTicketCreateAction({ hint: "guest_ticket_limit" })
    const busy = guestTicketCreateAction({ hint: "guest_project_busy" })
    expect(limit).toEqual({ kind: "sign-in", message: GUEST_TICKET_SIGN_IN_MESSAGES.guest_ticket_limit })
    expect(busy).toEqual({ kind: "sign-in", message: GUEST_TICKET_SIGN_IN_MESSAGES.guest_project_busy })
    expect(limit).not.toEqual(busy)
    expect(guestTicketCreateAction({ hint: "guest_not_allowed" })?.kind).toBe("sign-in")
  })

  it("leaves other errors to the generic handling", () => {
    expect(guestTicketCreateAction({ hint: "ticket_id_invalid" })).toBeNull()
    expect(guestTicketCreateAction({ hint: "ticket_prices_changed" })).toBeNull()
    expect(guestTicketCreateAction(new Error("x"))).toBeNull()
    expect(guestTicketCreateAction(null)).toBeNull()
  })

  it("says when the open conversation is on another project", () => {
    expect(GUEST_OPEN_TICKET_ELSEWHERE_MESSAGE).toBe(
      "You have an open guest conversation on another project. Sign in to open more.",
    )
  })
})

describe("chooseSupportSignInRedirect", () => {
  it("returns to the conversation when there is a ticket", () => {
    expect(chooseSupportSignInRedirect({ ticketId: "t 1", projectId: "p1", fallback: "/support?slug=acme" })).toBe(
      "/support/chat?ticket=t%201&project=p1",
    )
  })

  it("returns to the project's chat without a ticket", () => {
    expect(chooseSupportSignInRedirect({ ticketId: null, projectId: "p1", fallback: "/support?slug=acme" })).toBe(
      "/support/chat?project=p1",
    )
  })

  it("falls back to the current page without a project", () => {
    expect(chooseSupportSignInRedirect({ ticketId: "t1", projectId: null, fallback: "/support?slug=acme" })).toBe(
      "/support?slug=acme",
    )
  })

  it("publishes the redirect for the other entry points", () => {
    setSupportSignInRedirect("/support/chat?ticket=t1&project=p1")
    expect(getSupportSignInRedirect()).toBe("/support/chat?ticket=t1&project=p1")
    setSupportSignInRedirect(null)
    expect(getSupportSignInRedirect()).toBeNull()
  })
})
