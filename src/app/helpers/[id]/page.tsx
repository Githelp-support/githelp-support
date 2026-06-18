"use client"

import { useState, useMemo, use } from "react"
import { MessageCircle, Mail, Info, ChevronsUpDown, ArrowLeft, HelpCircle } from "lucide-react"
import Link from "next/link"
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
import { getAvatarColorHexForId } from "@/lib/constants"
import { cn } from "@/lib/utils"

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

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

  const stats = useMemo(() => {
    const totalTime = timeEntriesData ? calculateTotalTime(timeEntriesData) : 0
    const tickets = helperTicketsData ?? []
    const completedCount = tickets.filter((t) => t.status === "completed").length

    return {
      ticketsSolved: completedCount,
      totalTime: formatTime(totalTime),
      percentageSolved:
        tickets.length > 0
          ? Math.round((completedCount / tickets.length) * 100)
          : 0,
    }
  }, [timeEntriesData, helperTicketsData])

  // Transform helper tickets to ticket list
  const tickets = useMemo(() => {
    if (!helperTicketsData || helperTicketsData.length === 0) {
      // Fallback to transfers if no tickets found via participants
      if (!transfersData) return []
      return transfersData.map((transfer) => ({
        id: transfer.ticket_id ?? "",
        displayId: transfer.ticket_id?.slice(0, 5) || "-",
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
        id: ticket.id,
        displayId: ticket.id.slice(0, 5),
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

  if (helperLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Helper Details" />
          <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 space-y-6">
            <div>Loading helper...</div>
          </main>
        </div>
      </div>
    )
  }

  if (!helperData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Helper Details" />
          <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 space-y-6">
            <div>Helper not found</div>
          </main>
        </div>
      </div>
    )
  }

  const helper = {
    id: helperData.helper_id,
    name: helperData.user?.name || "Unknown",
    avatar: (helperData.user?.name || "U")[0].toUpperCase(),
    avatarColor: getAvatarColorHexForId(helperData.user_id ?? helperData.helper_id),
    category: helperData.category || "Community",
    discord: helperData.user?.username || "-",
    email: helperData.user?.email || "-",
    github: helperData.user?.username || "-",
    stats,
    tickets,
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Helper Details" />

        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 space-y-6">
          {/* Back link */}
          <Link
            href="/helpers"
            className="inline-flex items-center text-brand-primary hover:text-brand-primary/80 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to list of helpers
          </Link>

          {/* Profile header + Contact information */}
          <Card className="border-border rounded-lg shadow-none py-0">
            <CardContent className="px-[30px] py-[30px] space-y-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-[16.5px] flex items-center justify-center text-[21px] font-medium text-foreground shrink-0"
                  style={{ backgroundColor: helper.avatarColor }}
                >
                  {helper.avatar}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-base font-semibold text-foreground">{helper.name}</h1>
                  <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-0 text-xs font-medium">
                    {helper.category.toLowerCase() === "core" ? "Core team" : helper.category}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 pl-[15px]">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-foreground/80 truncate">{helper.discord}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-foreground/80 truncate">{helper.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <GithubIcon className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-sm text-brand-primary truncate">{helper.github}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time period filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={timeFilter === "current" ? "neutral" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-[13px] font-medium",
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
              variant={timeFilter === "all" ? "neutral" : "outline"}
              size="sm"
              className={cn(
                "rounded-lg px-4 text-[13px] font-medium",
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

          {/* Key stats */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-foreground">Key stats</h2>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-[#D1D9DF] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{helper.stats.ticketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-[#D1D9DF] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{helper.stats.totalTime}</div>
                </CardContent>
              </Card>
              <Card className="border-[#D1D9DF] shadow-none h-28 py-0 justify-center rounded-lg">
                <CardContent className="px-[30px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[22px] font-[550] text-foreground tabular-nums">{helper.stats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">All tickets</h2>
            <Card className="border-border rounded-xl shadow-none py-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <Checkbox className="border-muted-foreground/40 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary" />
                            Ticket ID
                          </div>
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            Date
                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            Ticket type
                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            Amount
                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            Status
                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {helper.tickets.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Checkbox className="border-muted-foreground/40 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary" />
                              {ticket.id ? (
                                <Link
                                  href={`/helper/tickets/${ticket.id}`}
                                  className="text-sm text-foreground font-semibold hover:text-brand-primary font-mono tabular-nums"
                                >
                                  {ticket.displayId}
                                </Link>
                              ) : (
                                <span className="text-sm text-foreground font-semibold font-mono tabular-nums">{ticket.displayId}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">{ticket.date}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.type}</td>
                          <td className="px-4 py-3 text-sm text-foreground font-medium tabular-nums">{ticket.amount}</td>
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
                            <div className="flex gap-2 justify-end">
                              {ticket.id ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg border-border text-foreground text-xs font-medium px-3 py-1 hover:bg-muted/60 bg-transparent"
                                  asChild
                                >
                                  <Link href={`/helper/tickets/${ticket.id}`}>Open</Link>
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg border-border text-foreground text-xs font-medium px-3 py-1 hover:bg-muted/60 bg-transparent"
                                  disabled
                                >
                                  Open
                                </Button>
                              )}
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
