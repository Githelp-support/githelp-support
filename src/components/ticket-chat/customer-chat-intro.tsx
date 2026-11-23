"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { WelcomeMessage } from "./welcome-message"
import type { TicketRates } from "@/lib/ticket-pricing"

export interface CustomerChatIntroProps {
  projectId: string
  projectName: string
  projectLogo: string | null
  /** Branding primary color for the fallback avatar (falls back to a deterministic color). */
  primaryColor?: string | null
  /** Welcome copy shown as the project team's opening line. */
  welcomeText: string
  /** Time only ("10:16", see `formatChatTime`), shown next to the team name. */
  timestamp: string
  /** Formatted rates, or `null` while the project has no payment settings (see formatTicketRates). */
  rates: TicketRates | null
  /** The project offers support for free (all three rates are zero): say so instead of listing $0 rates. */
  isFree?: boolean
  isAuthenticated: boolean
  ticketCreated: boolean
  userName?: string | null
  /** Opens the sign-in flow (only rendered while signed out and before a ticket exists). */
  onSignIn: () => void
  /** Extra content inside the signed-out block, e.g. an SLA "continue without signing in" action. */
  signedOutExtra?: ReactNode
  /** Extra content between the welcome line and the rates, e.g. SLA free-help remaining. */
  children?: ReactNode
}

/**
 * Intro block of the customer chat before a ticket exists: a preview of the
 * welcome message (`WelcomeMessage`, with the project's live rates) plus the
 * sign-in state. Shared by `/support` (Get support tab) and `/support/chat`
 * so both look the same. Once a ticket exists the thread shows the stored
 * welcome row instead (see `TicketChat`).
 */
export function CustomerChatIntro({
  projectId,
  projectName,
  projectLogo,
  primaryColor,
  welcomeText,
  timestamp,
  rates,
  isFree = false,
  isAuthenticated,
  ticketCreated,
  userName,
  onSignIn,
  signedOutExtra,
  children,
}: CustomerChatIntroProps) {
  return (
    <WelcomeMessage
      projectId={projectId}
      projectName={projectName}
      projectLogo={projectLogo}
      primaryColor={primaryColor}
      welcomeText={welcomeText}
      timestamp={timestamp}
      rates={rates}
      isFree={isFree}
      footer={
        <>
            {isAuthenticated && !ticketCreated && (
              <div className="flex items-center gap-2 text-sm text-brand-primary">
                <Icon name="fi-rr-check" />
                <span>You are signed in as {userName}</span>
              </div>
            )}

            {!isAuthenticated && !ticketCreated && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={onSignIn}
                  variant="outline"
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                >
                  Sign in
                </Button>
                {signedOutExtra}
                <p className="text-xs text-text-tertiary mt-2">
                  No account needed: just type your question below. Sign in to get notified when a helper replies and to keep your support history.
                </p>
              </div>
            )}
        </>
      }
    >
      {children}
    </WelcomeMessage>
  )
}
