"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  type StaffApplication,
  useApproveApplication,
  useHelperApplications,
  useRejectApplication,
} from "@/hooks/useStaff"
import { demandPagePath } from "@/components/unlisted/repo"

const STATUS_FILTERS = ["pending", "approved", "rejected", "withdrawn"] as const

/** Independent-helper applications: check the GitHub evidence, then approve or reject. */
export function HelperApplications() {
  const [status, setStatus] = useState<string>("pending")
  const { data: items = [], isLoading, error } = useHelperApplications(status)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((s) => (
          <Button key={s} size="sm" variant={s === status ? "lavender" : "outline"} className="cursor-pointer" onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Could not load applications"}</p>}
      {!isLoading && !error && items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      <div className="space-y-3">
        {items.map((item) => <ApplicationRow key={item.id} item={item} />)}
      </div>
    </div>
  )
}

function ApplicationRow({ item }: { item: StaffApplication }) {
  const approve = useApproveApplication()
  const reject = useRejectApplication()
  const [reason, setReason] = useState("")
  const evidence = item.evidence

  const doApprove = async () => {
    try {
      await approve.mutateAsync({ id: item.id })
      toast.success(`${item.user.name ?? "Helper"} approved for ${item.repo}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve")
    }
  }

  const doReject = async () => {
    if (!reason.trim()) {
      toast.error("Add a short reason; the applicant sees it.")
      return
    }
    try {
      await reject.mutateAsync({ id: item.id, reason: reason.trim() })
      toast.success("Rejected")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject")
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-white space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {item.user.name ?? item.user.email ?? "Unknown user"}
            {item.user.github_login ? (
              <a href={`https://github.com/${item.user.github_login}`} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
                @{item.user.github_login}
              </a>
            ) : (
              <span className="ml-2 text-xs text-amber-700">no GitHub account linked</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            for{" "}
            <a href={demandPagePath(item.repo)} target="_blank" rel="noreferrer" className="underline">{item.repo}</a>
            {" · "}applied {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className="text-xs rounded px-2 py-0.5 bg-muted text-foreground">{item.status}</span>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{item.motivation}</p>
      <p className="text-xs text-muted-foreground">
        Evidence: {evidence.merged_prs ?? "?"} merged PRs · {evidence.commits ?? "?"} commits ·{" "}
        {evidence.github_login_verified ? "GitHub account verified (linked)" : "GitHub login self-reported"}
        {evidence.profile_url && (
          <>
            {" · "}
            <a href={evidence.profile_url} target="_blank" rel="noreferrer" className="underline">contributions</a>
          </>
        )}
      </p>
      {item.status === "pending" && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Button size="sm" variant="lavender" className="cursor-pointer" disabled={approve.isPending} onClick={() => void doApprove()}>
            Approve
          </Button>
          <Input placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56 h-8" />
          <Button size="sm" variant="outline" className="cursor-pointer" disabled={reject.isPending} onClick={() => void doReject()}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
