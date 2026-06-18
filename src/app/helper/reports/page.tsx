"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useProjectSelection } from "@/contexts/project-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
    PAYOUT_PREVIEW_ROWS,
    REPORTS_PAYOUTS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"

interface PayoutData {
  id: string
  ticketId: string
  date: string
  ticketType: string
  amount: string
  status: "pending" | "completed"
  hasPendingIndicator?: boolean
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
type MonthlySortField = "month" | "ticketsClosed" | "hoursLogged" | "earnings"
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

export default function HelperReportsPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "payouts">("payouts")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined
  const { data: helperId, isFetched: helperFetched } = useCurrentHelper(projectId)

  const transfersQueryEnabled = !!projectId && helperFetched && !!helperId

  // Fetch payment transfers only once we know the current user's helper row (avoids unscoped queries).
  const { data: transfersData, isLoading: transfersLoading, isFetched: transfersFetched } = usePaymentTransfers({
    helperId: helperId ?? undefined,
    projectId,
    enabled: transfersQueryEnabled,
  })

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

  // Transform transfers to UI format
  const payouts: PayoutData[] = useMemo(() => {
    if (!transfersData) return []
    let list = transfersData
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
  }, [transfersData, selectedFilter, selectedMonth])

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
    setSelectedRows(selectedRows.length === payouts.length ? [] : payouts.map((payout) => payout.id))
  }

  const payoutsListReady =
    !transfersQueryEnabled || (transfersFetched && !transfersLoading)

  /** Empty payouts after helper resolution; preview also when user has no helper row yet (same empty UI). */
  const showPayoutPreview =
    !!projectId && helperFetched && payoutsListReady && payouts.length === 0

  const showPayoutsBusy =
    !!projectId && (!helperFetched || (transfersQueryEnabled && transfersLoading))

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payouts" subtitle="Keep track of reports and transactions" />

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
            onClick={() => setActiveTab("payouts")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payouts"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Payouts
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {activeTab === "payouts" && (
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

      {/* Payouts Table */}
      {activeTab === "payouts" && (
        <>
        {showPayoutPreview && (
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
                  checked={selectedRows.length === payouts.length && payouts.length > 0}
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

          {showPayoutsBusy ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payouts...</div>
          ) : showPayoutPreview ? (
            <>
              {PAYOUT_PREVIEW_ROWS.map((payout) => (
                <div key={payout.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                    <div className="flex items-center">
                      <Checkbox disabled checked={false} />
                    </div>
                    <div className="col-span-2 text-sm text-gray-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono tabular-nums">{payout.ticketId}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Preview
                        </Badge>
                      </div>
                    </div>
                    <div className="col-span-1 text-sm text-muted-foreground">{payout.date}</div>
                    <div className="col-span-2">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                        {payout.ticketType}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-sm text-gray-900">{payout.amount}</div>
                    <div className="col-span-2">
                      <Badge
                        variant={payout.status === "completed" ? "default" : "secondary"}
                        className={
                          payout.status === "completed"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        }
                      >
                        {payout.status === "completed" ? "Completed" : "Pending"}
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
          ) : payouts.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No payouts found</div>
          ) : (
            payouts.map((payout) => (
              <div key={payout.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                  <div className="flex items-center">
                    <Checkbox
                      checked={selectedRows.includes(payout.id)}
                      onCheckedChange={() => handleRowSelect(payout.id)}
                    />
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums">{payout.ticketId}</span>
                      {payout.hasPendingIndicator && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    </div>
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground">{payout.date}</div>
                  <div className="col-span-2">
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                      {payout.ticketType}
                    </Badge>
                  </div>
                  <div className="col-span-1 text-sm text-gray-900">{payout.amount}</div>
                  <div className="col-span-2">
                    <Badge
                      variant={payout.status === "completed" ? "default" : "secondary"}
                      className={
                        payout.status === "completed"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                      }
                    >
                      {payout.status === "completed" ? (
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
                  onClick={() => handleMonthlySort("month")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Month</span>
                  <TicketsSortIcon field="month" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("ticketsClosed")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Tickets closed</span>
                  <TicketsSortIcon field="ticketsClosed" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("hoursLogged")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Hours logged</span>
                  <TicketsSortIcon field="hoursLogged" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
              <div className="col-span-3 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleMonthlySort("earnings")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Earnings</span>
                  <TicketsSortIcon field="earnings" sortField={monthlySortField} sortDirection={monthlySortDirection} />
                </button>
              </div>
            </div>
          </div>
          <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No monthly reports found</div>
        </div>
      )}
        </main>
      </div>
    </div>
  )
}
