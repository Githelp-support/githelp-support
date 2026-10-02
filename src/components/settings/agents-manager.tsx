"use client"

import { useState } from "react"
import { Bot, ChevronDown, ChevronRight, Copy, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ApiKeysManager } from "@/components/settings/api-keys-manager"
import {
  formatUsd,
  useApiWebhooks,
  useCreateAgent,
  useCreateApiWebhook,
  useDeleteAgent,
  useDeleteApiWebhook,
  useProjectAgents,
  useTestApiWebhook,
  useUpdateAgent,
  type ProjectAgent,
} from "@/hooks/useApiAccess"

/** Stripe can't charge less than $0.50, so an agent is free or charges at least that. */
const MIN_PAID_PRICE_CENTS = 50

function dollarsToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(Number(trimmed) * 100)
  if (cents > 0 && cents < MIN_PAID_PRICE_CENTS) return null
  return cents
}

/** Roughly what the project receives per paid answer after Stripe's card fee (2.9% + $0.30). */
export function netAfterStripeFees(cents: number): number {
  if (cents <= 0) return 0
  return Math.max(0, cents - Math.round(cents * 0.029) - 30)
}

function NetPriceHint({ price }: { price: string }) {
  const cents = dollarsToCents(price || "0")
  if (cents === null || cents === 0) return null
  return (
    <p className="text-[11px] text-muted-foreground mt-1">
      You receive ≈ {formatUsd(netAfterStripeFees(cents))} per answer after Stripe fees.
    </p>
  )
}

