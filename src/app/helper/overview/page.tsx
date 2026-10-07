"use client"

import { useMemo, useState } from "react"
import { HelpCircle, Info, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabSelector } from "@/components/ui/tab-selector"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useHelperDashboardStats } from "@/hooks/useHelperDashboardStats"
import { parseTimeDisplayToMinutes } from "@/lib/format"
import { getTicketStatusBadgeClass, getPriorityBadgeClass } from "@/lib/status-colors"
import { monthLabel } from "@/lib/user-payment-reports"

export default function HelperOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [issueFilter, setIssueFilter] = useState<"all" | "applied">("all")
  const [ticketFilter, setTicketFilter] = useState<"all" | "last24h">("all")
  const [now] = useState(() => Date.now())

  const [issueSort, setIssueSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null)

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

  // The hook restricts issue-types to categories the helper has completed
  // at least one ticket in (Uncategorized is included when the completed
  // tickets have no associated category). If the helper has no completed
  // tickets at all the list is empty and the table renders a single
  // "No data to show" row below.
  const allIssueTypes = helperStats?.issueTypeStats || []

  const inProgressTickets = helperStats?.inProgressTickets || []
  const keyStats = helperStats?.keyStats || { totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 }

  const completedTickets = helperStats?.completedTickets || []
  const ticketsSolvedInPeriod = completedTickets.filter(
    (ticket) => !targetMonth || monthLabel(ticket.completed_at ?? ticket.created_at) === targetMonth
  ).length

  const filteredIssueTypes = issueFilter === "all" ? allIssueTypes : allIssueTypes.filter((issue) => issue.applied)

  const filteredInProgressTickets =
    ticketFilter === "all"
      ? inProgressTickets
      : inProgressTickets.filter(
          (ticket) => now - new Date(ticket.created_at).getTime() <= 24 * 60 * 60 * 1000
        )

  const sortIssueTypes = (issues: typeof allIssueTypes) => {
    if (!issueSort) return issues

    return [...issues].sort((a, b) => {
      let aValue: string | number = a[issueSort.column as keyof typeof a] as string | number
      let bValue: string | number = b[issueSort.column as keyof typeof b] as string | number

      if (issueSort.column === "tickets") {
        aValue = aValue === "-" ? 0 : Number.parseInt(String(aValue), 10)
        bValue = bValue === "-" ? 0 : Number.parseInt(String(bValue), 10)
      } else if (issueSort.column === "time") {
        aValue = parseTimeDisplayToMinutes(String(aValue))
        bValue = parseTimeDisplayToMinutes(String(bValue))
      }

      if (aValue < bValue) return issueSort.direction === "asc" ? -1 : 1
      if (aValue > bValue) return issueSort.direction === "asc" ? 1 : -1
      return 0
    })
  }

  const handleIssueSort = (column: string) => {
    setIssueSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === "asc" ? { column, direction: "desc" } : null
      }
      return { column, direction: "asc" }
    })
  }

  const getSortIcon = (column: string, currentSort: { column: string; direction: "asc" | "desc" } | null) => {
    if (currentSort?.column !== column) {
      return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
    }
    return currentSort.direction === "asc" ? (
      <ChevronUp className="w-4 h-4 text-brand-primary" />
    ) : (
      <ChevronDown className="w-4 h-4 text-brand-primary" />
    )
  }

  const sortedIssueTypes = sortIssueTypes(filteredIssueTypes)

  // Match the Tickets page formatting: "in-progress" → "In Progress",
  // otherwise capitalize the first letter.
  const formatStatusLabel = (status: string) =>
    status === "in-progress"
      ? "In Progress"
      : status.charAt(0).toUpperCase() + status.slice(1)
  const formatPriorityLabel = (priority: string) =>
    priority.charAt(0).toUpperCase() + priority.slice(1)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview" subtitle="Stats and insight" />

        <main className="flex-1 px-8 py-6 space-y-[62px] overflow-y-auto">
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
              <Card className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{ticketsSolvedInPeriod}</div>
                </CardContent>
              </Card>
              <Card className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{keyStats.totalTimeSpent}</div>
                </CardContent>
              </Card>
              <Card className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{keyStats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tables — Issue types and Tickets in progress share equal width */}
          <div className="grid grid-cols-2 gap-8">
            {/* Issue Types Table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3 tabular-nums">Issue types ({filteredIssueTypes.length})</h2>
              <div className="mb-4">
                <TabSelector
                  options={[
                    { value: "all", label: "View all" },
                    { value: "applied", label: "Applied this period" },
                  ]}
                  value={issueFilter}
                  onChange={(value) => setIssueFilter(value as typeof issueFilter)}
                />
              </div>
              <Card className="border-[#E1E1E1] rounded-lg py-0 shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                      <div className="col-span-6 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleIssueSort("name")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Type</span>
                          {getSortIcon("name", issueSort)}
                        </button>
                      </div>
                      <div className="col-span-3 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleIssueSort("tickets")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">No of tickets</span>
                          {getSortIcon("tickets", issueSort)}
                        </button>
                      </div>
                      <div className="col-span-3 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleIssueSort("time")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Total time</span>
                          {getSortIcon("time", issueSort)}
                        </button>
                      </div>
                    </div>
                  </div>
                  {sortedIssueTypes.length === 0 ? (
                    <div className="px-6 py-2.5">
                      <div className="text-sm text-muted-foreground">No data to show</div>
                    </div>
                  ) : (
                    sortedIssueTypes.map((issue, index) => (
                      <div key={index} className="px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6 text-sm text-foreground">{issue.name}</div>
                          <div className="col-span-3 text-sm text-foreground tabular-nums">{issue.tickets}</div>
                          <div className="col-span-3 text-sm text-foreground tabular-nums">{issue.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tickets In Progress Table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3 tabular-nums">Tickets in progress ({filteredInProgressTickets.length})</h2>
              <div className="mb-4">
                <TabSelector
                  options={[
                    { value: "all", label: "All" },
                    { value: "last24h", label: "Started last 24 hours" },
                  ]}
                  value={ticketFilter}
                  onChange={(value) => setTicketFilter(value as typeof ticketFilter)}
                />
              </div>
              <Card className="border-[#E1E1E1] rounded-lg py-0 shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                      <div className="col-span-6">Ticket</div>
                      <div className="col-span-3">Priority</div>
                      <div className="col-span-3">Status</div>
                    </div>
                  </div>
                  {filteredInProgressTickets.length === 0 ? (
                    <div className="px-6 py-2.5">
                      <div className="text-sm text-muted-foreground">No tickets to show</div>
                    </div>
                  ) : (
                    filteredInProgressTickets.map((ticket) => (
                      <div key={ticket.id} className="px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6 text-sm text-foreground">{ticket.title}</div>
                          <div className="col-span-3">
                            <Badge className={`text-xs ${getPriorityBadgeClass(ticket.priority)}`}>
                              {formatPriorityLabel(ticket.priority)}
                            </Badge>
                          </div>
                          <div className="col-span-3">
                            <Badge className={`text-xs ${getTicketStatusBadgeClass(ticket.status)}`}>
                              {formatStatusLabel(ticket.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
