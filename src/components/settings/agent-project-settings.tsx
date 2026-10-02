"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { AlertTriangle, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProjectAgentsOverview, useUpdateAgentSettings } from "@/hooks/useApiAccess"
import { useProject } from "@/hooks/useProject"

/** Agent earnings wait as pending transfers until the org has a payout account. */
export function AgentPayoutWarning({ projectId }: { projectId: string }) {
  const { data } = useProjectAgentsOverview(projectId)
  if (!data || data.payouts_ready || data.agents.length === 0) return null
  return (
    <div className="mb-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        Agent earnings are held until your organization connects a payout account.{" "}
        <Link href="/settings/payment" className="underline font-medium">
          Set up payouts
        </Link>
      </p>
    </div>
  )
}

/** "Agent head start": minutes humans wait before they're alerted about a ticket an agent could take. */
export function AgentHeadStartSetting({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectAgentsOverview(projectId)
  const update = useUpdateAgentSettings(projectId)
  const current = data?.agent_head_start_minutes ?? 5
  // null = untouched: follow the saved value.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? String(current)
  const setValue = (next: string) => setDraft(next)

  const save = async () => {
    const minutes = Number(value)
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60) {
      toast.error("Enter whole minutes between 0 and 60")
      return
    }
    try {
      await update.mutateAsync({ agent_head_start_minutes: minutes })
      setDraft(null)
      toast.success("Saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the setting")
    }
  }

  return (
    <div>
      <Label className="text-xs mb-1 block">Agent head start (minutes)</Label>
      <div className="flex gap-2 max-w-xs">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          disabled={isLoading}
          aria-label="Agent head start in minutes"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={update.isPending || isLoading || value === String(current)}
        >
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        When an enabled agent could take a new ticket, your human helpers are alerted only after this many
        minutes — and only if the ticket is still waiting. 0 alerts everyone at once.
      </p>
    </div>
  )
}

const subscribeNoop = () => () => {}

export function readmeBadgeMarkdown(site: string, slug: string): string {
  return `[![Get support on GitHelp](https://img.shields.io/badge/support-GitHelp-6C5CE7)](${site}/support/chat?slug=${encodeURIComponent(slug)})`
}

/** Markdown badge maintainers can put in their README. */
export function ReadmeBadgeCard({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)
  const slug = (project as { slug?: string } | null | undefined)?.slug
  const site = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "")
  if (!slug || !site) return null
  const markdown = readmeBadgeMarkdown(site, slug)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      toast.success("Copied")
    } catch {
      toast.error("Could not copy — select the text and copy it manually")
    }
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Add this badge to your README so users — and their AI assistants — find your support page.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://img.shields.io/badge/support-GitHelp-6C5CE7" alt="Get support on GitHelp" className="mb-3" />
      <div className="flex items-start gap-2">
        <code className="text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1 break-all whitespace-pre-wrap flex-1">
          {markdown}
        </code>
        <Button variant="outline" size="sm" onClick={copy} aria-label="Copy badge markdown">
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
