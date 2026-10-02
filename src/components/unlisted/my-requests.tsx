"use client"

import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useMySupportRequests, useWithdrawRequest } from "@/hooks/useUnlisted"
import { demandPagePath, formatUsd } from "@/components/unlisted/repo"

const STATUS_LABEL: Record<string, string> = {
  waiting: "waiting for the maintainers",
  maintainers_joined: "the maintainers joined",
  withdrawn: "withdrawn",
}

/** Support the signed-in customer asked for from projects that aren't on GitHelp yet. */
export function MyRequests() {
  const { data: requests = [], isLoading, error } = useMySupportRequests()
  const withdraw = useWithdrawRequest()

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Could not load your requests"}</p>
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No requests yet. When a project you need isn&apos;t on GitHelp, ask for support on its page (or let your AI
        assistant do it) and we&apos;ll let you know when the maintainers join.
      </p>
    )
  }

  const doWithdraw = async (repo: string) => {
    try {
      const result = await withdraw.mutateAsync(repo)
      if (result.withdrawn) toast.success("Request withdrawn")
      else toast.info("This request was already closed.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not withdraw")
    }
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.repo} className="border border-border rounded-lg p-4 bg-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={demandPagePath(r.repo)} className="font-medium text-foreground hover:underline">{r.repo}</Link>
            <p className="text-xs text-muted-foreground">
              Asked {new Date(r.created_at).toLocaleDateString()}
              {r.pledge_smallest_unit ? ` · up to ${formatUsd(r.pledge_smallest_unit)}` : ""}
              {" · "}{STATUS_LABEL[r.status] ?? r.status.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {r.ticket_id && (
              <Link href={`/support/chat?ticket=${encodeURIComponent(r.ticket_id)}`} className="text-sm underline">
                Open ticket
              </Link>
            )}
            {r.status === "waiting" && (
              <Button size="sm" variant="outline" className="cursor-pointer" disabled={withdraw.isPending} onClick={() => void doWithdraw(r.repo)}>
                Withdraw
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
