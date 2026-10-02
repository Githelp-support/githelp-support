"use client"

import { useState } from "react"
import Link from "next/link"
import { Activity, ChevronDown, ChevronRight, Copy, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatUsd,
  mcpInstallLinks,
  useApiKeys,
  useApiKeyUsage,
  useCreateApiKey,
  useRevokeApiKey,
  useUpdateApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/hooks/useApiAccess"

/** Default for "auto-approve charges up to" on new customer keys. */
export const DEFAULT_AUTO_APPROVE_USD = "50"

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied")
  } catch {
    toast.error("Could not copy — select the text and copy it manually")
  }
}

export function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-start gap-2">
        <code className="text-xs font-mono bg-white border border-border rounded px-2 py-1 break-all whitespace-pre-wrap flex-1">
          {value}
        </code>
        <Button variant="outline" size="sm" onClick={() => copy(value)}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

/** One-click install buttons for Cursor and VS Code (OAuth sign-in, or with a key header). */
export function McpInstallButtons({ apiKey }: { apiKey?: string }) {
  const links = mcpInstallLinks(apiKey)
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={links.cursor}>Add to Cursor</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={links.vscode}>Add to VS Code</a>
      </Button>
    </div>
  )
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "never"
}

/** "" → null (no limit); otherwise cents. Returns undefined when invalid. */
export function parseUsdToCents(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined
  return Math.round(Number(trimmed) * 100)
}

function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ""
  return (cents / 100).toFixed(2).replace(/\.00$/, "")
}

