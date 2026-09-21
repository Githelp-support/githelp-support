"use client"

import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useProject, useProjectBySlug, useProjectPaymentSettings } from "@/hooks/useProject"
import { useTicketWithDetails } from "@/hooks/useTicketsWithDetails"
import { formatTicketRates, isFreeSupport } from "@/lib/ticket-pricing"
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
  const projectName = project?.name ?? "Support"

  const { data: paymentSettings } = useProjectPaymentSettings(effectiveProjectId)
  // Format payment values (convert cents to dollars)
  const { startPrice, first60Price, after60Price } = formatTicketRates(paymentSettings)

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg-subtle">
      <Sidebar projectPageHref={projectPageHref} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Rates and details" />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto py-12 px-[72px]">
            <RatesAndDetailsContent
              projectName={projectName}
              isFree={isFreeSupport(paymentSettings)}
              startPrice={startPrice}
              first60Price={first60Price}
              after60Price={after60Price}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
