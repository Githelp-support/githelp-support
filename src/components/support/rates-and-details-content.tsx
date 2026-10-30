"use client"

import { Button } from "@/components/ui/button"
import { Clock, Target, HelpCircle } from "lucide-react"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { formatDuration } from "@/lib/format"
import { RATES_NOT_CONFIGURED, type TicketRates } from "@/lib/ticket-pricing"

interface RatesAndDetailsContentProps {
  projectName: string
  /** Project offers support for free (see isFreeSupport in lib/ticket-pricing). */
  isFree: boolean
  /** Formatted rates from formatTicketRates (lib/ticket-pricing); `null` while the project has none. */
  rates: TicketRates | null
  /** From useProjectAverageResponseTime; `null` when no ticket has had a response yet. */
  avgResponseSeconds: number | null | undefined
  avgResponseLoading: boolean
}

/**
 * "Rates and details" tab content — shared between the public /support page
 * tabs and the user-portal /support/rates route.
 */
export function RatesAndDetailsContent({
  projectName,
  isFree,
  rates,
  avgResponseSeconds,
  avgResponseLoading,
}: RatesAndDetailsContentProps) {
  return (
    <div className="space-y-12">
      {/* Rates section */}
      <div>
        <h2 className="text-[22px] font-normal text-text-secondary mb-8">{projectName}&apos;s rates</h2>

        {isFree && (
          <p className="text-sm text-text-secondary mb-6">
            {projectName} offers support for free — you won&apos;t be charged and no payment method is needed.
          </p>
        )}

        {/* Pricing cards */}
        {rates == null ? (
          <div className="bg-card rounded-lg p-6 shadow-none border border-border-subtle mb-12">
            <h3 className="text-[14px] font-semibold text-text-secondary mb-2">{RATES_NOT_CONFIGURED}</h3>
            <p className="text-sm text-text-tertiary">
              {projectName} hasn&apos;t set its support rates yet. You won&apos;t see prices here until they do.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-[18px] mb-12">
          {/* Ticket start price */}
          <div className="rounded-lg overflow-hidden border border-border-subtle shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#c5b0ef] to-[#b8a0e8] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-support-header">{rates.startPrice} USD</div>
            </div>
            <div className="bg-background p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-text-secondary mb-2">Ticket start price</h3>
              <p className="text-sm text-text-tertiary">
                Price for starting the support. You will of course not pay anything if your ticket isn&apos;t picked up.
              </p>
            </div>
          </div>

          {/* First 60 minutes */}
          <div className="rounded-lg overflow-hidden border border-border-subtle shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#e7e5fd] to-[#d8d4f7] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-support-header">{rates.first60Price} USD/min</div>
            </div>
            <div className="bg-background p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-text-secondary mb-2">First 60 minutes</h3>
              <p className="text-sm text-text-tertiary">
                This is the price per minute for the first 60 minutes. Most issues are solved within that time.
              </p>
            </div>
          </div>

          {/* After 60 minutes */}
          <div className="rounded-lg overflow-hidden border border-border-subtle shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#f9f7ff] to-[#f0ecff] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-support-header">{rates.after60Price} USD/min</div>
            </div>
            <div className="bg-background p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-text-secondary mb-2">After 60 minutes</h3>
              <p className="text-sm text-text-tertiary">
                If the support is lengthy, the price drops to {rates.after60Price} USD per minute after the first hour.
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-[18px] mb-8">
          {/* Average response time */}
          <div className="bg-card rounded-lg p-6 shadow-none border border-border-subtle">
            <Clock className="h-5 w-5 text-text-secondary mb-2" />
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[14px] font-semibold text-text-secondary">Average response time</h3>
              <span title="Average time from a ticket being created until a helper claims it or replies, whichever comes first.">
                <HelpCircle className="h-4 w-4 text-text-tertiary" />
              </span>
            </div>
            <p className="text-lg font-semibold text-support-header">
              {avgResponseLoading
                ? "…"
                : avgResponseSeconds == null
                  ? "~"
                  : formatDuration(avgResponseSeconds)}
            </p>
          </div>

          {/* Core team support */}
          <div className="bg-card rounded-lg p-6 shadow-none border border-border-subtle">
            <Target className="h-5 w-5 text-text-secondary mb-2" />
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[14px] font-semibold text-text-secondary">Core team support</h3>
              <HelpCircle className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="text-lg font-semibold text-support-header">Yes</p>
          </div>
        </div>

        {/* Get an SLA button */}
        <div className="flex items-start gap-2">
          <Button
            title={ILLUSTRATIVE_BUTTON_TOOLTIP}
            variant="outline"
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-foreground cursor-pointer bg-transparent"
          >
            Get an SLA
          </Button>
          <HelpCircle className="h-4 w-4 text-text-tertiary" />
        </div>
      </div>
    </div>
  )
}
