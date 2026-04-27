"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useSLAs } from "@/hooks/useSLAs"
import { useProjectSelection } from "@/contexts/project-context"

interface ReportData {
  id: string
  period: string
  entity: string
  entityInitial: string
  entityColor: string
  amount: string
  status: "paid-out" | "pending" | "processing"
}

interface TicketData {
  id: string
  date: string
  entity: string
  entityInitial: string
  entityColor: string
  amount: string
  status: "completed" | "pending" | "processing"
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
const getSlaInitialAndColor = (slaName: string, index: number) => {
  const initials = slaName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  const colors = ["#82c95f", "#f09191", "#4aa19e", "#cbbcf6", "#f4bccc"]
  return {
    initial: initials,
    color: colors[index % colors.length],
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
    return Array.from(grouped.entries()).map(([key, data], index) => {
      const { initial, color } = getSlaInitialAndColor((data.sla as any)?.name || "Unknown", index)
      return {
        id: key,
        period: data.month,
        entity: (data.sla as any)?.name || "Unknown",
        entityInitial: initial,
        entityColor: color,
        amount: formatAmount(data.total, "usd"),
        status: "paid-out" as const,
      }
    })
  }, [transfersData, slasData])

  // Transform ticket transfers to ticket data
  const tickets: TicketData[] = useMemo(() => {
    if (!transfersData || !slasData) return []

    return transfersData
      .filter((transfer) => transfer.ticket_id && transfer.completed_at)
      .map((transfer, index) => {
        const { initial, color } = getSlaInitialAndColor((transfer.sla as any)?.name || "Unknown", index)
        return {
          id: transfer.id,
          date: formatDate(transfer.completed_at!),
          entity: (transfer.sla as any)?.name || "Unknown",
          entityInitial: initial,
          entityColor: color,
          amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
          status: transfer.status === "completed" ? "completed" : "pending",
        }
      })
  }, [transfersData, slasData])

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    setSelectedRows(selectedRows.length === reports.length ? [] : reports.map((report) => report.id))
  }

  const handleTicketRowSelect = (id: string) => {
    setSelectedTicketRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleTicketSelectAll = () => {
    setSelectedTicketRows(selectedTicketRows.length === tickets.length ? [] : tickets.map((ticket) => ticket.id))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Reports and Payouts"
          subtitle="Keep track of reports and transactions for your SLAs."
        />

        <main className="flex-1 py-6 px-[30px] overflow-y-auto">
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
            <div className="flex items-center gap-4">
              {activeTab === "tickets" ? (
                <>
                  <Button
                    variant={selectedFilter === "current" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFilter("current")}
                    className={
                      selectedFilter === "current"
                        ? "bg-brand-primary hover:bg-brand-primary/90 text-white h-9"
                        : "text-muted-foreground border-border hover:bg-muted bg-white h-9"
                    }
                  >
                    Current month
                  </Button>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px] h-9 text-muted-foreground border-border">
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
                    variant={selectedFilter === "all" ? "lavender" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFilter("all")}
                    className={
                      selectedFilter === "all"
                        ? "bg-brand-primary hover:bg-brand-primary/90 text-white h-9"
                        : "text-muted-foreground border-border hover:bg-muted bg-white h-9"
                    }
                  >
                    All
                  </Button>
                </>
              ) : (
                <>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px] h-9 text-muted-foreground border-border">
                      <SelectValue />
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
                    onClick={() => setSelectedFilter("all")}
                    className={
                      selectedFilter === "all"
                        ? "bg-brand-primary hover:bg-brand-primary/90 text-white h-9"
                        : "text-muted-foreground border-border hover:bg-muted bg-white h-9"
                    }
                  >
                    All
                  </Button>
                </>
              )}
            </div>

            {/* Monthly Reports Table */}
            {activeTab === "monthly" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                {/* Table Header */}
                <div className="bg-muted px-6 py-3 border-b border-border">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <Checkbox
                        checked={selectedRows.length === reports.length && reports.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Period</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm font-medium text-foreground">Entity</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Amount</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Status</span>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading reports...</div>
                  ) : reports.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">No reports found</div>
                  ) : (
                    reports.map((report) => (
                    <div key={report.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1">
                          <Checkbox
                            checked={selectedRows.includes(report.id)}
                            onCheckedChange={() => handleRowSelect(report.id)}
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{report.period}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback
                              className="text-sm font-medium text-foreground"
                              style={{ backgroundColor: report.entityColor }}
                            >
                              {report.entityInitial}
                            </AvatarFallback>
                          </Avatar>
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
                            className="text-muted-foreground border-border hover:bg-muted bg-white"
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground border-border hover:bg-muted bg-white"
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
                <div className="bg-muted px-6 py-3 border-b border-border">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <Checkbox
                        checked={selectedTicketRows.length === tickets.length && tickets.length > 0}
                        onCheckedChange={handleTicketSelectAll}
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Date</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm font-medium text-foreground">Entity</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Amount</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-foreground">Status</span>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
                  ) : tickets.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">No tickets found</div>
                  ) : (
                    tickets.map((ticket) => (
                    <div key={ticket.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1">
                          <Checkbox
                            checked={selectedTicketRows.includes(ticket.id)}
                            onCheckedChange={() => handleTicketRowSelect(ticket.id)}
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{ticket.date}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback
                              className="text-sm font-medium text-foreground"
                              style={{ backgroundColor: ticket.entityColor }}
                            >
                              {ticket.entityInitial}
                            </AvatarFallback>
                          </Avatar>
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
                            className="text-muted-foreground border-border hover:bg-muted bg-white"
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground border-border hover:bg-muted bg-white"
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
