"use client"

import { Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useProjectSelection } from "@/contexts/project-context"
import { useProject, useUserProjects } from "@/hooks/useProject"

export function SandboxBanner() {
  const router = useRouter()
  const { selectedProjectId } = useProjectSelection()
  const { data: project } = useProject(selectedProjectId ?? "")
  const { data: userProjects } = useUserProjects()

  if (!project?.sandbox) return null

  const activeProjects = (userProjects ?? []).filter((p) => !p.deleted_at)
  const hasOnlySandbox = activeProjects.length <= 1

  return (
    <div className="shrink-0 w-full bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-6 py-2 flex items-center justify-between gap-4 text-sm text-amber-900 dark:text-amber-100">
      <div className="flex items-center gap-2 min-w-0">
        <Info className="w-4 h-4 shrink-0" />
        <span className="truncate">
          You are exploring a sandbox project. Data here is for demo purposes only.
        </span>
      </div>
      {hasOnlySandbox && (
        <Button
          variant="default"
          size="sm"
          className="bg-amber-900 hover:bg-amber-800 text-amber-50"
          onClick={() => router.push("/onboarding")}
        >
          Exit sandbox
        </Button>
      )}
    </div>
  )
}
