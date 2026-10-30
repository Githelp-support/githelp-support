"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HelpCircle, Info, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProjectSelection } from "@/contexts/project-context"
import { useUser } from "@/contexts/user-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useHelperDashboardStats } from "@/hooks/useHelperDashboardStats"
import { useHelperRecentTicketInteractions } from "@/hooks/useHelperRecentTicketInteractions"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import { monthLabel } from "@/lib/user-payment-reports"
import { cn } from "@/lib/utils"
import { SQUIRCLE_RADIUS } from "@/lib/constants"
import { EmptyState } from "@/components/ui/empty-state"
import { ListSkeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

const RECENT_TICKETS_LIMIT = 5

// "dd.mm.yyyy, HH:mm", matching the Tickets page
function formatDate(dateString: string) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}.${month}.${year}, ${hours}:${minutes}`
}

export default function HelperOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("all")

  // Last 12 months for the period filter dropdown
  const months = useMemo(() => {
    const result: string[] = []
    const currentDate = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      result.push(date.toLocaleDateString("en-US", { month: "long", year: "numeric" }))
    }
    return result
  }, [])

  // null = no period restriction ("All")
  const targetMonth =
    selectedPeriod === "all"
      ? null
      : selectedPeriod === "current"
        ? monthLabel(new Date().toISOString())
        : selectedPeriod

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Resolve the current helper, then fetch stats scoped to that helper.
  const { data: helperId } = useCurrentHelper(projectId)
  const { data: helperStats } = useHelperDashboardStats(projectId, helperId ?? undefined)

  // Recent tickets are keyed by the helper's auth user id (not projects_helpers.helper_id).
  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id
  const { data: recentTickets = [], isLoading: recentLoading, isError, refetch } = useHelperRecentTicketInteractions(
    userId,
    RECENT_TICKETS_LIMIT
  )
  const isRecentLoading = userLoading || recentLoading

  const keyStats = helperStats?.keyStats || { totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 }

  const completedTickets = helperStats?.completedTickets || []
  const ticketsSolvedInPeriod = completedTickets.filter(
    (ticket) => !targetMonth || monthLabel(ticket.completed_at ?? ticket.created_at) === targetMonth
  ).length


  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Overview" subtitle="Stats and insight" />

      <main className="flex-1 px-8 py-6 space-y-16 overflow-y-auto">
        {/* Filters */}
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px] h-9 text-muted-foreground">
              <SelectValue placeholder="Choose period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="current">Current month</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Key Stats */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">Key stats</h2>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border-subtle shadow-none h-28 py-0 justify-center rounded-lg">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Number of tickets solved</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{ticketsSolvedInPeriod}</div>
              </CardContent>
            </Card>
            <Card className="border-border-subtle shadow-none h-28 py-0 justify-center rounded-lg">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Total time spent</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{keyStats.totalTimeSpent}</div>
              </CardContent>
            </Card>
            <Card className="border-border-subtle shadow-none h-28 py-0 justify-center rounded-lg">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Percentage solved</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{keyStats.percentageSolved}%</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Tickets Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Recent tickets</h2>
            <Link href="/tickets" className="text-sm font-medium text-brand-primary hover:underline">
              View all tickets
            </Link>
          </div>
          <Card className="border-border-subtle rounded-lg py-0 shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                  <div className="col-span-6">Ticket</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-2">Last interaction</div>
                  <div className="col-span-1" />
                </div>
              </div>
              {isRecentLoading ? (
                <ListSkeleton rows={3} />
              ) : isError ? (
                <ErrorState size="sm" onRetry={() => refetch()} />
              ) : recentTickets.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={MessageCircle}
                  title="No tickets to show"
                  description="Tickets you work on will appear here."
                />
              ) : (
                recentTickets.map((ticket) => {
                  const projectName = ticket.project_name || "Project"
                  const lastInteraction = formatDate(ticket.last_interaction_at)
                  return (
                    <Link
                      key={ticket.id}
                      href={`/helper/tickets/${ticket.id}`}
                      className={cn(
                        "block px-6 py-2.5 border-b border-border-subtle last:border-b-0",
                        ticket.has_unread ? "bg-brand-primary/10 hover:bg-brand-primary/15" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <div className="flex items-start gap-4">
                            <Avatar
                              key={`${ticket.project_logo_url ?? ""}|${projectName}`}
                              className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} shrink-0`}
                            >
                              {ticket.project_logo_url ? (
                                <AvatarImage src={ticket.project_logo_url} alt={projectName} />
                              ) : null}
                              <AvatarFallback className={`bg-brand-primary text-brand-foreground text-sm font-medium ${SQUIRCLE_RADIUS[32]}`}>
                                {(projectName?.[0] || "?").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-foreground hover:text-brand-primary cursor-pointer truncate">
                                {projectName}
                              </h4>
                              <p
                                className="text-xs text-muted-foreground truncate"
                                title={ticket.title?.trim() || "Untitled ticket"}
                              >
                                {ticket.title?.trim() || "Untitled ticket"}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <MessageCircle className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {ticket.message_count} messages
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <Badge className={`text-xs ${getTicketStatusBadgeClass(ticket.status)}`}>
                            {ticket.status}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm text-muted-foreground">
                            <div>{lastInteraction.split(", ")[0]}</div>
                            <div className="text-xs text-muted-foreground">
                              {lastInteraction.split(", ")[1]}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {ticket.has_unread ? (
                            <i
                              className="fi fi-rr-comments inline-flex items-center justify-center leading-none text-brand-primary"
                              aria-label="Unread messages"
                            />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
