"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { getAvatarColorHexForId } from "@/lib/constants"
import { usePaymentTransfers, formatAmount, getHelperDisplayName } from "@/hooks/usePayments"
import { useProjectSelection } from "@/contexts/project-context"

type MonthlySortField = "period" | "description" | "amount" | "status"
type TicketsSortField = "ticketId" | "date" | "helper" | "amount" | "status"
type SortDirection = "asc" | "desc"

function ReportsSortIcon<T extends string>({
  field,
  sortField,
  sortDirection,
}: {
  field: T
  sortField: T | null
  sortDirection: SortDirection
}) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

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

function getHelperInitialAndColor(helperName: string | undefined, helperId: string | null | undefined) {
  const name = helperName || "?"
  const initial = (helperName || "?").trim().charAt(0).toUpperCase() || "?"
  const color = getAvatarColorHexForId(helperId ?? name)
  return { initial, color }
}

export default function ReportsSupportPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "tickets">("monthly")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectedTicketRows, setSelectedTicketRows] = useState<string[]>([])
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const [ticketsSortField, setTicketsSortField] = useState<TicketsSortField | null>(null)
  const [ticketsSortDirection, setTicketsSortDirection] = useState<SortDirection>("asc")

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
        periodRaw: new Date(data.month).getTime(),
        description: "Monthly report",
        amount: formatAmount(data.total, "usd"),
        amountRaw: data.total,
        status: "Paid out" as const,
      }))
      .sort((a, b) => b.periodRaw - a.periodRaw)
  }, [transfersData])

  // Tickets: individual payment transfers with ticket + helper info
  const ticketsData = useMemo(() => {
    if (!transfersData) return []

    let list = transfersData.map((transfer) => {
      const helperName = getHelperDisplayName(transfer.helper)
      const { initial, color } = getHelperInitialAndColor(helperName, transfer.helper_id)
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
        amountRaw: transfer.amount_smallest_unit,
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
    const list = !selectedMonth ? monthlyReports : monthlyReports.filter((r) => r.period === selectedMonth)
    if (!monthlySortField) return list
    const sorted = [...list]
    sorted.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      switch (monthlySortField) {
        case "period":
          aValue = a.periodRaw
          bValue = b.periodRaw
          break
        case "description":
          aValue = a.description.toLowerCase()
          bValue = b.description.toLowerCase()
          break
        case "amount":
          aValue = a.amountRaw
          bValue = b.amountRaw
          break
        case "status":
          aValue = a.status.toLowerCase()
          bValue = b.status.toLowerCase()
          break
        default:
          return 0
      }
      if (aValue < bValue) return monthlySortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return monthlySortDirection === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }, [monthlyReports, selectedMonth, monthlySortField, monthlySortDirection])

  const sortedTickets = useMemo(() => {
    if (!ticketsSortField) return ticketsData
    const sorted = [...ticketsData]
    sorted.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      switch (ticketsSortField) {
        case "ticketId":
          aValue = (a.ticketId ?? "").toLowerCase()
          bValue = (b.ticketId ?? "").toLowerCase()
          break
        case "date":
          aValue = new Date(a.dateRaw).getTime()
          bValue = new Date(b.dateRaw).getTime()
          break
        case "helper":
          aValue = a.helper.toLowerCase()
          bValue = b.helper.toLowerCase()
          break
        case "amount":
          aValue = a.amountRaw
          bValue = b.amountRaw
          break
        case "status":
          aValue = a.status.toLowerCase()
          bValue = b.status.toLowerCase()
          break
        default:
          return 0
      }
      if (aValue < bValue) return ticketsSortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return ticketsSortDirection === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }, [ticketsData, ticketsSortField, ticketsSortDirection])

  const handleMonthlySort = (field: MonthlySortField) => {
    if (monthlySortField === field) {
      if (monthlySortDirection === "asc") {
        setMonthlySortDirection("desc")
      } else {
        setMonthlySortField(null)
        setMonthlySortDirection("asc")
      }
    } else {
      setMonthlySortField(field)
      setMonthlySortDirection("asc")
    }
  }

  const handleTicketsSort = (field: TicketsSortField) => {
    if (ticketsSortField === field) {
      if (ticketsSortDirection === "asc") {
        setTicketsSortDirection("desc")
      } else {
        setTicketsSortField(null)
        setTicketsSortDirection("asc")
      }
    } else {
      setTicketsSortField(field)
      setTicketsSortDirection("asc")
    }
  }

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    const ids = activeTab === "monthly" ? filteredMonthlyReports.map((r) => r.id) : sortedTickets.map((t) => t.id)
    setSelectedRows((prev) => (prev.length === ids.length ? [] : ids))
  }

  const handleTicketRowSelect = (id: string) => {
    setSelectedTicketRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const handleTicketSelectAll = () => {
    setSelectedTicketRows((prev) =>
      prev.length === sortedTickets.length ? [] : sortedTickets.map((t) => t.id)
    )
  }

  const displayReports = activeTab === "monthly" ? filteredMonthlyReports : sortedTickets
  const allSelected =
    activeTab === "monthly"
      ? selectedRows.length === filteredMonthlyReports.length && filteredMonthlyReports.length > 0
      : selectedTicketRows.length === sortedTickets.length && sortedTickets.length > 0

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
                className="text-muted-foreground border-border hover:bg-muted bg-transparent"
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
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={allSelected}
                        onChange={handleSelectAll}
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleMonthlySort("period")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Period</span>
                        <ReportsSortIcon field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                      </button>
                    </div>
                    <div className="col-span-3">
                      <button
                        type="button"
                        onClick={() => handleMonthlySort("description")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Description</span>
                        <ReportsSortIcon field="description" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                      </button>
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleMonthlySort("amount")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Amount</span>
                        <ReportsSortIcon field="amount" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                      </button>
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleMonthlySort("status")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <ReportsSortIcon field="status" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                      </button>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                ) : (
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                    <div>
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={allSelected}
                        onChange={handleTicketSelectAll}
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => handleTicketsSort("ticketId")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Ticket ID</span>
                        <ReportsSortIcon field="ticketId" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
                      </button>
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => handleTicketsSort("date")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Date</span>
                        <ReportsSortIcon field="date" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
                      </button>
                    </div>
                    <div className="col-span-3">
                      <button
                        type="button"
                        onClick={() => handleTicketsSort("helper")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Helper</span>
                        <ReportsSortIcon field="helper" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
                      </button>
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleTicketsSort("amount")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Amount</span>
                        <ReportsSortIcon field="amount" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
                      </button>
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleTicketsSort("status")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <ReportsSortIcon field="status" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
                      </button>
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
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No reports found</div>
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
                ) : sortedTickets.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No tickets found</div>
                ) : (
                  sortedTickets.map((ticket) => (
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
                              className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
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
