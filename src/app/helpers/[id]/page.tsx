"use client"

import { useState, useMemo, use } from "react"
import { MessageCircle, Send, Cone, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useHelper } from "@/hooks/useHelpers"
import { useTimeEntries, formatTime, calculateTotalTime } from "@/hooks/useTimeEntries"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useHelperTickets } from "@/hooks/useHelperTickets"
import { useProjectSelection } from "@/contexts/project-context"
import { cn } from "@/lib/utils"

export default function HelperProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [timeFilter, setTimeFilter] = useState<"current" | "choose" | "all">("current")
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  // Unwrap params Promise
  const { id } = use(params)

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Fetch helper data
  const { data: helperData, isLoading: helperLoading } = useHelper(id)
  const { data: helperTicketsData } = useHelperTickets(id, projectId)
  const { data: timeEntriesData } = useTimeEntries({
    helperId: id,
    projectId,
  })
  const { data: transfersData } = usePaymentTransfers({
    helperId: id,
    projectId,
  })

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

  // Calculate stats from time entries
  const stats = useMemo(() => {
    if (!timeEntriesData) {
      return { ticketsSolved: 0, totalTime: "0min", percentageSolved: 0 }
    }

    const completedTickets = new Set(timeEntriesData.map((entry) => entry.ticket_id))
    const totalTime = calculateTotalTime(timeEntriesData)

    return {
      ticketsSolved: completedTickets.size,
      totalTime: formatTime(totalTime),
      percentageSolved: 85, // TODO: Calculate from actual completion rate
    }
  }, [timeEntriesData])

  // Transform helper tickets to ticket list
  const tickets = useMemo(() => {
    if (!helperTicketsData || helperTicketsData.length === 0) {
      // Fallback to transfers if no tickets found via participants
      if (!transfersData) return []
      return transfersData.map((transfer) => ({
        id: transfer.ticket_id?.slice(0, 5) || "-",
        date: transfer.completed_at ? new Date(transfer.completed_at).toLocaleDateString("en-GB") : "-",
        type: "Bug", // TODO: Get from ticket
        amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
        status: transfer.status === "completed" ? "Completed" : "In progress",
      }))
    }

    // Create a map of transfers by ticket_id for amount lookup
    const transfersMap = new Map(
      (transfersData || []).map((transfer) => [
        transfer.ticket_id,
        transfer,
      ])
    )

    return helperTicketsData.map((ticket) => {
      const transfer = transfersMap.get(ticket.id)
      return {
        id: ticket.id.slice(0, 5),
        date: ticket.completed_at
          ? new Date(ticket.completed_at).toLocaleDateString("en-GB")
          : ticket.created_at
            ? new Date(ticket.created_at).toLocaleDateString("en-GB")
            : "-",
        type: "Bug", // TODO: Get from ticket help category
        amount: transfer
          ? formatAmount(transfer.amount_smallest_unit, transfer.currency)
          : "-",
        status:
          ticket.status === "completed"
            ? "Completed"
            : ticket.status === "in-progress"
              ? "In progress"
              : ticket.status === "available"
                ? "Available"
                : "Unknown",
      }
    })
  }, [helperTicketsData, transfersData])

  const helperColors = ["#f4bccc", "#d1f7ea", "#bcedf6", "#f6e6bc", "#cbbcf6"]

  if (helperLoading) {
    return <div>Loading helper...</div>
  }

  if (!helperData) {
    return <div>Helper not found</div>
  }

  const helper = {
    id: helperData.helper_id,
    name: helperData.user?.name || "Unknown",
    avatar: (helperData.user?.name || "U")[0].toUpperCase(),
    avatarColor: helperColors[0],
    category: helperData.category || "Community",
    discord: helperData.user?.username || "-",
    email: helperData.user?.email || "-",
    github: helperData.user?.username || "-",
    stats,
    tickets,
  }

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Helper Details" showBackButton={true} backButtonText="Back to list of helpers" backButtonHref="/helpers" />

        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 space-y-6">
          {/* Profile header */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[18.8px] flex items-center justify-center text-white text-base font-semibold shrink-0"
              style={{ backgroundColor: helper.avatarColor }}
            >
              {helper.avatar}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{helper.name}</h1>
              <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-0 text-xs font-medium">
                {helper.category.toLowerCase() === "core" ? "Core team" : helper.category}
              </Badge>
            </div>
          </div>

          {/* Contact information */}
          <Card className="border-border rounded-lg shadow-none">
            <CardContent className="px-5 py-[6px]">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-foreground/80 truncate">{helper.discord}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-foreground/80 truncate">{helper.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Cone className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-brand-primary truncate">{helper.github}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time period filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={timeFilter === "current" ? "lavender" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-[13px] font-medium",
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
                  className="w-[160px] rounded-lg text-[13px] font-medium"
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
            </div>
            <Button
              variant={timeFilter === "all" ? "lavender" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-[13px] font-medium",
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

          {/* Key stats */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-medium text-foreground">Key stats</h2>
              <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="border-border rounded-xl shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-muted-foreground/70">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{helper.stats.ticketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-border rounded-xl shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-muted-foreground/70">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{helper.stats.totalTime}</div>
                </CardContent>
              </Card>
              <Card className="border-border rounded-xl shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-muted-foreground/70">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{helper.stats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">All tickets</h2>
            <Card className="border-border rounded-xl shadow-none py-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          <div className="flex items-center gap-3">
                            <Checkbox className="border-muted-foreground/40 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary" />
                            Ticket ID
                          </div>
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticket type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {helper.tickets.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Checkbox className="border-muted-foreground/40 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary" />
                              <span className="text-sm text-foreground font-semibold">{ticket.id}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.date}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.type}</td>
                          <td className="px-4 py-3 text-sm text-foreground font-medium">{ticket.amount}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-medium px-2.5 py-0.5 rounded-full border-0",
                                ticket.status === "Completed"
                                  ? "bg-status-success-bg text-status-success-text"
                                  : "bg-status-warning-bg text-status-warning-text"
                              )}
                            >
                              {ticket.status === "Completed" && "✓ "}
                              {ticket.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg border-border text-foreground text-xs font-medium px-3 py-1 hover:bg-muted/60 bg-transparent"
                              >
                                Open
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg border-border text-muted-foreground text-xs font-medium px-3 py-1 hover:bg-muted/60 bg-transparent"
                              >
                                Download PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

      </div>
    </div>
  )
}
