"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HelpCircle, Info, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUser } from "@/contexts/user-context"
import { useUserTickets } from "@/hooks/useTicketsWithDetails"
import { useUserPayments, formatAmount } from "@/hooks/usePayments"
import { useUserRecentTicketInteractions } from "@/hooks/useUserRecentTicketInteractions"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import { monthLabel, toUserPaymentRow } from "@/lib/user-payment-reports"

const RECENT_TICKETS_LIMIT = 5

// `useUserTickets` selects every ticket column, but its row type does not
// declare completed_at; read it structurally so no cast is needed.
const completedAt = (ticket: { id: string; completed_at?: string | null }) => ticket.completed_at ?? null

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

export default function UserOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("all")

  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id || undefined
  const isAuthenticated = !!userId

  const { data: tickets = [], isLoading: ticketsLoading } = useUserTickets(userId)
  const { data: paymentRecords = [], isLoading: paymentsLoading } = useUserPayments(userId)
  const { data: recentTickets = [], isLoading: recentLoading } = useUserRecentTicketInteractions(
    userId,
    RECENT_TICKETS_LIMIT
  )

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

  const keyStats = useMemo(() => {
    const inPeriod = (dateString: string) => !targetMonth || monthLabel(dateString) === targetMonth

    const totalTickets = tickets.filter((ticket) => inPeriod(ticket.created_at)).length

    const completedTickets = tickets.filter(
      (ticket) =>
        ticket.status === "completed" && inPeriod(completedAt(ticket) ?? ticket.created_at)
    ).length

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

    return { totalTickets, completedTickets, totalSpent }
  }, [tickets, paymentRecords, targetMonth])

  const isLoading = userLoading || (isAuthenticated && ticketsLoading)
  const isSpendLoading = userLoading || (isAuthenticated && paymentsLoading)
  const isRecentLoading = userLoading || (isAuthenticated && recentLoading)

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
                    <div className="col-span-6">Ticket</div>
                    <div className="col-span-3">Status</div>
                    <div className="col-span-3">Last interaction</div>
                  </div>
                </div>
                {isRecentLoading ? (
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
                  recentTickets.map((ticket) => {
                    const projectName = ticket.project_name || "Project"
                    const lastInteraction = formatDate(ticket.last_interaction_at)
                    return (
                      <Link
                        key={ticket.id}
                        href={`/support/chat?ticket=${ticket.id}&project=${ticket.project_id}`}
                        className="block px-6 py-2.5 border-b border-[#E1E1E1] last:border-b-0 hover:bg-muted/50"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6">
                            <div className="flex items-start gap-[18px]">
                              <Avatar
                                key={`${ticket.project_logo_url ?? ""}|${projectName}`}
                                className="w-8 h-8 rounded-[11px] shrink-0"
                              >
                                {ticket.project_logo_url ? (
                                  <AvatarImage src={ticket.project_logo_url} alt={projectName} />
                                ) : null}
                                <AvatarFallback className="bg-brand-primary text-white text-sm font-medium rounded-[11px]">
                                  {(projectName?.[0] || "?").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-foreground hover:text-brand-primary cursor-pointer truncate">
                                  {projectName}
                                </h4>
                                <p className="text-sm text-muted-foreground">
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
                          <div className="col-span-3">
                            <div className="text-sm text-muted-foreground">
                              <div>{lastInteraction.split(", ")[0]}</div>
                              <div className="text-xs text-muted-foreground">
                                {lastInteraction.split(", ")[1]}
                              </div>
                            </div>
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
    </div>
  )
}
