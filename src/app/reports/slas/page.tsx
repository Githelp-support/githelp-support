"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useSLAs } from "@/hooks/useSLAs"
import { useProjectSelection } from "@/contexts/project-context"
import { getAvatarColorHexForId } from "@/lib/constants"

interface ReportData {
  id: string
  period: string
  periodRaw: number
  entity: string
  entityInitial: string
  entityColor: string
  amount: string
  amountRaw: number
  status: "paid-out" | "pending" | "processing"
}

interface TicketData {
  id: string
  date: string
  dateRaw: string
  entity: string
  entityInitial: string
  entityColor: string
  amount: string
  amountRaw: number
  status: "completed" | "pending" | "processing"
}

type MonthlySortField = "period" | "entity" | "amount" | "status"
type TicketsSortField = "date" | "entity" | "amount" | "status"
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

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Helper function to get month/year from date
const getMonthYear = (dateString: string) => {
  const date = new Date(dateString)
  const month = date.toLocaleDateString("en-US", { month: "long" })
  const year = date.getFullYear()
  return `${month} ${year}`
}

// Helper function to get initial and color for SLA
const getSlaInitialAndColor = (slaName: string, slaId: string | null | undefined) => {
  const initials = (slaName || '?').trim().charAt(0).toUpperCase() || '?'
  return {
    initial: initials,
    color: getAvatarColorHexForId(slaId),
  }
}

const months = [
  "January 2025",
  "February 2025",
  "March 2025",
  "April 2025",
  "May 2025",
  "June 2025",
  "July 2025",
  "August 2025",
  "September 2025",
  "October 2025",
  "November 2025",
  "December 2025",
]

