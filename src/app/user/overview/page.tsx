"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HelpCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUser } from "@/contexts/user-context"
import { useUserTickets } from "@/hooks/useTicketsWithDetails"
import { useUserPayments, formatAmount } from "@/hooks/usePayments"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import { toUserPaymentRow } from "@/lib/user-payment-reports"

const RECENT_TICKETS_LIMIT = 5

// "2026-09" for the local calendar month of the given date.
const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

// dd/mm/yyyy, matching the user reports page
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()}`
}

// Match the Tickets page formatting: "in-progress" → "In Progress",
// otherwise capitalize the first letter.
const formatStatusLabel = (status: string) =>
  status === "in-progress"
    ? "In Progress"
    : status.charAt(0).toUpperCase() + status.slice(1)

const generateMonthOptions = () => {
  const months = []
  const now = new Date()

  for (let i = 1; i <= 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      value: toMonthKey(date),
      label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    })
  }

  return months
}

export default function UserOverviewPage() {
  const [timeFilter, setTimeFilter] = useState<"current" | "choose" | "all">("current")
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [currentMonthKey] = useState(() => toMonthKey(new Date()))
  const [monthOptions] = useState(generateMonthOptions)

  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id || undefined
  const isAuthenticated = !!userId

  const { data: tickets = [], isLoading: ticketsLoading } = useUserTickets(userId)
  const { data: paymentRecords = [], isLoading: paymentsLoading } = useUserPayments(userId)

  // null = no period restriction ("All time")
  const periodKey =
    timeFilter === "all" ? null : timeFilter === "choose" ? selectedMonth || null : currentMonthKey

  const keyStats = useMemo(() => {
    const inPeriod = (dateString: string) =>
      !periodKey || toMonthKey(new Date(dateString)) === periodKey

    const periodTickets = tickets.filter((ticket) => inPeriod(ticket.created_at))

    // Only what has actually been charged counts as spend (holds, failed and
    // cancelled payments are excluded), summed per currency.
    const spentByCurrency = new Map<string, number>()
    for (const record of paymentRecords) {
      const row = toUserPaymentRow(record)
      if (row.displayStatus !== "paid" || !inPeriod(row.date)) continue
      const currency = row.currency.toLowerCase()
      spentByCurrency.set(currency, (spentByCurrency.get(currency) ?? 0) + row.amountSmallestUnit)
    }

    const totalSpent =
      spentByCurrency.size === 0
        ? formatAmount(0)
        : Array.from(spentByCurrency.entries())
            .map(([currency, amount]) => formatAmount(amount, currency))
            .join(" + ")

    return {
      totalTickets: periodTickets.length,
      completedTickets: periodTickets.filter((ticket) => ticket.status === "completed").length,
      totalSpent,
    }
  }, [tickets, paymentRecords, periodKey])

  // The hook returns tickets newest first.
  const recentTickets = tickets.slice(0, RECENT_TICKETS_LIMIT)

  const isLoading = userLoading || (isAuthenticated && ticketsLoading)
  const isSpendLoading = userLoading || (isAuthenticated && paymentsLoading)

  const stats = [
    { label: "Number of tickets", value: isLoading ? "-" : keyStats.totalTickets },
    { label: "Tickets completed", value: isLoading ? "-" : keyStats.completedTickets },
    { label: "Total amount spent", value: isSpendLoading ? "-" : keyStats.totalSpent },
  ]

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
              {stats.map((stat) => (
                <Card
                  key={stat.label}
                  className="border-[#E1E1E1] shadow-none h-28 py-0 justify-center rounded-lg"
                >
                  <CardContent className="px-[30px]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="text-[22px] font-[550] text-foreground tabular-nums">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Tickets Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Recent tickets</h2>
              <Link
                href="/support/tickets"
                className="text-sm font-medium text-brand-primary hover:underline"
              >
                View all tickets
              </Link>
            </div>
            <Card className="border-[#E1E1E1] rounded-lg py-0 shadow-none overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                    <div className="col-span-5">Ticket</div>
                    <div className="col-span-3">Project</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Created</div>
                  </div>
                </div>
                {isLoading ? (
                  <div className="px-6 py-2.5">
                    <div className="text-sm text-muted-foreground">Loading your tickets...</div>
                  </div>
                ) : !isAuthenticated ? (
                  <div className="px-6 py-2.5">
                    <div className="text-sm text-muted-foreground">Sign in to see your tickets</div>
                  </div>
                ) : recentTickets.length === 0 ? (
                  <div className="px-6 py-2.5">
                    <div className="text-sm text-muted-foreground">No tickets to show</div>
                  </div>
                ) : (
                  recentTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/support/chat?ticket=${ticket.id}&project=${ticket.project_id}`}
                      className="block px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-5 text-sm text-foreground truncate">
                          {ticket.title?.trim() || "Untitled ticket"}
                        </div>
                        <div className="col-span-3 text-sm text-foreground truncate">
                          {ticket.project_name ?? "-"}
                        </div>
                        <div className="col-span-2">
                          <Badge className={cn("text-xs", getTicketStatusBadgeClass(ticket.status))}>
                            {formatStatusLabel(ticket.status)}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-sm text-foreground tabular-nums">
                          {formatDate(ticket.created_at)}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
