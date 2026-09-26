"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, ExternalLink, FileSpreadsheet } from "lucide-react"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { getAvatarColorHexForId } from "@/lib/constants"
import { usePaymentTransfers, usePayments, formatAmount, getHelperDisplayName, type PaymentTransfer } from "@/hooks/usePayments"
import { useProject } from "@/hooks/useProject"
import { useProjectSelection } from "@/contexts/project-context"
import { useRealtimePaymentTransfers } from "@/hooks/useRealtimePaymentTransfers"
import { groupTransfersByTicket, payoutReference, transferDate } from "@/lib/helper-payout-reports"
import {
  aggregateProjectIncomeMonthly,
  groupProjectIncomeByTicket,
  PROJECT_INCOME_STATUS_LABELS,
  toProjectTicketIncomeRow,
  type ProjectIncomeStatus,
  type ProjectTicketIncomeRow,
} from "@/lib/project-income-reports"
import {
  TransactionLine,
  TransactionsPanel,
  TransactionsToggle,
  transactionsPanelId,
  useExpandedRows,
} from "@/components/reports/ticket-transactions"
import { buildProjectPayoutReport, reportToCsv, type ReportDocument } from "@/lib/report-export"
import { downloadCsv, downloadReportPdf } from "@/lib/report-pdf"

type Tab = "monthly" | "tickets" | "helpers"
type SortDirection = "asc" | "desc"
type MonthlySortField = "period" | "tickets" | "charged" | "payouts" | "income" | "status"
type TicketsSortField = "ticket" | "date" | "charged" | "payouts" | "income" | "status"
type HelpersSortField = "ticketId" | "date" | "helper" | "amount" | "status"

/** Ticket ID · Date · Charged · Payouts & fees · Income · Status · Actions (+ checkbox column). */
const INCOME_GRID = { gridTemplateColumns: "2rem repeat(12, 1fr)" }
/** The helper payouts table keeps its original 11-column layout. */
const HELPERS_GRID = { gridTemplateColumns: "2rem repeat(11, 1fr)" }
const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"

const INCOME_BADGE_CLASS: Record<ProjectIncomeStatus, string> = {
  received: "bg-green-100 text-green-800 hover:bg-green-100",
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  no_share: "bg-muted text-muted-foreground hover:bg-muted",
  on_hold: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  awaiting_payment: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  action_required: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  failed: "bg-red-100 text-red-800 hover:bg-red-100",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  return direction === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

function SortHeader<T extends string>({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string
  field: T
  sortField: T | null
  sortDirection: SortDirection
  onSort: (field: T) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <SortIcon active={sortField === field} direction={sortDirection} />
    </button>
  )
}

function compare(a: string | number, b: string | number, direction: SortDirection) {
  if (a < b) return direction === "asc" ? -1 : 1
  if (a > b) return direction === "asc" ? 1 : -1
  return 0
}

/** Three-state sort: asc → desc → off, matching the other Reports pages. */
function cycleSort<T extends string>(
  field: T,
  current: T | null,
  direction: SortDirection,
  set: (field: T | null, direction: SortDirection) => void,
) {
  if (current !== field) set(field, "asc")
  else if (direction === "asc") set(field, "desc")
  else set(null, "asc")
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

/** Which rows a single-record export should cover. */
interface SingleExport {
  ticketId: string | null
  /** Specific customer charges; when empty the whole ticket is exported. */
  paymentIds?: string[]
  /** Specific helper payouts; when set, only these (plus the project's own share of the same charges) are exported. */
  transfers?: PaymentTransfer[]
  title: string
}

const TRANSFER_STATUS_LABEL: Record<PaymentTransfer["status"], string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
}

function ReceiptButton({ url }: { url: string | null }) {
  if (url) {
    return (
      <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open the Stripe receipt for this charge">
          <ExternalLink className="w-3.5 h-3.5" />
          Receipt
        </a>
      </Button>
    )
  }
  return (
    <span title="A receipt becomes available once the payment has been captured" className="inline-flex">
      <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} disabled>
        <ExternalLink className="w-3.5 h-3.5" />
        Receipt
      </Button>
    </span>
  )
}

