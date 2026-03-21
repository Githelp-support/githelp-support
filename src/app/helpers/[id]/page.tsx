"use client"

import { useState, useMemo, use } from "react"
import { MessageCircle, Mail, Github, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useHelper } from "@/hooks/useHelpers"
import { useTimeEntries, formatTime, calculateTotalTime } from "@/hooks/useTimeEntries"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useHelperTickets } from "@/hooks/useHelperTickets"
import { useProjectSelection } from "@/contexts/project-context"

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

        <main className="flex-1 overflow-auto p-6">
          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold"
              style={{ backgroundColor: helper.avatarColor }}
            >
              {helper.avatar}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-foreground">{helper.name}</h1>
              <Badge variant="secondary" className="bg-brand-primary/10 text-muted-foreground border-0">
                {helper.category}
              </Badge>
            </div>
          </div>

          {/* Contact information */}
          <Card className="mb-8 border-border">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground">{helper.discord}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground">{helper.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Github className="w-5 h-5 text-muted-foreground" />
                  <span className="text-brand-primary">{helper.github}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time period filters */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={timeFilter === "current" ? "default" : "outline"}
              size="sm"
              className={
                timeFilter === "current"
                  ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                  : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
              }
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
                  className={`w-[180px] h-9 text-sm ${
                    timeFilter === "choose"
                      ? "bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/90"
                      : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
                  }`}
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
              variant={timeFilter === "all" ? "default" : "outline"}
              size="sm"
              className={
                timeFilter === "all"
                  ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                  : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
              }
              onClick={() => {
                setTimeFilter("all")
                setSelectedMonth("")
              }}
            >
              All time
            </Button>
          </div>

          {/* Key stats */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Key stats</h2>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{helper.stats.ticketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{helper.stats.totalTime}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{helper.stats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">All tickets</h2>
            <Card className="border-border py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-brand-primary/10">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          <input type="checkbox" className="mr-3" />
                          Ticket ID
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ticket type</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {helper.tickets.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-border hover:bg-muted">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" />
                              <span className="text-foreground font-medium">{ticket.id}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{ticket.date}</td>
                          <td className="p-4 text-muted-foreground">{ticket.type}</td>
                          <td className="p-4 text-muted-foreground">{ticket.amount}</td>
                          <td className="p-4">
                            <Badge
                              variant="secondary"
                              className={
                                ticket.status === "Completed"
                                  ? "bg-status-success-bg text-status-success-text border-0"
                                  : "bg-status-warning-bg text-status-warning-text border-0"
                              }
                            >
                              {ticket.status === "Completed" && "✓ "}
                              {ticket.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                              >
                                Open
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
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
