"use client"

import { useState } from "react"
import { Bot } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  formatUsd,
  type PublicProjectAgent,
  usePublicProjectAgents,
  useSetAgentPreference,
} from "@/hooks/useApiAccess"

/** The ticket fields the opt-in needs. */
export interface AgentOptInTicket {
  id: string
  status: string
  project_id: string
  source?: string | null
  api_context?: Record<string, unknown> | null
}

function parseDollars(value: string): number | null | "invalid" {
  const v = value.trim()
  if (!v) return null
  // Up to $9,999,999.99 — the server ignores anything longer.
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return "invalid"
  return Math.round(Number(v) * 100)
}

/**
 * On the customer's own web ticket while nobody has picked it up: let the
 * project's AI agent answer it (fixed price per accepted answer, charged only
 * on acceptance). Web tickets are human-only until the customer opts in here
 * — the server only lets agents claim web tickets with prefer any/agent.
 */
export function AgentOptIn({ ticket, className }: { ticket: AgentOptInTicket; className?: string }) {
  const { data: agents = [] } = usePublicProjectAgents(ticket.project_id)
  const setPreference = useSetAgentPreference()
  const [budget, setBudget] = useState("")

  if (ticket.status !== "available" || ticket.source === "api" || agents.length === 0) return null

  const prefer = (ticket.api_context?.prefer as string | undefined) ?? "human"
  const optedIn = prefer === "any" || prefer === "agent"
  const currentBudget = ticket.api_context?.max_budget_smallest_unit as number | null | undefined
  const cheapest: PublicProjectAgent = agents[0]
  const priceLabel = cheapest.price_per_answer_smallest_unit > 0
    ? `${formatUsd(cheapest.price_per_answer_smallest_unit)} per accepted answer`
    : "free"

  const save = async (next: "any" | "human") => {
    const parsed = parseDollars(budget)
    if (parsed === "invalid") {
      toast.error("Enter a budget like 25 or 25.50, or leave it empty.")
      return
    }
    // Below every agent's price no agent could take the ticket.
    if (next === "any" && parsed !== null && parsed < cheapest.price_per_answer_smallest_unit) {
      toast.error(`The AI agent's price is ${formatUsd(cheapest.price_per_answer_smallest_unit)}; set a budget of at least that, or leave it empty.`)
      return
    }
    try {
      await setPreference.mutateAsync({
        ticketId: ticket.id,
        prefer: next,
        ...(next === "any" ? { maxBudgetSmallestUnit: parsed } : {}),
      })
      toast.success(next === "any" ? "The AI agent may answer this ticket." : "Only human helpers will answer this ticket.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your choice")
    }
  }

  return (
    <div
      className={cn(
        "mx-4 mb-3 flex items-start gap-3 rounded-[10px] border border-border bg-muted/40 px-4 py-3",
        className,
      )}
      data-testid="agent-opt-in"
    >
      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 space-y-2 text-sm text-foreground">
        {optedIn ? (
          <>
            <p className="font-medium">{cheapest.name} (AI agent) may answer while you wait for a helper.</p>
            <p className="text-muted-foreground">
              {priceLabel === "free" ? "Its answers are free." : `${priceLabel} — you are only charged if you accept its answer.`}
              {typeof currentBudget === "number" ? ` Your limit: ${formatUsd(currentBudget)}.` : ""}
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 cursor-pointer"
              disabled={setPreference.isPending}
              onClick={() => void save("human")}
            >
              Only human helpers, please
            </Button>
          </>
        ) : (
          <>
            <p className="font-medium">Want a faster answer from the project&apos;s AI agent ({cheapest.name})?</p>
            <p className="text-muted-foreground">
              {priceLabel === "free"
                ? "Its answers are free. If it can't help, choose “Ask for a human instead” in the chat."
                : `${priceLabel}, only charged if you accept its answer. If it can't help, choose “Ask for a human instead” in the chat.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {cheapest.price_per_answer_smallest_unit > 0 && (
                <Input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Max price (USD, optional)"
                  inputMode="decimal"
                  className="h-8 w-48 bg-white"
                  aria-label="Maximum price for an AI agent answer"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={setPreference.isPending}
                onClick={() => void save("any")}
              >
                Let the AI agent answer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