export default function ReportsSLAsPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "tickets">("monthly")
  const [selectedMonth, setSelectedMonth] = useState("March 2025")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectedTicketRows, setSelectedTicketRows] = useState<string[]>([])
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const [ticketsSortField, setTicketsSortField] = useState<TicketsSortField | null>(null)
  const [ticketsSortDirection, setTicketsSortDirection] = useState<SortDirection>("asc")

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Fetch SLAs and payment transfers
  const { data: slasData } = useSLAs(projectId)
  const { data: transfersData, isLoading } = usePaymentTransfers({
    projectId,
    status: selectedFilter !== "all" ? selectedFilter : undefined,
  })

  // Aggregate monthly reports by SLA and period
  const reports: ReportData[] = useMemo(() => {
    if (!transfersData || !slasData) return []

    // Group transfers by SLA and month
    const grouped = new Map<string, { sla: any; month: string; total: number }>()

    transfersData.forEach((transfer) => {
      if (!transfer.sla || !transfer.completed_at) return

      const monthYear = getMonthYear(transfer.completed_at)
      const slaKey = (transfer.sla as any)?.id || (transfer as any)?.sla_id || "unknown-sla"
      const key = `${slaKey}-${monthYear}`

      if (!grouped.has(key)) {
        grouped.set(key, {
          sla: transfer.sla,
          month: monthYear,
          total: 0,
        })
      }

      const group = grouped.get(key)!
      group.total += transfer.amount_smallest_unit
    })

    // Convert to report format
    return Array.from(grouped.entries()).map(([key, data]) => {
      const { initial, color } = getSlaInitialAndColor((data.sla as any)?.name || "Unknown", (data.sla as any)?.id)
      return {
        id: key,
        period: data.month,
        periodRaw: new Date(data.month).getTime(),
        entity: (data.sla as any)?.name || "Unknown",
        entityInitial: initial,
        entityColor: color,
        amount: formatAmount(data.total, "usd"),
        amountRaw: data.total,
        status: "paid-out" as const,
      }
    })
  }, [transfersData, slasData])

  // Transform ticket transfers to ticket data
  const tickets: TicketData[] = useMemo(() => {
    if (!transfersData || !slasData) return []

    return transfersData
      .filter((transfer) => transfer.ticket_id && transfer.completed_at)
      .map((transfer) => {
        const { initial, color } = getSlaInitialAndColor(
          (transfer.sla as any)?.name || "Unknown",
          (transfer as any)?.sla_id ?? transfer.id,
        )
        return {
          id: transfer.id,
          date: formatDate(transfer.completed_at!),
          dateRaw: transfer.completed_at!,
          entity: (transfer.sla as any)?.name || "Unknown",
          entityInitial: initial,
          entityColor: color,
          amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
          amountRaw: transfer.amount_smallest_unit,
          status: transfer.status === "completed" ? "completed" : "pending",
        }
      })
  }, [transfersData, slasData])

  const sortedReports = useMemo(() => {
    if (!monthlySortField) return reports
    const sorted = [...reports]
    sorted.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      switch (monthlySortField) {
        case "period":
          aValue = a.periodRaw
          bValue = b.periodRaw
          break
        case "entity":
          aValue = a.entity.toLowerCase()
          bValue = b.entity.toLowerCase()
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
  }, [reports, monthlySortField, monthlySortDirection])

  const sortedTickets = useMemo(() => {
    if (!ticketsSortField) return tickets
    const sorted = [...tickets]
    sorted.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      switch (ticketsSortField) {
        case "date":
          aValue = new Date(a.dateRaw).getTime()
          bValue = new Date(b.dateRaw).getTime()
          break
        case "entity":
          aValue = a.entity.toLowerCase()
          bValue = b.entity.toLowerCase()
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
  }, [tickets, ticketsSortField, ticketsSortDirection])

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
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    setSelectedRows(selectedRows.length === sortedReports.length ? [] : sortedReports.map((report) => report.id))
  }

  const handleTicketRowSelect = (id: string) => {
    setSelectedTicketRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleTicketSelectAll = () => {
    setSelectedTicketRows(selectedTicketRows.length === sortedTickets.length ? [] : sortedTickets.map((ticket) => ticket.id))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Reports and Payouts"
          subtitle="Keep track of reports and transactions for your SLAs."
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="flex gap-1">
              <button type="button"
                onClick={() => setActiveTab("monthly")}
                className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                  activeTab === "monthly"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Monthly reports
              </button>
              <button type="button"
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
            {/* Full-width line below tabs */}
            <div className="h-px bg-border -mx-6"></div>
          </div>

          <div className="max-w-7xl space-y-6">
            {/* Filters */}
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

            {/* Monthly Reports Table */}
            {activeTab === "monthly" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                {/* Table Header */}
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        className="rounded border-border accent-brand-primary"
                        checked={selectedRows.length === sortedReports.length && sortedReports.length > 0}
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
                        onClick={() => handleMonthlySort("entity")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Entity</span>
                        <ReportsSortIcon field="entity" sortField={monthlySortField} sortDirection={monthlySortDirection} />
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
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading reports...</div>
                  ) : sortedReports.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No reports found</div>
                  ) : (
                    sortedReports.map((report) => (
                    <div key={report.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1">
                          <Checkbox
                            checked={selectedRows.includes(report.id)}
                            onCheckedChange={() => handleRowSelect(report.id)}
                            className="data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary data-[state=checked]:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{report.period}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: report.entityColor }}
                          >
                            {report.entityInitial}
                          </div>
                          <span className="text-sm text-foreground">{report.entity}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{report.amount}</span>
                        </div>
                        <div className="col-span-2">
                          <Badge variant="secondary" className="bg-status-success-bg text-status-success-text hover:opacity-90">
                            Paid out
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
                  )))}
                </div>
              </div>
            )}

            {activeTab === "tickets" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                {/* Table Header */}
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        className="rounded border-border accent-brand-primary"
                        checked={selectedTicketRows.length === sortedTickets.length && sortedTickets.length > 0}
                        onChange={handleTicketSelectAll}
                      />
                    </div>
                    <div className="col-span-2">
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
                        onClick={() => handleTicketsSort("entity")}
                        className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium text-foreground">Entity</span>
                        <ReportsSortIcon field="entity" sortField={ticketsSortField} sortDirection={ticketsSortDirection} />
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
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
                  ) : sortedTickets.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No tickets found</div>
                  ) : (
                    sortedTickets.map((ticket) => (
                    <div key={ticket.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1">
                          <Checkbox
                            checked={selectedTicketRows.includes(ticket.id)}
                            onCheckedChange={() => handleTicketRowSelect(ticket.id)}
                            className="data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary data-[state=checked]:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{ticket.date}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: ticket.entityColor }}
                          >
                            {ticket.entityInitial}
                          </div>
                          <span className="text-sm text-foreground">{ticket.entity}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{ticket.amount}</span>
                        </div>
                        <div className="col-span-2">
                          <Badge
                            variant="secondary"
                            className="bg-status-success-bg text-status-success-text flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M10 3L4.5 8.5L2 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Completed
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
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
