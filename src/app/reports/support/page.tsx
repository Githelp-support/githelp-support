"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useProjectSelection } from "@/contexts/project-context"

const HELPER_COLORS = ["#f4bccc", "#d0f6bc", "#f6e6bc", "#bcedf6", "#cbbcf6", "#82c95f"]

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function getMonthYear(dateString: string) {
  const date = new Date(dateString)
  const month = date.toLocaleDateString("en-US", { month: "long" })
  const year = date.getFullYear()
  return `${month} ${year}`
}

/** Extract a short ticket ID for display (e.g. from uuid 02735023-... to 2735023) */
function getShortTicketId(ticketId: string | null): string {
  if (!ticketId) return "—"
  const first = ticketId.split("-")[0] || ""
  return first.replace(/^0+/, "") || first.slice(0, 8)
}

function getHelperInitialAndColor(helperName: string | undefined, index: number) {
  const name = helperName || "?"
  const initial = name
    .split(/[\s.]/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
  const color = HELPER_COLORS[index % HELPER_COLORS.length]
  return { initial, color }
}

export default function ReportsSupportPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "tickets">("monthly")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectedTicketRows, setSelectedTicketRows] = useState<string[]>([])

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: transfersData, isLoading } = usePaymentTransfers({
    projectId,
    enabled: !!projectId,
  })

  // Generate months for dropdown
  const months = useMemo(() => {
    const result: string[] = []
    const currentDate = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      result.push(date.toLocaleDateString("en-US", { month: "long", year: "numeric" }))
    }
    return result
  }, [])

  // Monthly reports: aggregate payments_transfers by month (completed transfers)
  const monthlyReports = useMemo(() => {
    if (!transfersData) return []

    const grouped = new Map<string, { month: string; total: number }>()

    transfersData.forEach((transfer) => {
      const dateStr = transfer.completed_at || transfer.created_at
      const monthYear = getMonthYear(dateStr)

      if (!grouped.has(monthYear)) {
        grouped.set(monthYear, { month: monthYear, total: 0 })
      }
      const group = grouped.get(monthYear)!
      group.total += transfer.amount_smallest_unit
    })

    return Array.from(grouped.entries())
      .map(([key, data]) => ({
        id: key,
        period: data.month,
        description: "Monthly report",
        amount: formatAmount(data.total, "usd"),
        status: "Paid out" as const,
      }))
      .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
  }, [transfersData])

  // Tickets: individual payment transfers with ticket + helper info
  const ticketsData = useMemo(() => {
    if (!transfersData) return []

    let list = transfersData.map((transfer, index) => {
      const helperName = (transfer.helper as { user?: { name?: string } } | null)?.user?.name ?? "Unknown"
      const { initial, color } = getHelperInitialAndColor(helperName, index)
      const dateStr = transfer.completed_at || transfer.created_at
      return {
        id: transfer.id,
        ticketId: transfer.ticket_id,
        date: formatDate(dateStr),
        dateRaw: dateStr,
        helper: helperName,
        helperInitial: initial,
        helperColor: color,
        amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
        status: transfer.status === "completed" ? "Completed" : transfer.status === "failed" ? "Failed" : "Pending",
        statusType: transfer.status,
      }
    })

    // Filter by selected month
    if (selectedFilter === "current" || selectedMonth) {
      const targetMonth = selectedMonth || getMonthYear(new Date().toISOString())
      list = list.filter((t) => getMonthYear(t.dateRaw) === targetMonth)
    }

    return list.sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime())
  }, [transfersData, selectedMonth, selectedFilter])

  // Filter monthly reports by selected month
  const filteredMonthlyReports = useMemo(() => {
    if (!selectedMonth) return monthlyReports
    return monthlyReports.filter((r) => r.period === selectedMonth)
  }, [monthlyReports, selectedMonth])

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    const ids = activeTab === "monthly" ? filteredMonthlyReports.map((r) => r.id) : ticketsData.map((t) => t.id)
    setSelectedRows((prev) => (prev.length === ids.length ? [] : ids))
  }

  const handleTicketRowSelect = (id: string) => {
    setSelectedTicketRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const handleTicketSelectAll = () => {
    setSelectedTicketRows((prev) =>
      prev.length === ticketsData.length ? [] : ticketsData.map((t) => t.id)
    )
  }

  const displayReports = activeTab === "monthly" ? filteredMonthlyReports : ticketsData
  const allSelected =
    activeTab === "monthly"
      ? selectedRows.length === filteredMonthlyReports.length && filteredMonthlyReports.length > 0
      : selectedTicketRows.length === ticketsData.length && ticketsData.length > 0

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payouts" subtitle="Keep track of reports and transactions for support." />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("monthly")}
                  className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                    activeTab === "monthly"
                      ? "text-brand-primary border-brand-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  Monthly reports
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tickets")}
                  className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                    activeTab === "tickets"
                      ? "text-brand-primary border-brand-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  Tickets
                </button>
              </div>
              <div className="h-px bg-border -mx-6" />
            </div>

            <div className="flex gap-2 mb-6">
              {activeTab === "tickets" && (
                <Button
                  variant={selectedFilter === "current" ? "default" : "outline"}
                  size="sm"
                  className={
                    selectedFilter === "current"
                      ? "h-9 text-brand-primary border-brand-primary hover:bg-brand-primary/10 bg-brand-primary/10"
                      : "h-9 text-muted-foreground border-border hover:bg-muted bg-transparent"
                  }
                  onClick={() => {
                    setSelectedFilter("current")
                    setSelectedMonth("")
                  }}
                >
                  Current month
                </Button>
              )}
              <Select
                value={selectedMonth}
                onValueChange={(v) => {
                  setSelectedMonth(v)
                  if (v) setSelectedFilter("all")
                }}
              >
                <SelectTrigger className="w-[180px] h-9 text-muted-foreground">
                  <SelectValue placeholder="Choose month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-9 text-muted-foreground border-border hover:bg-muted bg-transparent"
                onClick={() => {
                  setSelectedFilter("all")
                  setSelectedMonth("")
                }}
              >
                All
              </Button>
            </div>

            <div className="bg-white rounded-lg border border-border overflow-hidden">
              {/* Table Header */}
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                {activeTab === "monthly" ? (
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                    <div>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Period</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm font-medium text-foreground">Description</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Amount</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Status</span>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                ) : (
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                    <div>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleTicketSelectAll}
                      />
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-medium text-foreground">Ticket ID</span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-medium text-foreground">Date</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm font-medium text-foreground">Helper</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Amount</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Status</span>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                )}
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border">
                {isLoading ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">Loading...</div>
                ) : activeTab === "monthly" ? (
                  filteredMonthlyReports.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">No reports found</div>
                  ) : (
                    filteredMonthlyReports.map((report) => (
                      <div key={report.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                          <div>
                            <Checkbox
                              checked={selectedRows.includes(report.id)}
                              onCheckedChange={() => handleRowSelect(report.id)}
                            />
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm font-medium text-foreground">{report.period}</span>
                          </div>
                          <div className="col-span-3">
                            <span className="text-sm text-muted-foreground">{report.description}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm text-foreground">{report.amount}</span>
                          </div>
                          <div className="col-span-2">
                            <Badge className={`${getStatusBadgeClass(report.status)} hover:opacity-90 text-[13px] px-3 py-1`}>
                              {report.status}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                            >
                              Open
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                            >
                              Download PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : ticketsData.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">No tickets found</div>
                ) : (
                  ticketsData.map((ticket) => (
                    <div key={ticket.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                        <div>
                          <Checkbox
                            checked={selectedTicketRows.includes(ticket.id)}
                            onCheckedChange={() => handleTicketRowSelect(ticket.id)}
                          />
                        </div>
                        <div className="col-span-1">
                          {ticket.ticketId ? (
                            <Link
                              href={`/helper/tickets/${ticket.ticketId}`}
                              className="text-sm font-medium text-brand-primary hover:underline"
                            >
                              {getShortTicketId(ticket.ticketId)}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-foreground">—</span>
                          )}
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm text-muted-foreground">{ticket.date}</span>
                        </div>
                        <div className="col-span-3 flex items-center gap-[18px]">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: ticket.helperColor }}
                          >
                            {ticket.helperInitial}
                          </div>
                          <span className="text-sm font-medium text-foreground">{ticket.helper}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{ticket.amount}</span>
                        </div>
                        <div className="col-span-2">
                          {ticket.statusType === "pending" ? (
                            <Badge className={`${getStatusBadgeClass("pending")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
                              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                <circle cx="6" cy="6" r="2" fill="currentColor" />
                              </svg>
                              {ticket.status}
                            </Badge>
                          ) : ticket.statusType === "failed" ? (
                            <Badge className={`${getStatusBadgeClass("failed")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
                              {ticket.status}
                            </Badge>
                          ) : (
                            <Badge className={`${getStatusBadgeClass("completed")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
                              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M10 3L4.5 8.5L2 6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {ticket.status}
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-2 flex items-center justify-end space-x-2">
                          {ticket.ticketId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                              asChild
                            >
                              <Link href={`/helper/tickets/${ticket.ticketId}`}>Open</Link>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                            >
                              Open
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                          >
                            Download PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