function TransferStatusBadge({ status }: { status: PaymentTransfer["status"] }) {
  const label = TRANSFER_STATUS_LABEL[status]
  if (status === "pending") {
    return (
      <Badge className={`${getStatusBadgeClass("pending")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" fill="currentColor" />
        </svg>
        {label}
      </Badge>
    )
  }
  if (status === "failed") {
    return <Badge className={`${getStatusBadgeClass("failed")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>{label}</Badge>
  }
  return (
    <Badge className={`${getStatusBadgeClass("completed")} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Badge>
  )
}

/** "USD 12.00 project · USD 30.00 helper · USD 3.00 fee" for one captured charge. */
function chargeSplitLabel(row: ProjectTicketIncomeRow): string {
  if (!row.captured) return "Not captured yet"
  return `${formatAmount(row.projectIncomeSmallestUnit, row.currency)} project · ${formatAmount(row.helperShareSmallestUnit, row.currency)} helper · ${formatAmount(row.platformFeeSmallestUnit, row.currency)} fee`
}

export default function ReportsSupportPage() {
  const [activeTab, setActiveTabState] = useState<Tab>("monthly")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [monthlySort, setMonthlySort] = useState<{ field: MonthlySortField | null; direction: SortDirection }>({ field: null, direction: "asc" })
  const [ticketsSort, setTicketsSort] = useState<{ field: TicketsSortField | null; direction: SortDirection }>({ field: null, direction: "asc" })
  const [helpersSort, setHelpersSort] = useState<{ field: HelpersSortField | null; direction: SortDirection }>({ field: null, direction: "asc" })

  const { isExpanded, toggle } = useExpandedRows()

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    setSelectedRows([])
  }

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined
  const { data: project } = useProject(projectId ?? "")

  // Customer charges for the project: the project's income per ticket.
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments(projectId)
  // Transfers: the project's own share (received or pending) and helper payouts.
  const { data: transfersData, isLoading: transfersLoading } = usePaymentTransfers({
    projectId,
    enabled: !!projectId,
  })
  // Refresh when a ticket closes and its payout rows land / settle.
  useRealtimePaymentTransfers(projectId)
  const isLoading = !!projectId && (paymentsLoading || transfersLoading)

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

  // "Current month" only exists on the per-row tabs; the monthly tab filters by the dropdown alone.
  const targetMonth =
    selectedMonth || (activeTab !== "monthly" && selectedFilter === "current" ? getMonthYear(new Date().toISOString()) : null)

  // Project income per ticket (every payment row, with the project's own transfer status).
  const incomeRows = useMemo(
    () => (paymentsData ?? []).map((payment) => toProjectTicketIncomeRow(payment, transfersData ?? [])),
    [paymentsData, transfersData],
  )

  const ticketRows = useMemo(() => {
    // One record per ticket; the month filter applies to the individual charges.
    const list = groupProjectIncomeByTicket(
      targetMonth ? incomeRows.filter((row) => getMonthYear(row.date) === targetMonth) : incomeRows,
    )
    const { field, direction } = ticketsSort
    if (!field) return list
    return list.sort((a, b) => {
      switch (field) {
        case "ticket":
          return compare(a.ticketShortId, b.ticketShortId, direction)
        case "date":
          return compare(new Date(a.date).getTime(), new Date(b.date).getTime(), direction)
        case "charged":
          return compare(a.chargedSmallestUnit, b.chargedSmallestUnit, direction)
        case "payouts":
          return compare(a.helperShareSmallestUnit + a.platformFeeSmallestUnit, b.helperShareSmallestUnit + b.platformFeeSmallestUnit, direction)
        case "income":
          return compare(a.projectIncomeSmallestUnit, b.projectIncomeSmallestUnit, direction)
        case "status":
          return compare(PROJECT_INCOME_STATUS_LABELS[a.status], PROJECT_INCOME_STATUS_LABELS[b.status], direction)
        default:
          return 0
      }
    })
  }, [incomeRows, targetMonth, ticketsSort])

  // Monthly: captured income only, so the figures are bookable.
  const monthlyRows = useMemo(() => {
    let list = aggregateProjectIncomeMonthly(incomeRows)
    if (selectedMonth) list = list.filter((row) => row.period === selectedMonth)
    const { field, direction } = monthlySort
    if (!field) return list // already newest first
    return [...list].sort((a, b) => {
      switch (field) {
        case "period":
          return compare(a.periodRaw, b.periodRaw, direction)
        case "tickets":
          return compare(a.ticketCount, b.ticketCount, direction)
        case "charged":
          return compare(a.chargedSmallestUnit, b.chargedSmallestUnit, direction)
        case "payouts":
          return compare(a.helperShareSmallestUnit + a.platformFeeSmallestUnit, b.helperShareSmallestUnit + b.platformFeeSmallestUnit, direction)
        case "income":
          return compare(a.projectIncomeSmallestUnit, b.projectIncomeSmallestUnit, direction)
        case "status":
          return compare(a.allReceived ? "Received" : "Pending", b.allReceived ? "Received" : "Pending", direction)
        default:
          return 0
      }
    })
  }, [incomeRows, selectedMonth, monthlySort])

  // Helpers: payouts per ticket and helper, with each transfer underneath
  // when a ticket was paid out more than once. The project's own cut is also
  // a payments_transfers row (transfer_user_type "project", no helper) and
  // is reported on the other tabs instead.
  const helperRows = useMemo(() => {
    if (!transfersData) return []
    let transfers = transfersData.filter((t) => t.transfer_user_type === "helper")
    if (targetMonth) transfers = transfers.filter((t) => getMonthYear(transferDate(t)) === targetMonth)
    const list = groupTransfersByTicket(transfers, { byHelper: true }).map((group) => {
      const first = group.items[0]
      const helperName = getHelperDisplayName(first.helper)
      const { initial, color } = getHelperInitialAndColor(helperName, first.helper?.user_id ?? first.helper_id)
      return {
        id: group.key,
        ticketId: group.ticketId,
        date: formatDate(group.date),
        dateRaw: group.date,
        helper: helperName,
        helperInitial: initial,
        helperColor: color,
        amount: formatAmount(group.amountSmallestUnit, group.currency),
        amountRaw: group.amountSmallestUnit,
        failedSmallestUnit: group.failedSmallestUnit,
        currency: group.currency,
        status: TRANSFER_STATUS_LABEL[group.status],
        statusType: group.status,
        transfers: group.items,
      }
    })
    const { field, direction } = helpersSort
    if (!field) return list
    return list.sort((a, b) => {
      switch (field) {
        case "ticketId":
          return compare((a.ticketId ?? "").toLowerCase(), (b.ticketId ?? "").toLowerCase(), direction)
        case "date":
          return compare(new Date(a.dateRaw).getTime(), new Date(b.dateRaw).getTime(), direction)
        case "helper":
          return compare(a.helper.toLowerCase(), b.helper.toLowerCase(), direction)
        case "amount":
          return compare(a.amountRaw, b.amountRaw, direction)
        case "status":
          return compare(a.status.toLowerCase(), b.status.toLowerCase(), direction)
        default:
          return 0
      }
    })
  }, [transfersData, targetMonth, helpersSort])

  const visibleIds =
    activeTab === "monthly" ? monthlyRows.map((r) => r.id) : activeTab === "tickets" ? ticketRows.map((r) => r.id) : helperRows.map((r) => r.id)
  const allSelected = visibleIds.length > 0 && selectedRows.length === visibleIds.length
  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }
  const handleSelectAll = () => {
    setSelectedRows((prev) => (prev.length === visibleIds.length ? [] : visibleIds))
  }

  const hasExportData = !!projectId && !isLoading && ((transfersData?.length ?? 0) > 0 || (paymentsData?.length ?? 0) > 0)

  /**
   * Accounting export for the project: customer charges with their split,
   * the project's own share and helper payouts. A single ticket (or a
   * helper's payouts on it) exports every charge and transfer involved, so
   * the document reconciles with itself and shows the ticket as one record.
   */
  const buildExport = (period: string | null, single?: SingleExport): ReportDocument => {
    const paymentIds = single?.paymentIds ?? []
    const sameCharge = (row: { payment_id?: string | null; ticket_id: string | null }) =>
      paymentIds.length > 0 ? !!row.payment_id && paymentIds.includes(row.payment_id) : row.ticket_id === single?.ticketId
    let transfers = transfersData ?? []
    let payments = paymentsData ?? []
    if (single) {
      const transferIds = new Set(single.transfers?.map((t) => t.id))
      transfers = transfers.filter((t) =>
        single.transfers ? transferIds.has(t.id) || (t.transfer_user_type === "project" && sameCharge(t)) : sameCharge(t),
      )
      payments = payments.filter((p) => (paymentIds.length > 0 ? paymentIds.includes(p.id) : p.ticket_id === single.ticketId))
    }
    return buildProjectPayoutReport({
      transfers,
      payments,
      period,
      periodTitle: single?.title,
      projectName: project?.name || "Project",
    })
  }
  const exportPdf = (period: string | null, single?: SingleExport) => {
    downloadReportPdf(buildExport(period, single)).catch((error) => console.error("PDF export failed", error))
  }
  const exportCsv = (period: string | null, single?: SingleExport) => {
    const report = buildExport(period, single)
    downloadCsv(report.fileName, reportToCsv(report))
  }
  const exportPeriod = activeTab === "monthly" ? selectedMonth || null : targetMonth

  const tabButton = (tab: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
        activeTab === tab ? "text-brand-primary border-brand-primary" : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )

  const emptyMessage = (what: string) => (targetMonth ? `No ${what} found for ${targetMonth}` : `No ${what} found`)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payouts" subtitle="Your project's income per ticket, and what has been paid out to helpers." />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex gap-1">
                {tabButton("monthly", "Monthly reports")}
                {tabButton("tickets", "Tickets")}
                {tabButton("helpers", "Helpers")}
              </div>
              <div className="h-px bg-border -mx-6" />
            </div>

            <div className="flex gap-2 mb-6">
              {activeTab !== "monthly" && (
                <Button
                  variant={selectedFilter === "current" ? "default" : "outline"}
                  size="sm"
                  className={
                    selectedFilter === "current"
                      ? "h-9 text-brand-primary border-brand-primary hover:bg-brand-primary/10 bg-brand-primary/10"
                      : `h-9 ${OUTLINE_BUTTON_CLASS}`
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
                variant={selectedFilter === "all" && !selectedMonth ? "default" : "outline"}
                size="sm"
                className={OUTLINE_BUTTON_CLASS}
                onClick={() => {
                  setSelectedFilter("all")
                  setSelectedMonth("")
                }}
              >
                All
              </Button>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className={`h-9 ${OUTLINE_BUTTON_CLASS}`}
                  disabled={!hasExportData}
                  title={`Export the ${exportPeriod ?? "all-time"} project report as CSV for accounting`}
                  onClick={() => exportCsv(exportPeriod)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export CSV
                </Button>
                <Button
                  variant="lavender"
                  size="sm"
                  type="button"
                  className="h-9"
                  disabled={!hasExportData}
                  title={`Download the ${exportPeriod ?? "all-time"} project report as PDF for accounting`}
                  onClick={() => exportPdf(exportPeriod)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </Button>
              </div>
            </div>

            {!projectId && (
              <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">Select a project to see its reports.</div>
            )}

            {/* Monthly: the project's income per month */}
            {activeTab === "monthly" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={INCOME_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all months" />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Period" field="period" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Tickets" field="tickets" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Charged" field="charged" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Payouts & fees" field="payouts" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Project income" field="income" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Status" field="status" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-sm font-medium text-foreground">Actions</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading...</div>
                  ) : monthlyRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                      {selectedMonth ? `No income found for ${selectedMonth}` : "No income found"}
                    </div>
                  ) : (
                    monthlyRows.map((row) => (
                      <div key={row.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={INCOME_GRID}>
                          <div>
                            <Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={() => handleRowSelect(row.id)} aria-label={`Select ${row.period}`} />
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm font-medium text-foreground">{row.period}</span>
                          </div>
                          <div className="col-span-1 text-sm text-foreground">{row.ticketCount}</div>
                          <div className="col-span-2 text-sm text-foreground">{formatAmount(row.chargedSmallestUnit, row.currency)}</div>
                          <div className="col-span-2 text-sm text-foreground">
                            <div>{formatAmount(row.helperShareSmallestUnit, row.currency)}</div>
                            <div className="text-xs text-muted-foreground">{formatAmount(row.platformFeeSmallestUnit, row.currency)} platform fees</div>
                          </div>
                          <div className="col-span-2 text-sm text-foreground">
                            <div className="font-medium">{formatAmount(row.projectIncomeSmallestUnit, row.currency)}</div>
                            {row.receivedSmallestUnit !== row.projectIncomeSmallestUnit && (
                              <div className="text-xs text-muted-foreground">{formatAmount(row.receivedSmallestUnit, row.currency)} received</div>
                            )}
                          </div>
                          <div className="col-span-1">
                            <Badge className={`${getStatusBadgeClass(row.allReceived ? "paid out" : "pending")} hover:opacity-90 text-[13px] px-3 py-1`}>
                              {row.allReceived ? "Received" : "Pending"}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className={OUTLINE_BUTTON_CLASS}
                              title={`Download the ${row.period} project report as PDF`}
                              onClick={() => exportPdf(row.period)}
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={OUTLINE_BUTTON_CLASS}
                              title={`Export the ${row.period} project report as CSV`}
                              onClick={() => exportCsv(row.period)}
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              CSV
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tickets: the project's income per ticket */}
            {activeTab === "tickets" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={INCOME_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all tickets" />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Ticket" field="ticket" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Date" field="date" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Charged" field="charged" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Payouts & fees" field="payouts" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Project income" field="income" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Status" field="status" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-sm font-medium text-foreground">Actions</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading...</div>
                  ) : ticketRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("ticket payments")}</div>
                  ) : (
                    ticketRows.map((row) => {
                      const count = row.transactions.length
                      const expanded = count > 1 && isExpanded(row.id)
                      const panelId = transactionsPanelId(row.id)
                      return (
                      <div key={row.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={INCOME_GRID}>
                          <div>
                            <Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={() => handleRowSelect(row.id)} aria-label={`Select ticket ${row.ticketShortId}`} />
                          </div>
                          <div className="col-span-2 min-w-0">
                            {row.ticketId ? (
                              <Link href={`/helper/tickets/${row.ticketId}`} className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums">
                                {getShortTicketId(row.ticketId)}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground">—</span>
                            )}
                            <div className="text-xs text-muted-foreground truncate" title={row.ticketTitle}>
                              {row.ticketTitle}
                            </div>
                            <TransactionsToggle count={count} expanded={expanded} onToggle={() => toggle(row.id)} panelId={panelId} noun="charge" />
                          </div>
                          <div className="col-span-1 text-sm text-muted-foreground">{formatDate(row.date)}</div>
                          <div className="col-span-2 text-sm text-foreground">
                            <div>{formatAmount(row.chargedSmallestUnit, row.currency)}</div>
                            {!row.captured && <div className="text-xs text-muted-foreground">not captured yet</div>}
                            {row.uncapturedSmallestUnit > 0 && (
                              <div className="text-xs text-muted-foreground">+ {formatAmount(row.uncapturedSmallestUnit, row.currency)} not captured yet</div>
                            )}
                          </div>
                          <div className="col-span-2 text-sm text-foreground">
                            <div>{formatAmount(row.helperShareSmallestUnit, row.currency)}</div>
                            <div className="text-xs text-muted-foreground">{formatAmount(row.platformFeeSmallestUnit, row.currency)} platform {count > 1 ? "fees" : "fee"}</div>
                          </div>
                          <div className="col-span-2 text-sm font-medium text-foreground">{formatAmount(row.projectIncomeSmallestUnit, row.currency)}</div>
                          <div className="col-span-1">
                            <Badge variant="secondary" className={`${INCOME_BADGE_CLASS[row.status]} text-xs`}>
                              {PROJECT_INCOME_STATUS_LABELS[row.status]}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end space-x-2">
                            {count > 1 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className={OUTLINE_BUTTON_CLASS}
                                aria-expanded={expanded}
                                aria-controls={panelId}
                                title="Each charge has its own Stripe receipt"
                                onClick={() => toggle(row.id)}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Receipts
                              </Button>
                            ) : (
                              <ReceiptButton url={row.receiptUrl} />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className={OUTLINE_BUTTON_CLASS}
                              title="Download this ticket's charges, payouts and project income as a PDF"
                              onClick={() =>
                                exportPdf(null, {
                                  ticketId: row.ticketId,
                                  paymentIds: row.ticketId ? undefined : row.transactions.map((t) => t.id),
                                  title: `Ticket ${row.ticketShortId}`,
                                })
                              }
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </div>
                        </div>
                        {expanded && (
                          <TransactionsPanel id={panelId}>
                            {row.transactions.map((charge, index) => (
                              <TransactionLine
                                key={charge.id}
                                index={index}
                                count={count}
                                date={formatDate(charge.date)}
                                description={<span title={charge.stripeTransferId ?? undefined}>{chargeSplitLabel(charge)}</span>}
                                amount={formatAmount(charge.chargedSmallestUnit, charge.currency)}
                                status={
                                  <Badge variant="secondary" className={`${INCOME_BADGE_CLASS[charge.status]} text-xs`}>
                                    {PROJECT_INCOME_STATUS_LABELS[charge.status]}
                                  </Badge>
                                }
                                actions={<ReceiptButton url={charge.receiptUrl} />}
                              />
                            ))}
                          </TransactionsPanel>
                        )}
                      </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Helpers: payouts to each helper per ticket */}
            {activeTab === "helpers" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={HELPERS_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all payouts" />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Ticket ID" field="ticketId" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Date" field="date" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="col-span-3">
                      <SortHeader label="Helper" field="helper" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Amount" field="amount" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Status" field="status" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-sm font-medium text-foreground">Actions</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading...</div>
                  ) : helperRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("helper payouts")}</div>
                  ) : (
                    helperRows.map((ticket) => {
                      const count = ticket.transfers.length
                      const expanded = count > 1 && isExpanded(ticket.id)
                      const panelId = transactionsPanelId(ticket.id)
                      const paymentIds = ticket.transfers.map((t) => t.payment_id).filter((id): id is string => !!id)
                      return (
                      <div key={ticket.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={HELPERS_GRID}>
                          <div>
                            <Checkbox checked={selectedRows.includes(ticket.id)} onCheckedChange={() => handleRowSelect(ticket.id)} aria-label={`Select payout ${ticket.id}`} />
                          </div>
                          <div className="col-span-1 min-w-0">
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
                            <div>
                              <TransactionsToggle count={count} expanded={expanded} onToggle={() => toggle(ticket.id)} panelId={panelId} noun="payout" />
                            </div>
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
                            {ticket.failedSmallestUnit > 0 && (
                              <div className="text-xs text-red-700">{formatAmount(ticket.failedSmallestUnit, ticket.currency)} failed</div>
                            )}
                          </div>
                          <div className="col-span-2">
                            <TransferStatusBadge status={ticket.statusType} />
                          </div>
                          <div className="col-span-2 flex items-center justify-end space-x-2">
                            {ticket.ticketId ? (
                              <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} asChild>
                                <Link href={`/helper/tickets/${ticket.ticketId}`}>Open</Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} disabled>
                                Open
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className={OUTLINE_BUTTON_CLASS}
                              title={
                                count > 1
                                  ? "Download these payouts and their customer charges as a PDF"
                                  : "Download this payout and its customer charge as a PDF"
                              }
                              onClick={() =>
                                exportPdf(null, {
                                  ticketId: ticket.ticketId,
                                  // Legacy payouts without payment_id fall back to the whole ticket.
                                  paymentIds: paymentIds.length === count ? paymentIds : undefined,
                                  transfers: ticket.transfers,
                                  title:
                                    count > 1
                                      ? `Ticket ${getShortTicketId(ticket.ticketId)} · ${ticket.helper}`
                                      : `Payout ${payoutReference(ticket.transfers[0])}`,
                                })
                              }
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </div>
                        </div>
                        {expanded && (
                          <TransactionsPanel id={panelId}>
                            {ticket.transfers.map((transfer, index) => (
                              <TransactionLine
                                key={transfer.id}
                                index={index}
                                count={count}
                                date={formatDate(transferDate(transfer))}
                                description={<span className="font-mono text-xs">{payoutReference(transfer)}</span>}
                                amount={formatAmount(transfer.amount_smallest_unit, transfer.currency)}
                                status={<TransferStatusBadge status={transfer.status} />}
                              />
                            ))}
                          </TransactionsPanel>
                        )}
                      </div>
                      )
                    })
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
