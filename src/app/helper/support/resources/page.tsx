"use client"

import { useSearchParams } from "next/navigation"
import { useSetProjectPageHref } from "@/components/layout/app-shell"
import { Header } from "@/components/layout/header"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/skeleton"
import { ResourcesContent } from "@/components/support/resources-content"
import { useProjectSelection } from "@/contexts/project-context"
import { useProject, useProjectResources } from "@/hooks/useProject"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"

export default function HelperSupportResourcesPage() {
  const searchParams = useSearchParams()
  const { selectedProjectId, isReady } = useProjectSelection()

  // Resolve the project: ?project= takes precedence, then ?ticket= (via the
  // ticket's project), then the helper's selected project.
  const projectIdParam = searchParams.get("project")
  const ticketIdParam = projectIdParam ? null : searchParams.get("ticket")

  const { data: existingTicket, isLoading: ticketLoading } = useTicketWithDetails(ticketIdParam || undefined)
  const projectIdFromTicket = existingTicket?.project_id
  // Don't fall through to the selected project while the ticket is still loading.
  const resolvingTicket = !!ticketIdParam && ticketLoading
  const projectId = resolvingTicket ? "" : projectIdParam || projectIdFromTicket || selectedProjectId || ""

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const projectPageHref = project?.slug
    ? `/support/${encodeURIComponent(project.slug)}`
    : projectId
      ? `/support?project=${encodeURIComponent(projectId)}`
      : undefined
  useSetProjectPageHref(projectPageHref)
  const projectName = project?.name ?? "Support"

  const { data: resourcesData, isLoading: resourcesLoading } = useProjectResources(projectId)
  const resources = resourcesData || []

  if (resolvingTicket || (!projectId && !isReady) || projectLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-subtle">
      <Header title="Resources" className="bg-bg-subtle" />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto pt-6 pb-12 px-6 md:px-18">
          {projectId ? (
            <ResourcesContent
              projectName={projectName}
              resources={resources}
              resourcesLoading={resourcesLoading}
              showFaqs={false}
              outlinedEmptyState
            />
          ) : (
            <EmptyState
              icon="fi-rr-folder-open"
              title="No project selected"
              description="Select a project to see its resources."
            />
          )}
        </div>
      </main>
    </div>
  )
}
