"use client"

import { useSearchParams } from "next/navigation"
import { useSetProjectPageHref } from "@/components/layout/app-shell"
import { Header } from "@/components/layout/header"
import { useProject, useProjectBySlug, useProjectPaymentSettings } from "@/hooks/useProject"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { formatTicketRates, isFreeSupport } from "@/lib/ticket-pricing"
import { useProjectAverageResponseTime } from "@/hooks/useProjectResponseTime"
import { RatesAndDetailsContent } from "@/components/support/rates-and-details-content"

export default function UserSupportRatesPage() {
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

  const { data: paymentSettings } = useProjectPaymentSettings(effectiveProjectId)
  // Format payment values (convert cents to dollars); null until the project
  // has payment settings — the content renders "Rates not configured".
  const rates = formatTicketRates(paymentSettings)
  const { data: avgResponseSeconds, isPending: avgResponseLoading } = useProjectAverageResponseTime(effectiveProjectId)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-subtle">
      <Header title="Rates and details" />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto py-12 px-18">
          <RatesAndDetailsContent
            projectName={projectName}
            isFree={isFreeSupport(paymentSettings)}
            rates={rates}
            avgResponseSeconds={avgResponseSeconds}
            avgResponseLoading={avgResponseLoading}
          />
        </div>
      </main>
    </div>
  )
}
