"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GithelpFunctionError } from "@/hooks/useUnlisted"
import {
  type OutreachItem,
  type OutreachPreview,
  useApproveOutreach,
  useOutreachPreview,
  useOutreachQueue,
  useRejectOutreach,
} from "@/hooks/useStaff"
import { demandPagePath, formatUsd } from "@/components/unlisted/repo"

const STATUS_FILTERS = ["pending_review", "posted", "opted_out", "failed", "rejected"] as const

/** Repositories whose demand passed the threshold: review the invitation, then post it (or not). */
export function OutreachQueue() {
  const [status, setStatus] = useState<string>("pending_review")
  const { data: items = [], isLoading, error } = useOutreachQueue(status)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((s) => (
          <Button key={s} size="sm" variant={s === status ? "lavender" : "outline"} className="cursor-pointer" onClick={() => setStatus(s)}>
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Could not load the queue"}</p>}
      {!isLoading && !error && items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <OutreachRow key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
        ))}
      </div>
    </div>
  )
}

function OutreachRow({ item, open, onToggle }: { item: OutreachItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href={demandPagePath(item.repo)} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
            {item.repo}
          </a>
          <p className="text-xs text-muted-foreground">
            {item.request_count} request{item.request_count === 1 ? "" : "s"}
            {item.pledged_smallest_unit > 0 ? ` · ${formatUsd(item.pledged_smallest_unit)} pledged` : ""}
            {" · "}queued {new Date(item.created_at).toLocaleDateString()}
            {item.last_posted_at ? ` · last posted ${new Date(item.last_posted_at).toLocaleDateString()}` : ""}
          </p>
          {item.posted_url && (
            <a href={item.posted_url} target="_blank" rel="noreferrer" className="text-xs underline">View post on GitHub</a>
          )}
          {item.error && <p className="text-xs text-red-700">{item.error}</p>}
        </div>
        {item.status === "pending_review" && (
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={onToggle}>
            {open ? "Close" : "Review"}
          </Button>
        )}
      </div>
      {open && item.status === "pending_review" && <OutreachReview id={item.id} onDone={onToggle} />}
    </div>
  )
}

function OutreachReview({ id, onDone }: { id: string; onDone: () => void }) {
  const { data: preview, isLoading, error } = useOutreachPreview(id)
  if (isLoading) return <p className="text-sm text-muted-foreground mt-3">Loading preview…</p>
  if (error || !preview) {
    // e.g. the repository was deleted or renamed: it can still be rejected.
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm text-red-700">
          Could not load the preview{error instanceof Error ? `: ${error.message}` : "."}
        </p>
        <RejectControl id={id} onDone={onDone} />
      </div>
    )
  }
  return <OutreachEditor id={id} preview={preview} onDone={onDone} />
}

function RejectControl({ id, onDone }: { id: string; onDone: () => void }) {
  const reject = useRejectOutreach()
  const [reason, setReason] = useState("")
  const doReject = async () => {
    if (!reason.trim()) {
      toast.error("Add a short reason.")
      return
    }
    try {
      await reject.mutateAsync({ id, reason: reason.trim() })
      toast.success("Rejected")
      onDone()
    } catch (e) {
      if (e instanceof GithelpFunctionError && e.code === "not_pending") {
        toast.info("Someone else already handled this item.")
        onDone()
        return
      }
      toast.error(e instanceof Error ? e.message : "Could not reject")
    }
  }
  return (
    <div className="flex items-end gap-2">
      <Input placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" />
      <Button variant="outline" className="cursor-pointer" disabled={reject.isPending} onClick={() => void doReject()}>
        Reject
      </Button>
    </div>
  )
}

function OutreachEditor({ id, preview, onDone }: { id: string; preview: OutreachPreview; onDone: () => void }) {
  const approve = useApproveOutreach()
  const [title, setTitle] = useState(preview.title)
  const [body, setBody] = useState(preview.body)
  const [channel, setChannel] = useState<"discussion" | "issue">(preview.channel_available.discussion ? "discussion" : "issue")

  const canPost = !preview.opted_out && (preview.channel_available.discussion || preview.channel_available.issue)

  const post = async () => {
    try {
      const result = await approve.mutateAsync({ id, channel, title, body })
      if (result.status === "posted") {
        toast.success("Posted on GitHub")
        onDone()
      } else if (result.status === "opted_out") {
        toast.info(result.error ?? "The maintainers opted out; nothing was posted.")
        onDone()
      } else {
        // e.g. the bot token isn't configured: keep the item and the edits.
        toast.error(result.error ?? `Not posted (${result.status})`)
      }
    } catch (e) {
      if (e instanceof GithelpFunctionError && e.code === "not_pending") {
        toast.info("Someone else already handled this item.")
        onDone()
        return
      }
      toast.error(e instanceof Error ? e.message : "Could not post")
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {preview.opted_out && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          This repository opted out of GitHelp outreach. It can&apos;t be posted.
        </p>
      )}
      <div className="flex gap-2">
        {(["discussion", "issue"] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={channel === c ? "lavender" : "outline"}
            className="cursor-pointer"
            disabled={!preview.channel_available[c]}
            onClick={() => setChannel(c)}
          >
            {c === "discussion" ? "GitHub Discussion" : "GitHub issue"}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`outreach-title-${id}`}>Title</Label>
        <Input id={`outreach-title-${id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`outreach-body-${id}`}>Message</Label>
        <Textarea id={`outreach-body-${id}`} value={body} rows={10} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="lavender" className="cursor-pointer" disabled={!canPost || approve.isPending} onClick={() => void post()}>
          {approve.isPending ? "Posting…" : "Approve and post"}
        </Button>
        <RejectControl id={id} onDone={onDone} />
      </div>
    </div>
  )
}
