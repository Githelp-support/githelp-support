"use client"

import { useState } from "react"
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatUsd,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type CreatedApiKey,
} from "@/hooks/useApiAccess"

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied")
  } catch {
    toast.error("Could not copy — select the text and copy it manually")
  }
}

function CopyBlock({ label, value }: { label: string; value: string }) {
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

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "never"
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
  const [created, setCreated] = useState<CreatedApiKey | null>(null)

  const activeKeys = keys.filter((k) => !k.revoked_at)

  const handleCreate = async () => {
    let cap: number | null = null
    if (!isAgent && budget.trim()) {
      const trimmed = budget.trim()
      if (!/^\d+(\.\d{1,2})?$/.test(trimmed) || Number(trimmed) <= 0) {
        toast.error("Enter a positive USD amount, e.g. 25 or 9.99 — or leave it empty for no limit")
        return
      }
      cap = Math.round(Number(trimmed) * 100)
    }
    try {
      const result = await createKey.mutateAsync({
        name: name.trim() || (isAgent ? "Agent key" : "AI assistant"),
        ...(isAgent ? {} : { max_ticket_budget_smallest_unit: cap }),
      })
      setCreated(result)
      setShowForm(false)
      setName("")
      setBudget("")
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
          <CopyBlock label="Claude Code" value={created.setup.claude_code} />
          <CopyBlock
            label="Cursor, VS Code and other MCP clients (JSON config)"
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
            <div key={key.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  <KeyRound className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" />
                  <span className="font-medium">{key.name}</span>
                  <span className="text-muted-foreground font-mono"> · {key.prefix}…</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Created {formatDate(key.created_at)} · last used {formatDate(key.last_used_at)}
                  {key.max_ticket_budget_smallest_unit !== null &&
                    ` · AI-agent answers up to ${formatUsd(key.max_ticket_budget_smallest_unit)}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)} disabled={revokeKey.isPending}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 p-4 border border-border rounded-lg space-y-3">
          <div className={isAgent ? "" : "grid grid-cols-2 gap-3"}>
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isAgent ? "Production agent" : "Claude Code on my laptop"}
              />
            </div>
            {!isAgent && (
              <div>
                <Label className="text-xs mb-1 block">Max price per AI-agent answer (USD, optional)</Label>
                <Input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 25"
                  inputMode="decimal"
                />
              </div>
            )}
          </div>
          {!isAgent && (
            <p className="text-xs text-muted-foreground">
              Only project AI agents priced at or below this amount can take tickets opened with this key. It does
              not cap human helpers, who are billed by logged time as usual. You always accept the work before you
              are charged.
            </p>
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
