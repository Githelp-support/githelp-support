"use client"

import { Info } from "lucide-react"
import { useProject, useProjectBySlug } from "@/hooks/useProject"

interface Props {
  slug: string | null
  projectId: string | null
}

/**
 * Standalone sandbox banner for the public /support layout, which has no
 * ProjectProvider. We resolve the project either by slug (preferred — the
 * URL form is `/support/[slug]/...`) or by the `project` query param. When
 * `project.sandbox === true` we render an amber strip warning that no real
 * charges happen; otherwise we render nothing.
 */
export function SupportSandboxBanner({ slug, projectId }: Props) {
  const bySlug = useProjectBySlug(slug ?? "")
  const byId = useProject(projectId ?? "")
  const project = (slug ? bySlug.data : byId.data) as { sandbox?: boolean } | null | undefined
  if (!project?.sandbox) return null

  return (
    <div className="w-full bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-6 py-2 flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
      <Info className="w-4 h-4 shrink-0" />
      <span className="truncate">
        This is a sandbox project. Payments use Stripe test mode — no real charges will be made.
      </span>
    </div>
  )
}
