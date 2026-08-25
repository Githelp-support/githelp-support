"use client"

import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAvatarColorHexForId } from "@/lib/constants"

export interface CustomerChatIntroProps {
  projectId: string
  projectName: string
  projectLogo: string | null
  /** Welcome copy shown as the project team's opening line. */
  welcomeText: string
  timestamp: string
  rates: { startPrice: string; first60Price: string; after60Price: string }
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
  welcomeText,
  timestamp,
  rates,
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
          className="w-8 h-8 rounded-[11px] object-cover shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
          style={{ backgroundColor: getAvatarColorHexForId(projectId) }}
        >
          {projectName?.[0]?.toUpperCase() || "A"}
        </div>
      )}
      <div className="flex-1 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm" style={{ color: "#2E2D31", fontWeight: 550 }}>
              {projectName} Team
            </span>
            <span
              className="text-xs"
              style={{
                color: "rgba(0,0,0,0.5)",
                fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {timestamp}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{welcomeText}</p>
        </div>

        {children}

        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Rates</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">Start price</p>
              <p className="text-sm font-medium text-foreground">USD {rates.startPrice}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
              <p className="text-sm font-medium text-foreground">USD {rates.first60Price}/min</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
              <p className="text-sm font-medium text-foreground">USD {rates.after60Price}/min</p>
            </div>
          </div>
        </div>

        {isAuthenticated && !ticketCreated && (
          <div className="flex items-center gap-2 text-sm text-brand-primary">
            <Check className="w-4 h-4" />
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
            <p className="text-xs text-[#868c98] mt-2">
              You can also start typing your message below to create a ticket. Signing in helps us track your support history.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
