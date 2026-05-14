"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronUpIcon, ChevronDownIcon } from "lucide-react"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useProjectSelection } from "@/contexts/project-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
    MONTHLY_PREVIEW_STATS,
    PAYOUT_PREVIEW_ROWS,
    REPORTS_MONTHLY_PREVIEW_DISCLAIMER,
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

type SortField = "ticketId" | "date" | "ticketType" | "amount" | "status"
type SortDirection = "asc" | "desc"

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) {
  if (sortField !== field) return null
  return sortDirection === "asc" ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
}

export default function HelperReportsPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "payouts">("payouts")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined
  const { data: helperId, isFetched: helperFetched } = useCurrentHelper(projectId)

  const transfersQueryEnabled = !!projectId && helperFetched && !!helperId

  // Fetch payment transfers only once we know the current user's helper row (avoids unscoped queries).
  const { data: transfersData, isLoading: transfersLoading, isFetched: transfersFetched } = usePaymentTransfers({
    helperId: helperId ?? undefined,
    projectId,
    status: selectedFilter !== "all" ? selectedFilter : undefined,
    enabled: transfersQueryEnabled,
  })

  // Transform transfers to UI format
  const payouts: PayoutData[] = useMemo(() => {
    if (!transfersData) return []
    return transfersData.map((transfer) => ({
      id: transfer.id,
      ticketId: transfer.ticket_id?.slice(0, 7) || "-",
      date: transfer.created_at ? formatDate(transfer.created_at) : "-",
      ticketType: "Bug", // TODO: Get from ticket help category
      amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
      status: transfer.status as "pending" | "completed",
      hasPendingIndicator: transfer.status === "pending",
    }))
  }, [transfersData])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
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
        <Header title="Payouts and Reports" subtitle="Keep track of reports and transactions" />

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
      <div className="flex items-center gap-4">
        <Button
          variant={selectedFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedFilter("all")}
          className={selectedFilter === "all" ? "bg-brand-primary hover:bg-brand-primary/90" : ""}
        >
          All
        </Button>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Choose month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="january">January</SelectItem>
            <SelectItem value="february">February</SelectItem>
            <SelectItem value="march">March</SelectItem>
            <SelectItem value="april">April</SelectItem>
            <SelectItem value="may">May</SelectItem>
            <SelectItem value="june">June</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payouts Table */}
      {activeTab === "payouts" && (
        <div className="bg-white rounded-lg border border-gray-200 py-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <Checkbox checked={selectedRows.length === payouts.length && payouts.length > 0} onCheckedChange={handleSelectAll} />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("ticketId")}
                  >
                    <div className="flex items-center gap-1">
                      Ticket ID
                      <SortIcon field="ticketId" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("ticketType")}
                  >
                    <div className="flex items-center gap-1">
                      Ticket type
                      <SortIcon field="ticketType" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center gap-1">
                      Amount
                      <SortIcon field="amount" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {showPayoutsBusy ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Loading payouts...
                    </td>
                  </tr>
                ) : showPayoutPreview ? (
                  <>
                    <tr>
                      <td colSpan={7} className="px-6 py-3 text-sm text-gray-600 border-b border-dashed border-gray-300 bg-muted/40">
                        {REPORTS_PAYOUTS_PREVIEW_DISCLAIMER}
                      </td>
                    </tr>
                    {PAYOUT_PREVIEW_ROWS.map((payout) => (
                      <tr key={payout.id} role="presentation" className="bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Checkbox disabled checked={false} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{payout.ticketId}</span>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.ticketType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" type="button" disabled>
                              Open
                            </Button>
                            <Button variant="outline" size="sm" type="button" disabled>
                              Download PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No payouts found
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Checkbox
                        checked={selectedRows.includes(payout.id)}
                        onCheckedChange={() => handleRowSelect(payout.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {payout.ticketId}
                        {payout.hasPendingIndicator && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.ticketType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payout.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          Open
                        </Button>
                        <Button variant="outline" size="sm">
                          Download PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Reports Tab Content */}
      {activeTab === "monthly" && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8">
          <p className="text-sm text-gray-600 mb-6 max-w-2xl">{REPORTS_MONTHLY_PREVIEW_DISCLAIMER}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MONTHLY_PREVIEW_STATS.map((row) => (
              <div key={row.label} className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Preview</p>
                <p className="text-sm text-gray-700 mb-2">{row.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  )
}
