"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useUser } from "@/contexts/user-context"
import { ExternalLink, HelpCircle, Info, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabSelector } from "@/components/ui/tab-selector"
import Link from "next/link"
import { useProjectSelection } from "@/contexts/project-context"
import { parseTimeDisplayToMinutes } from "@/lib/format"

export default function Dashboard() {
  const router = useRouter()
  const { isLoading: isUserLoading } = useUser()

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Resolve the user's role in the active project so we can route non-admins
  // to their respective home pages before rendering the admin dashboard.
  const {
    data: projectRole,
    isLoading: isProjectRoleLoading,
    isFetching: isProjectRoleFetching,
  } = useProjectRole(projectId)

  useEffect(() => {
    if (isUserLoading) return
    if (!projectId) return
    if (isProjectRoleLoading || isProjectRoleFetching) return
    if (!projectRole) return

    if (projectRole === "helper") {
      router.replace("/helper/overview")
    } else if (projectRole === "user") {
      router.replace("/support/tickets")
    }
  }, [
    isUserLoading,
    projectId,
    projectRole,
    isProjectRoleLoading,
    isProjectRoleFetching,
    router,
  ])

  const [timeFilter, setTimeFilter] = useState<"current" | "choose" | "all">("current")
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [helperFilter, setHelperFilter] = useState<"all" | "core" | "extended" | "community">("all")
  const [issueFilter, setIssueFilter] = useState<"all" | "applied">("all")

  const [helperSort, setHelperSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null)
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

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats(projectId)

  const allHelpers = dashboardStats?.helperStats || []
  const allIssueTypes = dashboardStats?.issueTypeStats || []
  const keyStats = dashboardStats?.keyStats || { totalTicketsSolved: 0, totalTimeSpent: "-", percentageSolved: 0 }

  const filteredHelpers =
    helperFilter === "all" ? allHelpers : allHelpers.filter((helper) => helper.category === helperFilter)

  const filteredIssueTypes = issueFilter === "all" ? allIssueTypes : allIssueTypes.filter((issue) => issue.applied)

  const sortHelpers = (helpers: typeof allHelpers) => {
    if (!helperSort) return helpers

    return [...helpers].sort((a, b) => {
      let aValue: string | number = a[helperSort.column as keyof typeof a] as string | number
      let bValue: string | number = b[helperSort.column as keyof typeof b] as string | number

      if (helperSort.column === "tickets") {
        aValue = aValue === "-" ? 0 : Number.parseInt(String(aValue), 10)
        bValue = bValue === "-" ? 0 : Number.parseInt(String(bValue), 10)
      } else if (helperSort.column === "time") {
        aValue = parseTimeDisplayToMinutes(String(aValue))
        bValue = parseTimeDisplayToMinutes(String(bValue))
      }

      if (aValue < bValue) return helperSort.direction === "asc" ? -1 : 1
      if (aValue > bValue) return helperSort.direction === "asc" ? 1 : -1
      return 0
    })
  }

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

  const handleHelperSort = (column: string) => {
    setHelperSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === "asc" ? { column, direction: "desc" } : null
      }
      return { column, direction: "asc" }
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

  const sortedHelpers = sortHelpers(filteredHelpers)
  const sortedIssueTypes = sortIssueTypes(filteredIssueTypes)

  // While we don't yet know the user's role (or while we're redirecting a
  // non-admin), render a neutral loading state instead of the admin UI so
  // helpers/users don't see a flash of admin-only content before the
  // redirect kicks in.
  const isResolvingRole =
    isUserLoading ||
    (!!projectId && (isProjectRoleLoading || isProjectRoleFetching))
  const isRedirectingNonAdmin =
    !!projectId && projectRole !== undefined && projectRole !== "admin"

  if (isResolvingRole || isRedirectingNonAdmin) {
    return (
      <div className="h-screen flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Overview" subtitle="Stats and insight" />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading…</div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview" subtitle="Stats and insight" />

        <main className="flex-1 px-8 py-6 space-y-[62px] overflow-y-auto">
          {/* Time Filters */}
          <div className="flex gap-2">
            <Button
              variant={timeFilter === "current" ? "neutral" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-sm font-medium",
                timeFilter !== "current" && "text-muted-foreground"
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
                  variant={timeFilter === "choose" ? "neutral" : "outline"}
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
              variant={timeFilter === "all" ? "neutral" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-sm font-medium",
                timeFilter !== "all" && "text-muted-foreground"
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
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{keyStats.totalTicketsSolved}</div>
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

          {/* Tables */}
          <div className="grid grid-cols-2 gap-8">
            {/* Helpers Table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Helpers ({filteredHelpers.length})</h2>
              <div className="mb-4">
                <TabSelector
                  options={[
                    { value: "all", label: "View all" },
                    { value: "core", label: "Core team" },
                    { value: "extended", label: "Extended team" },
                    { value: "community", label: "Community" },
                  ]}
                  value={helperFilter}
                  onChange={(value) => setHelperFilter(value as typeof helperFilter)}
                />
              </div>
              <Card className="border-[#E1E1E1] rounded-lg py-0 shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-muted/60 px-6 py-3 border-b border-[#E1E1E1]">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-[#2E2D31]">
                      <div
                        className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleHelperSort("name")}
                      >
                        Name
                        {getSortIcon("name", helperSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleHelperSort("tickets")}
                      >
                        No of tickets
                        {getSortIcon("tickets", helperSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-foreground"
                        onClick={() => handleHelperSort("time")}
                      >
                        Total time
                        {getSortIcon("time", helperSort)}
                      </div>
                    </div>
                  </div>
                  {sortedHelpers.map((helper, index) => (
                    <div key={index} className="px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6 flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: helper.color }}
                          >
                            {helper.initial}
                          </div>
                          <span className="text-sm text-foreground">{helper.name}</span>
                        </div>
                        <div className="col-span-3 text-sm text-foreground tabular-nums">{helper.tickets}</div>
                        <div className="col-span-2 text-sm text-foreground tabular-nums">{helper.time}</div>
                        <div className="col-span-1 flex justify-end">
                          <Link href={`/helpers/${helper.id}`}>
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-muted-foreground cursor-pointer" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

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
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-[#2E2D31]">
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
                        <div className="col-span-3 text-sm text-foreground tabular-nums">{issue.tickets}</div>
                        <div className="col-span-3 text-sm text-foreground tabular-nums">{issue.time}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
