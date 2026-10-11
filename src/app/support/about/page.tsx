"use client"

import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useProject, useProjectBySlug } from "@/hooks/useProject"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { AboutSupportContent } from "@/components/support/about-support-content"

export default function UserSupportAboutPage() {
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
  const projectName = project?.name ?? "Support"

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <Sidebar projectPageHref={projectPageHref} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="About support" />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto py-12 px-6">
            <AboutSupportContent projectName={projectName} />
          </div>
        </main>
      </div>
    </div>
  )
}