/** "online" when the agent called GitHelp in the last 2 minutes, else how long ago. */
export function lastSeenLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never connected"
  const minutes = Math.floor((now - Date.parse(iso)) / 60000)
  if (minutes < 2) return "online"
  if (minutes < 60) return `last seen ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `last seen ${hours} h ago`
  return `last seen ${Math.floor(hours / 24)} days ago`
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied")
  } catch {
    toast.error("Could not copy — select the text and copy it manually")
  }
}

function AgentWebhooks({ agentId }: { agentId: string }) {
  const { data: webhooks = [], isLoading } = useApiWebhooks(agentId)
  const createWebhook = useCreateApiWebhook(agentId)
  const deleteWebhook = useDeleteApiWebhook(agentId)
  const testWebhook = useTestApiWebhook(agentId)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmed = url.trim()
    if (!trimmed.startsWith("https://")) {
      toast.error("The webhook URL must start with https://")
      return
    }
    try {
      const result = await createWebhook.mutateAsync({ url: trimmed })
      setSecret(result.signing_secret)
      setUrl("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the webhook")
    }
  }

  return (
    <div>
      {secret && (
        <div className="mb-3 p-3 border border-border rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground mb-2">
            Signing secret (shown once). Verify <code className="font-mono">X-Githelp-Signature: sha256=&lt;hmac&gt;</code>.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-white border border-border rounded px-2 py-1 break-all flex-1">
              {secret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(secret)}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-2">Loading webhooks…</p>
      ) : webhooks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No webhook. The agent can also long-poll with the wait_for_update tool.
        </p>
      ) : (
        <div className="divide-y divide-[rgba(0,0,0,0.06)]">
          {webhooks.map((hook) => (
            <div key={hook.id} className="flex items-center justify-between py-2 gap-3">
              <p className="text-xs text-muted-foreground truncate">
                {hook.url_masked}
                {hook.disabled_at ? " · disabled after repeated failures" : ""}
                {hook.failure_count > 0 && !hook.disabled_at ? ` · ${hook.failure_count} recent failures` : ""}
              </p>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await testWebhook.mutateAsync(hook.id)
                      toast.success("Test event delivered")
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Test failed")
                    }
                  }}
                  disabled={testWebhook.isPending}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleteWebhook.isPending}
                  onClick={() => {
                    if (!window.confirm("Remove this webhook? The agent stops receiving callbacks there.")) return
                    deleteWebhook.mutate(hook.id, {
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the webhook"),
                    })
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-agent.example/githelp" />
        <Button variant="outline" size="sm" onClick={handleCreate} disabled={createWebhook.isPending}>
          {createWebhook.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  )
}

function AgentRow({ agent, projectId }: { agent: ProjectAgent; projectId: string }) {
  const updateAgent = useUpdateAgent(projectId)
  const deleteAgent = useDeleteAgent(projectId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description ?? "")
  const [price, setPrice] = useState((agent.price_per_answer_smallest_unit / 100).toFixed(2))
  const [maxConcurrent, setMaxConcurrent] = useState(String(agent.max_concurrent_tickets))

  const saveDetails = async () => {
    if (!name.trim()) {
      toast.error("Give the agent a name")
      return
    }
    const cents = dollarsToCents(price)
    if (cents === null) {
      toast.error("Enter a price in USD of at least 0.50, e.g. 5 or 4.99 (0 for free)")
      return
    }
    const concurrent = Number(maxConcurrent)
    if (!Number.isInteger(concurrent) || concurrent < 1 || concurrent > 100) {
      toast.error("Concurrent tickets must be between 1 and 100")
      return
    }
    const changes = {
      ...(name.trim() !== agent.name ? { name: name.trim() } : {}),
      ...((description.trim() || null) !== (agent.description ?? null) ? { description: description.trim() || null } : {}),
      ...(cents !== agent.price_per_answer_smallest_unit ? { price_per_answer_smallest_unit: cents } : {}),
      ...(concurrent !== agent.max_concurrent_tickets ? { max_concurrent_tickets: concurrent } : {}),
    }
    if (Object.keys(changes).length === 0) return
    try {
      await updateAgent.mutateAsync({ agentId: agent.id, ...changes })
      toast.success(
        "price_per_answer_smallest_unit" in changes
          ? "Saved — tickets already claimed keep their price"
          : "Saved",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the agent")
    }
  }

  const handleToggle = (checked: boolean) => {
    if (
      !checked &&
      !window.confirm(
        `Turn off ${agent.name}? Tickets it is working on are handed to your human helpers, and it can't take those tickets back when you turn it on again.`,
      )
    ) return
    updateAgent.mutate(
      { agentId: agent.id, enabled: checked },
      {
        onSuccess: (result) => {
          const handed = result?.tickets_handed_over ?? 0
          toast.success(
            checked
              ? `${agent.name} is on`
              : handed
              ? `${agent.name} is off — ${handed} open ticket${handed === 1 ? "" : "s"} handed to human helpers`
              : `${agent.name} is off`,
          )
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the agent"),
      },
    )
  }

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete ${agent.name}? Its API keys and webhooks stop working, and tickets it is working on are handed to your human helpers.`,
      )
    ) return
    try {
      const result = await deleteAgent.mutateAsync(agent.id)
      const handed = result?.tickets_handed_over ?? 0
      toast.success(handed ? `Agent deleted — ${handed} open ticket${handed === 1 ? "" : "s"} handed to human helpers` : "Agent deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the agent")
    }
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <button className="flex items-center gap-2 min-w-0 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <Bot className="w-4 h-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {agent.price_per_answer_smallest_unit === 0
                ? "Free"
                : `${formatUsd(agent.price_per_answer_smallest_unit)} per accepted answer`}{" "}
              · up to {agent.max_concurrent_tickets} tickets at once
            </p>
            <p className="text-xs text-muted-foreground truncate">
              <span className={lastSeenLabel(agent.last_seen_at) === "online" ? "text-status-success-text" : undefined}>
                {lastSeenLabel(agent.last_seen_at)}
              </span>
              {" · "}
              {agent.open_tickets ?? 0} open · {agent.accepted_count ?? 0} accepted answers ·{" "}
              {formatUsd(agent.revenue_smallest_unit ?? 0)} earned (before fees)
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={agent.enabled}
            disabled={updateAgent.isPending}
            aria-label={agent.enabled ? "Disable agent" : "Enable agent"}
            onCheckedChange={handleToggle}
          />
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteAgent.isPending}>
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-6 space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Price per accepted answer (USD)</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                <NetPriceHint price={price} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Description (shown to customers)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-end gap-3">
              <div className="max-w-[12rem]">
                <Label className="text-xs mb-1 block">Max tickets at once</Label>
                <Input value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} inputMode="numeric" />
              </div>
              <Button variant="outline" size="sm" onClick={saveDetails} disabled={updateAgent.isPending}>
                {updateAgent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">API keys</p>
            <p className="text-xs text-muted-foreground mb-2">
              Your agent connects to the GitHelp MCP server with one of these keys to claim and answer tickets.
            </p>
            <ApiKeysManager agentId={agent.id} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Callback webhook</p>
            <p className="text-xs text-muted-foreground mb-2">
              GitHelp POSTs new tickets, customer replies and completion decisions here, with the full message
              content.
            </p>
            <AgentWebhooks agentId={agent.id} />
          </div>
        </div>
      )}
    </div>
  )
}

/** A project's AI agents: create, price, enable, keys and webhooks. */
export function AgentsManager({ projectId }: { projectId: string }) {
  const { data: agents = [], isLoading, error } = useProjectAgents(projectId)
  const createAgent = useCreateAgent(projectId)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [maxConcurrent, setMaxConcurrent] = useState("5")

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give the agent a name")
      return
    }
    const cents = dollarsToCents(price || "0")
    if (cents === null) {
      toast.error("Enter a price in USD of at least 0.50, e.g. 5 or 4.99 (0 for free)")
      return
    }
    const concurrent = Number(maxConcurrent)
    if (!Number.isInteger(concurrent) || concurrent < 1 || concurrent > 100) {
      toast.error("Concurrent tickets must be between 1 and 100")
      return
    }
    try {
      await createAgent.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        price_per_answer_smallest_unit: cents,
        max_concurrent_tickets: concurrent,
      })
      toast.success("Agent created — now create an API key for it")
      setShowForm(false)
      setName("")
      setDescription("")
      setPrice("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the agent")
    }
  }

  if (error) {
    return <p className="text-sm text-muted-foreground py-3">{error.message}</p>
  }

  return (
    <div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-3">Loading agents…</p>
      ) : agents.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-3">No AI agents yet.</p>
      ) : (
        <div className="divide-y divide-[rgba(0,0,0,0.06)]">
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} projectId={projectId} />
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 p-4 border border-border rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support bot" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Price per accepted answer (USD)</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0 = free" inputMode="decimal" />
              <NetPriceHint price={price} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Description (shown to customers)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Answers usage and configuration questions about the library"
            />
          </div>
          <div className="max-w-[12rem]">
            <Label className="text-xs mb-1 block">Max tickets at once</Label>
            <Input value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} inputMode="numeric" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={createAgent.isPending} variant="lavender" size="sm">
              {createAgent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create agent"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add AI agent
        </Button>
      )}
    </div>
  )
}
