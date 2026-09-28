"use client"

import { useState } from "react"
import { Loader2, Plus, Send, Trash2, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import {
  useNotificationChannels,
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
  useUpdateNotificationChannel,
  type ChannelScope,
  type ChannelType,
} from "@/hooks/useNotificationChannels"

const TYPE_LABELS: Record<ChannelType, string> = {
  slack_webhook: "Slack",
  discord_webhook: "Discord",
  generic_webhook: "Webhook",
}

const GROUP_OPTIONS = [
  { key: "tickets", label: "Tickets" },
  { key: "messages", label: "Messages" },
  { key: "payments", label: "Payments" },
  { key: "membership", label: "Membership" },
]

const URL_PLACEHOLDERS: Record<ChannelType, string> = {
  slack_webhook: "https://hooks.slack.com/services/…",
  discord_webhook: "https://discord.com/api/webhooks/…",
  generic_webhook: "https://your-service.example/githelp-events",
}

export function NotificationChannelsManager({
  scope,
  projectId,
}: {
  scope: ChannelScope
  projectId?: string | null
}) {
  const { data: channels = [], isLoading } = useNotificationChannels(scope, projectId)
  const createChannel = useCreateNotificationChannel(scope, projectId)
  const updateChannel = useUpdateNotificationChannel(scope, projectId)
  const deleteChannel = useDeleteNotificationChannel(scope, projectId)
  const testChannel = useTestNotificationChannel(scope, projectId)

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ChannelType>("slack_webhook")
  const [name, setName] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [groups, setGroups] = useState<string[]>(["tickets", "payments", "membership"])
  const [signingSecret, setSigningSecret] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const toggleGroup = (key: string) => {
    setGroups((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]))
  }

  const handleCreate = async () => {
    if (!webhookUrl.startsWith("https://")) {
      toast.error("The webhook URL must start with https://")
      return
    }
    if (groups.length === 0) {
      toast.error("Pick at least one notification type")
      return
    }
    try {
      const result = await createChannel.mutateAsync({
        type,
        name: name.trim() || TYPE_LABELS[type],
        webhook_url: webhookUrl.trim(),
        event_groups: groups,
      })
      if (result.signing_secret) {
        setSigningSecret(result.signing_secret)
      }
      setShowForm(false)
      setName("")
      setWebhookUrl("")
      toast.success("Channel connected — use Test to verify it")
    } catch {
      toast.error("Could not add the channel — please try again")
    }
  }

  const handleTest = async (channelId: string) => {
    setTestingId(channelId)
    try {
      const result = await testChannel.mutateAsync(channelId)
      if (result.success) toast.success("Test notification sent")
      else toast.error(`Test failed: ${result.error ?? "unknown error"}`)
    } catch {
      toast.error("Test failed — check the webhook URL")
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (channelId: string) => {
    try {
      await deleteChannel.mutateAsync(channelId)
      toast.success("Channel removed")
    } catch {
      toast.error("Could not remove the channel")
    }
  }

  return (
    <div>
      {signingSecret && (
        <div className="mb-4 p-4 border border-border rounded-lg bg-muted/40">
          <p className="text-sm font-medium text-foreground mb-1">Webhook signing secret</p>
          <p className="text-xs text-muted-foreground mb-2">
            Shown once — store it now. Verify requests with the{" "}
            <code className="font-mono">X-Githelp-Signature: sha256=&lt;hmac&gt;</code> header.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-white border border-border rounded px-2 py-1 break-all flex-1">
              {signingSecret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(signingSecret)
                toast.success("Copied")
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSigningSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-3">Loading channels…</p>
      ) : channels.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-3">
          No delivery channels connected yet.
        </p>
      ) : (
        <div className="space-y-0 divide-y divide-[rgba(0,0,0,0.06)]">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  <span className="font-medium">{channel.name}</span>
                  <span className="text-muted-foreground"> · {TYPE_LABELS[channel.type] ?? channel.type}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {channel.webhook_url_masked} · {channel.event_groups.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={channel.enabled}
                  onCheckedChange={(checked) =>
                    updateChannel.mutate({ channel_id: channel.id, enabled: checked })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest(channel.id)}
                  disabled={testingId === channel.id}
                >
                  {testingId === channel.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1">Test</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(channel.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 p-4 border border-border rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as ChannelType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack_webhook">Slack (incoming webhook)</SelectItem>
                  <SelectItem value="discord_webhook">Discord (channel webhook)</SelectItem>
                  <SelectItem value="generic_webhook">Custom webhook (signed JSON)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="#support-alerts" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Webhook URL</Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={URL_PLACEHOLDERS[type]}
            />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Send these notification types</Label>
            <div className="flex flex-wrap gap-3">
              {GROUP_OPTIONS.map((group) => (
                <label key={group.key} className="flex items-center gap-1.5 text-sm text-[#737373] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groups.includes(group.key)}
                    onChange={() => toggleGroup(group.key)}
                    className="accent-brand-primary"
                  />
                  {group.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={createChannel.isPending} variant="lavender" size="sm">
              {createChannel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect channel"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add channel
        </Button>
      )}
    </div>
  )
}
