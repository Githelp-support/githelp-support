"use client"

import { useState } from "react"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { ExternalLink, HelpCircle, Info, ChevronUp, ChevronDown, ChevronsUpDown, Ticket, Clock, CheckCircle2 } from "lucide-react"
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
import { avatarColorClasses, avatarColorsHex } from "@/lib/constants"

function getAvatarClassFromHex(hex: string | undefined | null): string | null {
  if (!hex) return null
  const idx = avatarColorsHex.findIndex((c) => c.toLowerCase() === hex.toLowerCase())
  return idx >= 0 ? avatarColorClasses[idx] : null
}

export default function Dashboard() {
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

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

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
      return <ChevronsUpDown className="w-3.5 h-3.5 text-text-tertiary" />
    }
    return currentSort.direction === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
  }

  const sortedHelpers = sortHelpers(filteredHelpers)
  const sortedIssueTypes = sortIssueTypes(filteredIssueTypes)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview" subtitle="Stats and insight" />

        <main className="flex-1 px-8 py-6 space-y-10 overflow-y-auto bg-page-muted">
          {/* Page Intro */}
          <div>
            <div className="flex items-end justify-between gap-4 pb-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overview</p>
                <h1 className="text-lg font-semibold text-foreground mt-1">Stats and insight</h1>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg bg-bg-subtle p-1 border border-border/70 shadow-inner">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 rounded-md px-3 text-sm font-medium transition-all",
                    timeFilter === "current"
                      ? "bg-background text-brand-primary shadow-[0_0_7px_0_rgba(134,140,152,0.30)] hover:bg-background hover:text-brand-primary"
                      : "bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                  )}
                  onClick={() => {
                    setTimeFilter("current")
                    setSelectedMonth("")
                  }}
                >
                  Current month
                </Button>
                <Select
                  value={selectedMonth}
                  onValueChange={(value) => {
                    setSelectedMonth(value)
                    setTimeFilter("choose")
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn(
                      "w-[160px] h-7 rounded-md border-0 px-3 text-sm font-medium shadow-none transition-all",
                      timeFilter === "choose"
                        ? "bg-background text-brand-primary [&_svg]:text-brand-primary shadow-[0_0_7px_0_rgba(134,140,152,0.30)] hover:bg-background"
                        : "bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                    )}
                  >
                    <SelectValue placeholder="Choose month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 rounded-md px-3 text-sm font-medium transition-all",
                    timeFilter === "all"
                      ? "bg-background text-brand-primary shadow-[0_0_7px_0_rgba(134,140,152,0.30)] hover:bg-background hover:text-brand-primary"
                      : "bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                  )}
                  onClick={() => {
                    setTimeFilter("all")
                    setSelectedMonth("")
                  }}
                >
                  All time
                </Button>
              </div>
            </div>
            <div className="border-b border-border" />
          </div>

          {/* Key Stats */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-sm bg-brand-primary" />
              <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-text-muted">Key stats</h2>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border-subtle shadow-none py-5 bg-gradient-to-b from-background to-bg-subtle">
                <CardContent className="px-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Number of tickets solved</span>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-avatar-5 flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-foreground">{keyStats.totalTicketsSolved}</div>
                  <div className="text-xs text-muted-foreground mt-1">this period</div>
                </CardContent>
              </Card>
              <Card className="border-border-subtle shadow-none py-5 bg-gradient-to-b from-background to-bg-subtle">
                <CardContent className="px-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Total time spent</span>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-avatar-2 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-foreground">{keyStats.totalTimeSpent}</div>
                  <div className="text-xs text-muted-foreground mt-1">this period</div>
                </CardContent>
              </Card>
              <Card className="border-border-subtle shadow-none py-5 bg-gradient-to-b from-background to-bg-subtle">
                <CardContent className="px-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Percentage solved</span>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-avatar-4 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-foreground">{keyStats.percentageSolved}%</div>
                  <div className="text-xs text-muted-foreground mt-1">this period</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-2 gap-8">
            {/* Helpers Table */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-sm bg-brand-primary" />
                  <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-text-muted">Helpers</h2>
                  <span className="rounded-full bg-bg-subtle text-text-muted px-2 py-0.5 text-xs">
                    {filteredHelpers.length}
                  </span>
                </div>
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
              <Card className="border border-border-subtle rounded-xl py-0 shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-bg-subtle px-6 py-2.5 border-b border-border-subtle">
                    <div className="grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <div
                        className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleHelperSort("name")}
                      >
                        Name
                        {getSortIcon("name", helperSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleHelperSort("tickets")}
                      >
                        No of tickets
                        {getSortIcon("tickets", helperSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleHelperSort("time")}
                      >
                        Total time
                        {getSortIcon("time", helperSort)}
                      </div>
                    </div>
                  </div>
                  {sortedHelpers.map((helper, index) => {
                    const avatarClass = getAvatarClassFromHex(helper.color)
                    return (
                      <div
                        key={index}
                        className="px-4 py-2.5 border-b border-border-subtle/60 last:border-b-0 transition-colors hover:bg-page-muted"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6 flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0",
                                avatarClass
                              )}
                              style={avatarClass ? undefined : { backgroundColor: helper.color }}
                            >
                              {helper.initial}
                            </div>
                            <span className="text-sm text-foreground">{helper.name}</span>
                          </div>
                          <div className="col-span-3 text-sm text-foreground">{helper.tickets}</div>
                          <div className="col-span-2 text-sm text-foreground">{helper.time}</div>
                          <div className="col-span-1 flex justify-end">
                            <Link href={`/helpers/${helper.id}`}>
                              <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-muted-foreground cursor-pointer" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Issue Types Table */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-sm bg-brand-primary" />
                  <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-text-muted">Issue types</h2>
                  <span className="rounded-full bg-bg-subtle text-text-muted px-2 py-0.5 text-xs">
                    {filteredIssueTypes.length}
                  </span>
                </div>
                <TabSelector
                  options={[
                    { value: "all", label: "View all" },
                    { value: "applied", label: "Applied this period" },
                  ]}
                  value={issueFilter}
                  onChange={(value) => setIssueFilter(value as typeof issueFilter)}
                />
              </div>
              <Card className="border border-border-subtle rounded-xl py-0 shadow-none overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-bg-subtle px-6 py-2.5 border-b border-border-subtle">
                    <div className="grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <div
                        className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleIssueSort("name")}
                      >
                        Name
                        {getSortIcon("name", issueSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleIssueSort("tickets")}
                      >
                        No of tickets
                        {getSortIcon("tickets", issueSort)}
                      </div>
                      <div
                        className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-text-muted"
                        onClick={() => handleIssueSort("time")}
                      >
                        Total time
                        {getSortIcon("time", issueSort)}
                      </div>
                    </div>
                  </div>
                  {sortedIssueTypes.map((issue, index) => (
                    <div
                      key={index}
                      className="px-4 py-2.5 border-b border-border-subtle/60 last:border-b-0 transition-colors hover:bg-page-muted"
                    >
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
          </div>
        </main>
      </div>
    </div>
  )
}
