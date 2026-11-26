"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChatMessageMeta } from "./chat-message-parts"
import { getAvatarColorHexForId, SQUIRCLE_RADIUS } from "@/lib/constants"
import { RATES_NOT_CONFIGURED, type TicketRates } from "@/lib/ticket-pricing"

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
 * Intro block above the customer's message thread: project avatar, welcome
 * line, rates, and the sign-in state. Shared by `/support` (Get support tab)
 * and `/support/chat` so both look the same.
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
    <div className="flex gap-3">
      {projectLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={projectLogo}
          alt={`${projectName} logo`}
          className={`size-7.5 ${SQUIRCLE_RADIUS[30]} object-cover shrink-0`}
        />
      ) : (
        <div
          className={`size-7.5 ${SQUIRCLE_RADIUS[30]} flex items-center justify-center text-sm font-medium text-foreground shrink-0`}
          style={{ backgroundColor: primaryColor || getAvatarColorHexForId(projectId) }}
        >
          {projectName?.[0]?.toUpperCase() || "A"}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <ChatMessageMeta name={`${projectName} Team`} time={timestamp} className="mb-1">
            <Badge variant="type">Project</Badge>
          </ChatMessageMeta>
          <p className="text-sm text-foreground whitespace-pre-line">{welcomeText}</p>
        </div>

        {children}

        <div>
          <h4 className="text-ui font-semibold text-foreground mb-3">Rates</h4>
          {isFree ? (
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">Free support</p>
              <p className="text-sm text-muted-foreground">
                {projectName} offers support for free - no payment method needed.
              </p>
            </div>
          ) : rates == null ? (
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">{RATES_NOT_CONFIGURED}</p>
              <p className="text-sm text-muted-foreground">
                {projectName} hasn&apos;t set its support rates yet.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground mb-1 tabular-nums">{rates.startPrice}</p>
              <p className="text-xs text-text-chat-meta">Start price (USD)</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground mb-1 tabular-nums">{rates.first60Price}</p>
              <p className="text-xs text-text-chat-meta">First 60 min (USD/min)</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground mb-1 tabular-nums">{rates.after60Price}</p>
              <p className="text-xs text-text-chat-meta">After 60 min (USD/min)</p>
            </div>
          </div>
          )}
        </div>

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
      </div>
    </div>
  )
}

/**
 * Placeholder in the shape of `CustomerChatIntro` (project avatar, name line,
 * welcome text, the three rate boxes), shown where the welcome message will
 * appear while a fresh chat "writes" it (TicketChat's entrance); the message
 * then fades in in its place.
 */
export function WelcomeMessageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading welcome message"
      data-slot="welcome-skeleton"
      className="flex gap-3 animate-fade-in"
    >
      <Skeleton className={`size-7.5 shrink-0 ${SQUIRCLE_RADIUS[30]}`} />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div>
          <Skeleton className="mb-3 h-3.5 w-12" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-15.5 rounded-lg" />
            <Skeleton className="h-15.5 rounded-lg" />
            <Skeleton className="h-15.5 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
