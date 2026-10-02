"use client"

import { Button } from "@/components/ui/button"
import { Bot, Clock, Target, HelpCircle } from "lucide-react"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { formatDuration } from "@/lib/format"

interface RatesAndDetailsContentProps {
  projectName: string
  /** Project offers support for free (see isFreeSupport in lib/ticket-pricing). */
  isFree: boolean
  /** Formatted rates from formatTicketRates (lib/ticket-pricing). */
  startPrice: string
  first60Price: string
  after60Price: string
  /** From useProjectAverageResponseTime; `null` when no ticket has had a response yet. */
  avgResponseSeconds: number | null | undefined
  avgResponseLoading: boolean
  /** The project's enabled AI agents (get_project_public_agents); hidden when empty. */
  agents?: Array<{ id: string; name: string; description: string | null; price_per_answer_smallest_unit: number }>
}

function formatAgentPrice(cents: number): string {
  return cents <= 0 ? "Free" : `$${(cents / 100).toFixed(2)}`
}

/**
 * "Rates and details" tab content — shared between the public /support page
 * tabs and the user-portal /support/rates route.
 */
export function RatesAndDetailsContent({
  projectName,
  isFree,
  startPrice,
  first60Price,
  after60Price,
  avgResponseSeconds,
  avgResponseLoading,
  agents = [],
}: RatesAndDetailsContentProps) {
  return (
    <div className="space-y-12">
      {/* Rates section */}
      <div>
        <h2 className="text-[22px] font-normal text-[#444444] mb-8">{projectName}&apos;s rates</h2>

        {isFree && (
          <p className="text-sm text-[#444444] mb-6">
            {projectName} offers support for free — you won&apos;t be charged and no payment method is needed.
          </p>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-[18px] mb-12">
          {/* Ticket start price */}
          <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#c5b0ef] to-[#b8a0e8] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-[#2d2a49]">{startPrice} USD</div>
            </div>
            <div className="bg-white p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-[#444444] mb-2">Ticket start price</h3>
              <p className="text-sm text-[#868c98]">
                Price for starting the support. You will of course not pay anything if your ticket isn&apos;t picked up.
              </p>
            </div>
          </div>

          {/* First 60 minutes */}
          <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#e7e5fd] to-[#d8d4f7] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-[#2d2a49]">{first60Price} USD/min</div>
            </div>
            <div className="bg-white p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-[#444444] mb-2">First 60 minutes</h3>
              <p className="text-sm text-[#868c98]">
                This is the price per minute for the first 60 minutes. Most issues are solved within that time.
              </p>
            </div>
          </div>

          {/* After 60 minutes */}
          <div className="rounded-lg overflow-hidden border border-[#E1E1E1] shadow-none flex flex-col">
            <div className="bg-gradient-to-br from-[#f9f7ff] to-[#f0ecff] px-6 py-4 text-center">
              <div className="text-lg font-semibold text-[#2d2a49]">{after60Price} USD/min</div>
            </div>
            <div className="bg-white p-6 flex-1">
              <h3 className="text-[14px] font-semibold text-[#444444] mb-2">After 60 minutes</h3>
              <p className="text-sm text-[#868c98]">
                If the support is lengthy, the price drops to {after60Price} USD per minute after the first hour.
              </p>
            </div>
          </div>
        </div>

        {agents.length > 0 && (
          <div className="mb-12" data-testid="ai-agent-rates">
            <h3 className="text-[16px] font-semibold text-[#444444] mb-4">AI agent answers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-[18px]">
              {agents.map((agent) => (
                <div key={agent.id} className="bg-white rounded-lg p-6 shadow-none border border-[#E1E1E1]">
                  <Bot className="h-5 w-5 text-[#444444] mb-2" />
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h4 className="text-[14px] font-semibold text-[#444444]">{agent.name}</h4>
                    <span className="text-lg font-semibold text-[#2d2a49] whitespace-nowrap">
                      {formatAgentPrice(agent.price_per_answer_smallest_unit)}
                    </span>
                  </div>
                  {agent.description && <p className="text-sm text-[#868c98] mb-2">{agent.description}</p>}
                  <p className="text-sm text-[#868c98]">
                    {agent.price_per_answer_smallest_unit > 0
                      ? "Per accepted answer — you only pay if you accept it. If it can't help, the ticket goes to a human helper."
                      : "Free AI answers. If it can't help, the ticket goes to a human helper."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-[18px] mb-8">
          {/* Average response time */}
          <div className="bg-white rounded-lg p-6 shadow-none border border-[#E1E1E1]">
            <Clock className="h-5 w-5 text-[#444444] mb-2" />
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[14px] font-semibold text-[#444444]">Average response time</h3>
              <span title="Average time from a ticket being created until a helper claims it or replies, whichever comes first.">
                <HelpCircle className="h-4 w-4 text-[#868c98]" />
              </span>
            </div>
            <p className="text-lg font-semibold text-[#2d2a49]">
              {avgResponseLoading
                ? "…"
                : avgResponseSeconds == null
                  ? "~"
                  : formatDuration(avgResponseSeconds)}
            </p>
          </div>

          {/* Core team support */}
          <div className="bg-white rounded-lg p-6 shadow-none border border-[#E1E1E1]">
            <Target className="h-5 w-5 text-[#444444] mb-2" />
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[14px] font-semibold text-[#444444]">Core team support</h3>
              <HelpCircle className="h-4 w-4 text-[#868c98]" />
            </div>
            <p className="text-lg font-semibold text-[#2d2a49]">Yes</p>
          </div>
        </div>

        {/* Get an SLA button */}
        <div className="flex items-start gap-2">
          <Button
            title={ILLUSTRATIVE_BUTTON_TOOLTIP}
            variant="outline"
            className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
          >
            Get an SLA
          </Button>
          <HelpCircle className="h-4 w-4 text-[#868c98]" />
        </div>
      </div>
    </div>
  )
}
