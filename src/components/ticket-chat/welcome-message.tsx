"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { ChatMessageMeta } from "./chat-message-parts"
import { getAvatarColorHexForId, SQUIRCLE_RADIUS } from "@/lib/constants"
import { RATES_NOT_CONFIGURED, type TicketRates } from "@/lib/ticket-pricing"

export interface WelcomeMessageProps {
  projectId: string
  projectName: string
  projectLogo: string | null
  /** Branding primary color for the fallback avatar (falls back to a deterministic color). */
  primaryColor?: string | null
  /** Welcome copy shown as the project team's opening line. */
  welcomeText: string
  /** Time only ("10:16", see `formatChatTime`), shown next to the team name. */
  timestamp?: string | null
  /** Formatted rates, or `null` when there are none (see `missingRates`). */
  rates: TicketRates | null
  /** Support is free: say so instead of listing $0 rates. */
  isFree?: boolean
  /** Sentence under "Free support". Defaults to "{projectName} offers support for free - no payment method needed." */
  freeText?: string | null
  /**
   * What to show when `rates` is null and support is not free:
   * `"not-configured"` (default) is the "Rates not configured" card of the
   * live preview; `"hidden"` leaves the Rates section out (a stored welcome
   * that saved no rates says nothing about them).
   */
  missingRates?: "not-configured" | "hidden"
  /** Extra content between the welcome line and the rates, e.g. SLA free-help remaining. */
  children?: ReactNode
  /** Extra content below the rates, in the same column (the intro's sign-in state). */
  footer?: ReactNode
}

/**
 * The project team's welcome message: project avatar, "{project} Team" with
 * the Project badge, the welcome line and the rates (or the free-support
 * sentence). Rendered by `CustomerChatIntro` as the live preview before a
 * ticket exists, and by `TicketChat` for the stored welcome row of a ticket.
 */
export function WelcomeMessage({
  projectId,
  projectName,
  projectLogo,
  primaryColor,
  welcomeText,
  timestamp,
  rates,
  isFree = false,
  freeText,
  missingRates = "not-configured",
  children,
  footer,
}: WelcomeMessageProps) {
  const showRates = isFree || rates != null || missingRates === "not-configured"
  return (
    <div data-slot="chat-welcome" className="flex gap-3">
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

        {showRates && (
        <div>
          <h4 className="text-ui font-semibold text-foreground mb-3">Rates</h4>
          {isFree ? (
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">Free support</p>
              <p className="text-sm text-muted-foreground">
                {freeText || `${projectName} offers support for free - no payment method needed.`}
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
              <p className="text-xs text-muted-foreground">Start price (USD)</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground mb-1 tabular-nums">{rates.first60Price}</p>
              <p className="text-xs text-muted-foreground">First 60 min (USD/min)</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground mb-1 tabular-nums">{rates.after60Price}</p>
              <p className="text-xs text-muted-foreground">After 60 min (USD/min)</p>
            </div>
          </div>
          )}
        </div>
        )}

        {footer}
      </div>
    </div>
  )
}
