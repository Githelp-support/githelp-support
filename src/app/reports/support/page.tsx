"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

            <div className="bg-white rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={activeTab === "monthly" ? handleSelectAll : handleTicketSelectAll}
                      />
                    </TableHead>
                    {activeTab === "monthly" ? (
                      <>
                        <TableHead className="text-muted-foreground font-medium">Period</TableHead>
                        <TableHead className="text-muted-foreground font-medium">Description</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-muted-foreground font-medium">Ticket ID</TableHead>
                        <TableHead className="text-muted-foreground font-medium">Date</TableHead>
                        <TableHead className="text-muted-foreground font-medium">Helper</TableHead>
                      </>
                    )}
                    <TableHead className="text-muted-foreground font-medium">Amount</TableHead>
                    <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : activeTab === "monthly" ? (
                    filteredMonthlyReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No reports found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMonthlyReports.map((report) => (
                        <TableRow key={report.id} className="border-b border-border hover:bg-muted">
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.includes(report.id)}
                              onCheckedChange={() => handleRowSelect(report.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{report.period}</TableCell>
                          <TableCell className="text-muted-foreground">{report.description}</TableCell>
                          <TableCell className="text-foreground">{report.amount}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusBadgeClass(report.status)} hover:opacity-90`}>
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="h-8 text-muted-foreground bg-transparent">
                                Open
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-muted-foreground bg-transparent">
                                Download PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )
                  ) : ticketsData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    ticketsData.map((ticket) => (
                      <TableRow key={ticket.id} className="border-b border-border hover:bg-muted">
                        <TableCell>
                          <Checkbox
                            checked={selectedTicketRows.includes(ticket.id)}
                            onCheckedChange={() => handleTicketRowSelect(ticket.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {ticket.ticketId ? (
                            <Link
                              href={`/helper/tickets/${ticket.ticketId}`}
                              className="text-brand-primary hover:underline"
                            >
                              {getShortTicketId(ticket.ticketId)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ticket.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground"
                              style={{ backgroundColor: ticket.helperColor }}
                            >
                              {ticket.helperInitial}
                            </div>
                            <span className="text-foreground">{ticket.helper}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{ticket.amount}</TableCell>
                        <TableCell>
                          {ticket.statusType === "pending" ? (
                            <Badge className={`${getStatusBadgeClass("pending")} flex items-center gap-1 w-fit`}>
                              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                <circle cx="6" cy="6" r="2" fill="currentColor" />
                              </svg>
                              {ticket.status}
                            </Badge>
                          ) : ticket.statusType === "failed" ? (
                            <Badge className={`${getStatusBadgeClass("failed")} flex items-center gap-1 w-fit`}>
                              {ticket.status}
                            </Badge>
                          ) : (
                            <Badge className={`${getStatusBadgeClass("completed")} flex items-center gap-1 w-fit`}>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {ticket.ticketId ? (
                              <Button variant="outline" size="sm" className="h-8 text-muted-foreground bg-transparent" asChild>
                                <Link href={`/helper/tickets/${ticket.ticketId}`}>Open</Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 text-muted-foreground bg-transparent">
                                Open
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-8 text-muted-foreground bg-transparent">
                              Download PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
