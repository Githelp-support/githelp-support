import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { TicketUnavailableNotice } from "./ticket-unavailable-notice"
import { AUTH_CALLBACK_FAILURE_COPY, authCallbackFailure, signInRetryHref, signInSubtitle } from "@/lib/sign-in-href"

describe("TicketUnavailableNotice", () => {
  it("says the conversation is being linked while adoption is pending", () => {
    render(<TicketUnavailableNotice linking failedFinal={false} newConversationHref="/support/chat" />)
    expect(screen.getByText("Linking your conversation…")).toBeInTheDocument()
    expect(screen.queryByText("Ticket not found")).not.toBeInTheDocument()
  })

  it("shows not found without a fresh-start link while nothing failed for good", () => {
    render(<TicketUnavailableNotice linking={false} failedFinal={false} newConversationHref="/support/chat" />)
    expect(screen.getByText("Ticket not found")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Start a new conversation" })).not.toBeInTheDocument()
  })

  it("offers a new conversation after a definitive refusal", () => {
    render(<TicketUnavailableNotice linking={false} failedFinal newConversationHref="/support/chat?project=p1" />)
    expect(screen.getByRole("link", { name: "Start a new conversation" })).toHaveAttribute(
      "href",
      "/support/chat?project=p1",
    )
  })
})

describe("signInRetryHref (cancelled OAuth on /auth/confirmed)", () => {
  it("keeps the redirect and skipOnboarding", () => {
    expect(signInRetryHref("/support/chat?ticket=t1&project=p1", true)).toBe(
      "/auth/signin?redirect=%2Fsupport%2Fchat%3Fticket%3Dt1%26project%3Dp1&skipOnboarding=true",
    )
    expect(signInRetryHref("/tickets", false)).toBe("/auth/signin?redirect=%2Ftickets")
    expect(signInRetryHref(null, false)).toBe("/auth/signin")
    expect(signInRetryHref(null, true)).toBe("/auth/signin?skipOnboarding=true")
  })
})

describe("TicketUnavailableNotice after 'later'", () => {
  it("never says not found while a deferred key is pending, and offers 'Link conversation'", () => {
    const onLink = vi.fn()
    render(<TicketUnavailableNotice linking deferred failedFinal={false} newConversationHref="/support/chat" onLink={onLink} />)
    expect(screen.queryByText("Ticket not found")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Link conversation" }))
    expect(onLink).toHaveBeenCalledTimes(1)
  })
})

describe("authCallbackFailure (failed PKCE exchange)", () => {
  it("a code without a verifier in this browser: open it in the same browser", () => {
    expect(authCallbackFailure("?redirect=%2Fsupport&code=abc", "", "pkce_code_verifier_not_found")).toBe("wrong-browser")
    expect(authCallbackFailure("?redirect=%2Fsupport&code=abc", "", null)).toBe("wrong-browser")
    expect(authCallbackFailure("?code=abc", "", "unknown")).toBe("failed")
  })

  it("an expired or already used link", () => {
    expect(authCallbackFailure("", "#error=access_denied&error_code=otp_expired&error_description=x")).toBe("expired")
    expect(authCallbackFailure("?error=access_denied&error_code=otp_expired")).toBe("expired")
    expect(authCallbackFailure("?code=abc", "", "flow_state_not_found")).toBe("expired")
    expect(authCallbackFailure("?code=abc", "", "bad_code_verifier")).toBe("expired")
  })

  it("a cancelled provider sign-in just goes back", () => {
    expect(authCallbackFailure("?error=access_denied&error_description=cancelled")).toBe("cancelled")
  })

  it("other OAuth errors: try again; nothing in the URL is null", () => {
    expect(authCallbackFailure("?error=server_error")).toBe("failed")
    expect(authCallbackFailure("?code=abc", "", "unexpected_failure")).toBe("failed")
    expect(authCallbackFailure("?redirect=%2Ftickets")).toBeNull()
  })

  it("has distinct copy for each failure and never echoes URL text", () => {
    expect(AUTH_CALLBACK_FAILURE_COPY.expired.message).toBe("This sign-in link has expired or was already used.")
    expect(AUTH_CALLBACK_FAILURE_COPY.expired.action).toBe("Request a new one.")
    expect(AUTH_CALLBACK_FAILURE_COPY["wrong-browser"].message).toContain("same browser")
    expect(AUTH_CALLBACK_FAILURE_COPY.failed.message).toBe("Sign-in didn\u2019t complete.")
    expect(AUTH_CALLBACK_FAILURE_COPY.failed.action).toBe("Please try again.")
  })
})

describe("TicketUnavailableNotice — expired key", () => {
  it("says the conversation wasn't linked in time, not 'may have been removed'", () => {
    render(<TicketUnavailableNotice linking={false} failedFinal={false} expired newConversationHref="/support/chat?project=p1" />)
    expect(screen.getByText(/wasn.t linked to your account in time/)).toBeInTheDocument()
    expect(screen.queryByText(/may have been removed/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start a new conversation" })).toHaveAttribute("href", "/support/chat?project=p1")
  })
})

describe("signInSubtitle", () => {
  it("talks to support customers about getting help, not the dashboard", () => {
    expect(signInSubtitle(true)).toBe("Sign in to get help and follow your support conversations.")
    expect(signInSubtitle(false)).toBe("Sign in to access your admin and helper dashboard")
  })
})