function KeyActivity({ keyId, agentId }: { keyId: string; agentId?: string | null }) {
  const { data: events = [], isLoading, error } = useApiKeyUsage(keyId, agentId)
  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Loading activity…</p>
  if (error) return <p className="text-xs text-destructive py-2">{error.message}</p>
  if (events.length === 0) return <p className="text-xs text-muted-foreground py-2">No activity yet.</p>
  return (
    <ul className="text-xs py-2 space-y-1">
      {events.slice(0, 50).map((ev, i) => (
        <li key={`${ev.created_at}-${i}`} className="flex flex-wrap gap-x-2 text-muted-foreground">
          <span className="tabular-nums">{new Date(ev.created_at).toLocaleString()}</span>
          <span className="font-mono text-foreground">{ev.tool}</span>
          <span className={ev.status === "ok" ? "text-status-success-text" : "text-destructive"}>
            {ev.status === "ok" ? "ok" : ev.error_code ?? "error"}
          </span>
          {ev.ticket_id && (
            <Link
              href={agentId ? `/helper/tickets/${ev.ticket_id}` : `/support/chat?ticket=${ev.ticket_id}`}
              className="underline"
            >
              ticket
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

function KeyRow({ apiKey, agentId, onRevoke, revoking }: {
  apiKey: ApiKey
  agentId?: string | null
  onRevoke: (id: string) => void
  revoking: boolean
}) {
  const isAgent = Boolean(agentId)
  const updateKey = useUpdateApiKey(agentId)
  const [editing, setEditing] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [budget, setBudget] = useState(centsToInput(apiKey.max_ticket_budget_smallest_unit))
  const [autoApprove, setAutoApprove] = useState(centsToInput(apiKey.auto_approve_limit_smallest_unit))

  const save = async () => {
    const cap = parseUsdToCents(budget)
    const limit = parseUsdToCents(autoApprove)
    if (cap === undefined || limit === undefined) {
      toast.error("Enter USD amounts like 25 or 9.99 — or leave a field empty")
      return
    }
    try {
      await updateKey.mutateAsync({
        key_id: apiKey.id,
        max_ticket_budget_smallest_unit: cap,
        auto_approve_limit_smallest_unit: limit,
      })
      toast.success("Key updated")
      setEditing(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the key")
    }
  }

  // Opening the editor starts from the key's current (possibly refetched) values.
  const toggleEditing = () => {
    if (!editing) {
      setBudget(centsToInput(apiKey.max_ticket_budget_smallest_unit))
      setAutoApprove(centsToInput(apiKey.auto_approve_limit_smallest_unit))
    }
    setEditing((v) => !v)
  }

  const limit = apiKey.auto_approve_limit_smallest_unit

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">
            <KeyRound className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" />
            <span className="font-medium">{apiKey.name}</span>
            <span className="text-muted-foreground font-mono"> · {apiKey.prefix}…</span>
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Created {formatDate(apiKey.created_at)} · last used {formatDate(apiKey.last_used_at)}
            {apiKey.max_ticket_budget_smallest_unit != null &&
              (apiKey.max_ticket_budget_smallest_unit === 0
                ? " · free AI-agent answers only"
                : ` · AI-agent answers up to ${formatUsd(apiKey.max_ticket_budget_smallest_unit)}`)}
            {!isAgent &&
              (limit === null || limit === undefined
                ? " · every charge needs your approval"
                : ` · auto-approves charges up to ${formatUsd(limit)}`)}
          </p>
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActivity((v) => !v)}
            aria-label="Recent activity"
            title="Recent activity"
          >
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            {showActivity ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
          {!isAgent && (
            <Button variant="ghost" size="sm" onClick={toggleEditing} aria-label="Edit limits">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onRevoke(apiKey.id)} disabled={revoking} aria-label="Revoke">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Auto-approve charges up to (USD)</Label>
              <Input value={autoApprove} onChange={(e) => setAutoApprove(e.target.value)} placeholder="empty = always ask" inputMode="decimal" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Max price per AI-agent answer (USD)</Label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="empty = no limit" inputMode="decimal" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="lavender" onClick={save} disabled={updateKey.isPending}>
              {updateKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {showActivity && (
        <div className="mt-2 pl-5 border-l border-border">
          <KeyActivity keyId={apiKey.id} agentId={agentId} />
        </div>
      )}
    </div>
  )
}

/**
 * API keys for the GitHelp MCP server. Without `agentId` these are the
 * signed-in user's own (customer) keys; with it, keys for a project agent.
 * The plaintext key is shown once, right after it is created.
 */
export function ApiKeysManager({ agentId }: { agentId?: string | null }) {
  const isAgent = Boolean(agentId)
  const { data: keys = [], isLoading } = useApiKeys(agentId)
  const createKey = useCreateApiKey(agentId)
  const revokeKey = useRevokeApiKey(agentId)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [budget, setBudget] = useState("")
  const [autoApprove, setAutoApprove] = useState(DEFAULT_AUTO_APPROVE_USD)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)

  const activeKeys = keys.filter((k) => !k.revoked_at)

  const handleCreate = async () => {
    let cap: number | null = null
    let limit: number | null = null
    if (!isAgent) {
      const parsedCap = parseUsdToCents(budget)
      const parsedLimit = parseUsdToCents(autoApprove)
      if (parsedCap === undefined) {
        toast.error("Enter a USD amount, e.g. 25 or 9.99 (0 = only free AI agents) — or leave it empty for no limit")
        return
      }
      if (parsedLimit === undefined) {
        toast.error("Enter an auto-approve amount like 50 — or leave it empty to approve every charge yourself")
        return
      }
      cap = parsedCap
      limit = parsedLimit
    }
    try {
      const result = await createKey.mutateAsync({
        name: name.trim() || (isAgent ? "Agent key" : "AI assistant"),
        ...(isAgent ? {} : { max_ticket_budget_smallest_unit: cap, auto_approve_limit_smallest_unit: limit }),
      })
      setCreated(result)
      setShowForm(false)
      setName("")
      setBudget("")
      setAutoApprove(DEFAULT_AUTO_APPROVE_USD)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the key")
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm("Revoke this key? Anything using it stops working immediately.")) return
    try {
      await revokeKey.mutateAsync(keyId)
      toast.success("Key revoked")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the key")
    }
  }

  return (
    <div>
      {created && (
        <div className="mb-4 p-4 border border-border rounded-lg bg-muted/40 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Your new API key</p>
            <p className="text-xs text-muted-foreground">
              Shown once — copy it now. Anyone with this key can act as{" "}
              {isAgent ? "this agent" : "you"} on GitHelp.
            </p>
          </div>
          <CopyBlock label="API key" value={created.plaintext_key} />
          {isAgent ? (
            // Agents run as a service: environment variables for the starter
            // agent (or any MCP / JSON-RPC client).
            <CopyBlock
              label="Environment for your agent (.env)"
              value={
                created.env_snippet ??
                `GITHELP_MCP_URL=${created.setup.mcp_url}\nGITHELP_API_KEY=${created.plaintext_key}`
              }
            />
          ) : (
            <>
              <CopyBlock label="Claude Code" value={created.setup.claude_code} />
              <div>
                <p className="text-xs text-muted-foreground mb-1">One-click install (includes this key)</p>
                <McpInstallButtons apiKey={created.plaintext_key} />
              </div>
            </>
          )}
          <CopyBlock
            label="Other MCP clients (JSON config)"
            value={JSON.stringify(created.setup.json_config, null, 2)}
          />
          <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-3">Loading keys…</p>
      ) : activeKeys.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-3">No API keys yet.</p>
      ) : (
        <div className="space-y-0 divide-y divide-[rgba(0,0,0,0.06)]">
          {activeKeys.map((key) => (
            <KeyRow
              key={key.id}
              apiKey={key}
              agentId={agentId}
              onRevoke={handleRevoke}
              revoking={revokeKey.isPending}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 p-4 border border-border rounded-lg space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAgent ? "Production agent" : "Claude Code on my laptop"}
            />
          </div>
          {!isAgent && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Auto-approve charges up to (USD)</Label>
                  <Input
                    value={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.value)}
                    placeholder="empty = always ask"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Max price per AI-agent answer (USD, optional)</Label>
                  <Input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 25"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your assistant can accept finished work that costs up to the auto-approve amount. Above it, it
                can&apos;t accept the charge — you get a link to approve it yourself in GitHelp. The max price per
                AI-agent answer limits which project agents can take tickets opened with this key (0 = only free
                agents); it does not cap human helpers, who are billed by logged time.
              </p>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={createKey.isPending} variant="lavender" size="sm">
              {createKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create key"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Create API key
        </Button>
      )}
    </div>
  )
}
