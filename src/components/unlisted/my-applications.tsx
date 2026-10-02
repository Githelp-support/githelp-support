"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { refreshMembership, useMyHelperApplications } from "@/hooks/useUnlisted"
import { demandPagePath } from "@/components/unlisted/repo"

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for GitHelp review",
  approved: "Approved — you can answer this project's tickets",
  rejected: "Not approved",
  withdrawn: "Closed — the maintainers joined GitHelp and now manage their own helpers",
}

/** The signed-in user's applications to help on projects not yet run by their maintainers. */
export function MyApplications() {
  const { data: applications = [], isLoading, error } = useMyHelperApplications()
  const router = useRouter()
  const queryClient = useQueryClient()
  // Newly approved helpers are project members now: refresh the cached
  // "not a member" state first, or the tickets page sends them to onboarding.
  const openTickets = async () => {
    await refreshMembership(queryClient)
    router.push("/tickets")
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Could not load your applications"}</p>
  if (applications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t applied to help on any project yet. Find a repository&apos;s page at{" "}
        <code className="font-mono">/r/owner/repo</code> and choose &quot;I know this project — become a helper&quot;.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {applications.map((a) => (
        <div key={a.id} className="border border-border rounded-lg p-4 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={demandPagePath(a.repo)} className="font-medium text-foreground hover:underline">{a.repo}</Link>
            <span className="text-xs text-muted-foreground">applied {new Date(a.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-foreground mt-1">{STATUS_LABEL[a.status] ?? a.status}</p>
          {a.status === "rejected" && a.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {a.reason}</p>}
          {a.status === "approved" && (
            <button type="button" onClick={() => void openTickets()} className="text-xs underline mt-1 inline-block cursor-pointer">
              Open tickets
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
