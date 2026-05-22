"use client"

import { useState } from "react"
import { HelpCircle, Info, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabSelector } from "@/components/ui/tab-selector"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useHelperDashboardStats } from "@/hooks/useHelperDashboardStats"
import { parseTimeDisplayToMinutes } from "@/lib/format"

export default function HelperOverviewPage() {
  const [timeFilter, setTimeFilter] = useState<"current" | "choose" | "all">("current")
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [issueFilter, setIssueFilter] = useState<"all" | "applied">("all")
  const [ticketFilter, setTicketFilter] = useState<"all" | "last24h">("all")

  const [issueSort, setIssueSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null)

  const generateMonthOptions = () => {
    const months = []
    const now = new Date()

    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString("en-US", { month: "long" })
      const year = date.getFullYear()
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      months.push({
        value,
        label: `${monthName} ${year}`,
        monthYear: `${monthName} ${year}`,
      })
    }

    return months
  }

  const monthOptions = generateMonthOptions()

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Resolve the current helper, then fetch stats scoped to that helper.
  const { data: helperId } = useCurrentHelper(projectId)
  const { data: helperStats } = useHelperDashboardStats(projectId, helperId ?? undefined)

  const allIssueTypes = helperStats?.issueTypeStats || []
  const inProgressTickets = helperStats?.inProgressTickets || []
  const keyStats = helperStats?.keyStats || { totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 }

  const filteredIssueTypes = issueFilter === "all" ? allIssueTypes : allIssueTypes.filter((issue) => issue.applied)

  const filteredInProgressTickets =
    ticketFilter === "all"
      ? inProgressTickets
      : inProgressTickets.filter(
          (ticket) => Date.now() - new Date(ticket.created_at).getTime() <= 24 * 60 * 60 * 1000
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
      return <ChevronsUpDown className="w-4 h-4 text-[#55555D]" />
    }
    return currentSort.direction === "asc" ? <ChevronUp className="w-4 h-4 text-[#55555D]" /> : <ChevronDown className="w-4 h-4 text-[#55555D]" />
  }

  const sortedIssueTypes = sortIssueTypes(filteredIssueTypes)

  const formatStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")
  const formatPriority = (priority: string) => priority.charAt(0).toUpperCase() + priority.slice(1)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview" subtitle="Stats and insight" />

        <main className="flex-1 px-8 py-6 space-y-[62px] overflow-y-auto">
          {/* Time Filters */}
          <div className="flex gap-2">
            <Button
              variant={timeFilter === "current" ? "lavender" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-sm font-medium",
                timeFilter === "current"
                  ? "hover:bg-brand-primary/90 hover:text-white text-brand-primary"
                  : "text-muted-foreground hover:bg-brand-primary hover:text-white"
              )}
              onClick={() => {
                setTimeFilter("current")
                setSelectedMonth("")
              }}
            >
              Current month
            </Button>
            <div className="relative">
              <Select
                value={selectedMonth}
                onValueChange={(value) => {
                  setSelectedMonth(value)
                  setTimeFilter("choose")
                }}
              >
                <SelectTrigger
                  size="sm"
                  variant={timeFilter === "choose" ? "lavender" : "outline"}
                  className="w-[160px] rounded-lg text-sm font-medium"
                >
                  <SelectValue placeholder="Choose month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem
                      key={month.value}
                      value={month.value}
                      className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium"
                    >
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={timeFilter === "all" ? "lavender" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-sm font-medium",
                timeFilter !== "all"
                  ? "text-muted-foreground hover:bg-brand-primary hover:text-white"
                  : undefined
              )}
              onClick={() => {
                setTimeFilter("all")
                setSelectedMonth("")
              }}
            >
              All time
            </Button>
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
                  <div className="text-[22px] font-[550] text-foreground">{keyStats.totalTicketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground">{keyStats.totalTimeSpent}</div>
                </CardContent>
              </Card>
              <Card className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground">{keyStats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tables — Issue types and Tickets in progress share equal width */}
          <div className="grid grid-cols-2 gap-8">
            {/* Issue Types Table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Issue types ({filteredIssueTypes.length})</h2>
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
                  <div className="bg-muted/60 px-6 py-3 border-b border-[#E1E1E1]">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-[#0A0A0A]">
                      <div
                        className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleIssueSort("name")}
                      >
                        Name
                        {getSortIcon("name", issueSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleIssueSort("tickets")}
                      >
                        No of tickets
                        {getSortIcon("tickets", issueSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleIssueSort("time")}
                      >
                        Total time
                        {getSortIcon("time", issueSort)}
                      </div>
                    </div>
                  </div>
                  {sortedIssueTypes.map((issue, index) => (
                    <div key={index} className="px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6 text-sm text-foreground">{issue.name}</div>
                        <div className="col-span-3 text-sm text-foreground">{issue.tickets}</div>
                        <div className="col-span-3 text-sm text-foreground">{issue.time}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Tickets In Progress Table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Tickets in progress ({filteredInProgressTickets.length})</h2>
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
                  <div className="bg-muted/60 px-6 py-3 border-b border-[#E1E1E1]">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-[#0A0A0A]">
                      <div className="col-span-6">Ticket</div>
                      <div className="col-span-3">Status</div>
                      <div className="col-span-3">Priority</div>
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
                          <div className="col-span-3 text-sm text-foreground">{formatStatus(ticket.status)}</div>
                          <div className="col-span-3 text-sm text-foreground">{formatPriority(ticket.priority)}</div>
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
