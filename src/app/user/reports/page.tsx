"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useProjectSelection } from "@/contexts/project-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
    PAYOUT_PREVIEW_ROWS,
    REPORTS_PAYOUTS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"

interface PaymentData {
  id: string
  ticketId: string
  date: string
  ticketType: string
  amount: string
  status: "pending" | "completed"
  hasPendingIndicator?: boolean
}

interface MonthlyData {
  id: string
  period: string
  periodRaw: number
  amount: string
  amountRaw: number
  status: "Paid"
}

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Helper function to get the "Month Year" label used by the month filter
const getMonthYear = (dateString: string) => {
  const date = new Date(dateString)
  const month = date.toLocaleDateString("en-US", { month: "long" })
  const year = date.getFullYear()
  return `${month} ${year}`
}

type SortField = "ticketId" | "date" | "ticketType" | "amount" | "status"
type MonthlySortField = "period" | "amount" | "status"
type SortDirection = "asc" | "desc"

function TicketsSortIcon({ field, sortField, sortDirection }: { field: string; sortField: string | null; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

export default function UserReportsPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "payments">("payments")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const transfersQueryEnabled = !!projectId

  // Fetch payment transfers scoped to the current project (no helperId — this is the user's view).
  const { data: transfersData, isLoading: transfersLoading, isFetched: transfersFetched } = usePaymentTransfers({
    projectId,
    enabled: transfersQueryEnabled,
  })

  // The user's perspective: only transfers that have been paid (status === "completed").
  const userPaidTransfers = useMemo(() => {
    if (!transfersData) return []
    return transfersData.filter((transfer) => transfer.status === "completed")
  }, [transfersData])

  // Generate the last 12 months for the month filter dropdown
  const months = useMemo(() => {
    const result: string[] = []
    const currentDate = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      result.push(date.toLocaleDateString("en-US", { month: "long", year: "numeric" }))
    }
    return result
  }, [])

  // Transform user-paid transfers to UI format for the Payments tab
  const payments: PaymentData[] = useMemo(() => {
    let list = userPaidTransfers
    if (selectedFilter === "current" || selectedMonth) {
      const targetMonth = selectedMonth || getMonthYear(new Date().toISOString())
      list = list.filter((transfer) => getMonthYear(transfer.created_at) === targetMonth)
    }
    return list.map((transfer) => ({
      id: transfer.id,
      ticketId: transfer.ticket_id?.slice(0, 7) || "-",
      date: transfer.created_at ? formatDate(transfer.created_at) : "-",
      ticketType: "Bug", // TODO: Get from ticket help category
      amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
      status: transfer.status as "pending" | "completed",
      hasPendingIndicator: transfer.status === "pending",
    }))
  }, [userPaidTransfers, selectedFilter, selectedMonth])

  // Aggregate the user's monthly spending across the selected project — group transfers by month.
  const monthlyReports: MonthlyData[] = useMemo(() => {
    if (userPaidTransfers.length === 0) return []

    const grouped = new Map<string, { month: string; total: number; currency: string }>()

    userPaidTransfers.forEach((transfer) => {
      const dateStr = transfer.completed_at || transfer.created_at
      const monthYear = getMonthYear(dateStr)
      if (!grouped.has(monthYear)) {
        grouped.set(monthYear, { month: monthYear, total: 0, currency: transfer.currency || "usd" })
      }
      const group = grouped.get(monthYear)!
      group.total += transfer.amount_smallest_unit
    })

    let list: MonthlyData[] = Array.from(grouped.entries()).map(([key, data]) => ({
      id: key,
      period: data.month,
      periodRaw: new Date(data.month).getTime(),
      amount: formatAmount(data.total, data.currency),
      amountRaw: data.total,
      status: "Paid" as const,
    }))

    if (selectedFilter === "current" || selectedMonth) {
      const targetMonth = selectedMonth || getMonthYear(new Date().toISOString())
      list = list.filter((row) => row.period === targetMonth)
    }

    if (!monthlySortField) {
      return list.sort((a, b) => b.periodRaw - a.periodRaw)
    }

    const sorted = [...list]
    sorted.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      switch (monthlySortField) {
        case "period":
          aValue = a.periodRaw
          bValue = b.periodRaw
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
  }, [userPaidTransfers, selectedFilter, selectedMonth, monthlySortField, monthlySortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleMonthlySort = (field: MonthlySortField) => {
    if (monthlySortField === field) {
      setMonthlySortDirection(monthlySortDirection === "asc" ? "desc" : "asc")
    } else {
      setMonthlySortField(field)
      setMonthlySortDirection("asc")
    }
  }

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    setSelectedRows(selectedRows.length === payments.length ? [] : payments.map((payment) => payment.id))
  }

  const paymentsListReady =
    !transfersQueryEnabled || (transfersFetched && !transfersLoading)

  /** Empty payments after data resolution; preview shows sample rows for layout. */
  const showPaymentsPreview =
    !!projectId && paymentsListReady && payments.length === 0

  const showPaymentsBusy =
    !!projectId && transfersQueryEnabled && transfersLoading

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payments" subtitle="Keep track of your support spending and payments." />

        <main className="flex-1 overflow-auto p-6 space-y-6">

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button type="button"
            onClick={() => setActiveTab("monthly")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "monthly"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Monthly reports
          </button>
          <button type="button"
            onClick={() => setActiveTab("payments")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payments"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Payments
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {activeTab === "payments" && (
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

      {/* Payments Table */}
      {activeTab === "payments" && (
        <>
        {showPaymentsPreview && (
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
            {REPORTS_PAYOUTS_PREVIEW_DISCLAIMER}
          </div>
        )}
        <div className="bg-white rounded-lg border border-[#D1D9DF] overflow-hidden shadow-none">
          <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
            <div className="grid gap-4 items-center text-sm font-medium text-foreground" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={selectedRows.length === payments.length && payments.length > 0}
                  onChange={handleSelectAll}
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("ticketId")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Ticket ID</span>
                  <TicketsSortIcon field="ticketId" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-1 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("date")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Date</span>
                  <TicketsSortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("ticketType")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Ticket type</span>
                  <TicketsSortIcon field="ticketType" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-1 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("amount")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Amount</span>
                  <TicketsSortIcon field="amount" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("status")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <TicketsSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </div>
            </div>
          </div>

          {showPaymentsBusy ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payments...</div>
          ) : showPaymentsPreview ? (
            <>
              {PAYOUT_PREVIEW_ROWS.map((payment) => (
                <div key={payment.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                    <div className="flex items-center">
                      <Checkbox disabled checked={false} />
                    </div>
                    <div className="col-span-2 text-sm text-gray-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono tabular-nums">{payment.ticketId}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Preview
                        </Badge>
                      </div>
                    </div>
                    <div className="col-span-1 text-sm text-muted-foreground">{payment.date}</div>
                    <div className="col-span-2">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                        {payment.ticketType}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-sm text-gray-900">{payment.amount}</div>
                    <div className="col-span-2">
                      <Badge
                        variant={payment.status === "completed" ? "default" : "secondary"}
                        className={
                          payment.status === "completed"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        }
                      >
                        {payment.status === "completed" ? "Completed" : "Pending"}
                      </Badge>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                        >
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                        >
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : payments.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No payments found</div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                  <div className="flex items-center">
                    <Checkbox
                      checked={selectedRows.includes(payment.id)}
                      onCheckedChange={() => handleRowSelect(payment.id)}
                    />
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums">{payment.ticketId}</span>
                      {payment.hasPendingIndicator && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    </div>
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground">{payment.date}</div>
                  <div className="col-span-2">
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                      {payment.ticketType}
                    </Badge>
                  </div>
                  <div className="col-span-1 text-sm text-gray-900">{payment.amount}</div>
                  <div className="col-span-2">
                    <Badge
                      variant={payment.status === "completed" ? "default" : "secondary"}
                      className={
                        payment.status === "completed"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                      }
                    >
                      {payment.status === "completed" ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Completed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Pending
                        </div>
                      )}
                    </Badge>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
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
              </div>
            ))
          )}
        </div>
        </>
      )}

      {/* Monthly Reports Tab Content */}
      {activeTab === "monthly" && (
        <div className="bg-white rounded-lg border border-[#D1D9DF] overflow-hidden shadow-none">
          <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("period")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Period</span>
                  <TicketsSortIcon field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("amount")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Amount spent</span>
                  <TicketsSortIcon field="amount" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("status")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <TicketsSortIcon field="status" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </div>
            </div>
          </div>
          {showPaymentsBusy ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payments...</div>
          ) : monthlyReports.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No monthly reports found</div>
          ) : (
            monthlyReports.map((row) => (
              <div key={row.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3 text-sm text-gray-900">{row.period}</div>
                  <div className="col-span-3 text-sm text-gray-900">{row.amount}</div>
                  <div className="col-span-3">
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
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
              </div>
            ))
          )}
        </div>
      )}
        </main>
      </div>
    </div>
  )
}
