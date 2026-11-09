"use client"

import { useSearchParams } from "next/navigation"
import { useSetProjectPageHref } from "@/components/layout/app-shell"
import { Header } from "@/components/layout/header"
import { useProject, useProjectBySlug, useProjectResources } from "@/hooks/useProject"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { ResourcesContent } from "@/components/support/resources-content"

export default function UserSupportResourcesPage() {
  const searchParams = useSearchParams()

  // Resolve the project from query params the same way /support/chat does:
  // ?project= takes precedence, then ?ticket= (via the ticket's project),
  // then ?slug=.
  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const ticketIdParam = searchParams.get("ticket")

  const { data: existingTicket } = useTicketWithDetails(ticketIdParam || undefined)
  const projectIdFromTicket = existingTicket?.project_id
  const projectId = projectIdParam || projectIdFromTicket
  const { data: projectById } = useProject(projectId || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : (slugParam ? projectBySlug : projectById)
  // Use the project's UUID when only a slug is provided, or fall back to projectId from URL/ticket
  const effectiveProjectId = project?.project_id || projectId || ""
  const projectPageHref = project?.slug
    ? `/support/${encodeURIComponent(project.slug)}`
    : effectiveProjectId
      ? `/support?project=${encodeURIComponent(effectiveProjectId)}`
      : undefined
  useSetProjectPageHref(projectPageHref)
  const projectName = project?.name ?? "Support"

  const { data: resourcesData, isLoading: resourcesLoading } = useProjectResources(effectiveProjectId)
  const resources = resourcesData || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-subtle">
      <Header title="Resources" />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto py-12 px-6">
          <ResourcesContent
            projectName={projectName}
            resources={resources}
            resourcesLoading={resourcesLoading}
          />
        </div>
      </main>
    </div>
  )
}
