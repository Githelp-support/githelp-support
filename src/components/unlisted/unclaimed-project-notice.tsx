"use client"

import { Info } from "lucide-react"
import { useProjectUnclaimed } from "@/hooks/useUnlisted"

/**
 * Ticket chat notice for projects GitHelp runs until their maintainers claim
 * them: answers come from independent helpers, not the maintainers.
 */
export function UnclaimedProjectNotice({ projectId }: { projectId: string | null | undefined }) {
  const { data: unclaimed } = useProjectUnclaimed(projectId)
  if (!unclaimed) return null
  return (
    <div
      className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
      data-testid="unclaimed-project-notice"
    >
      <Info className="h-4 w-4 mt-0.5 shrink-0" />
      <p>
        This project isn&apos;t run by its maintainers on GitHelp yet. Independent helpers vetted by GitHelp can
        answer; the maintainers have been invited.
      </p>
    </div>
  )
}
