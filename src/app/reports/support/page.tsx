"use client"

import { useState, useMemo, type SyntheticEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, ExternalLink, FileSpreadsheet, MoreVertical } from "lucide-react"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { getAvatarColorHexForId } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { usePaymentTransfers, usePayments, formatAmount, getHelperDisplayName, type PaymentTransfer } from "@/hooks/usePayments"
import { useProject } from "@/hooks/useProject"
import { useProjectSelection } from "@/contexts/project-context"
import { useRealtimePaymentTransfers } from "@/hooks/useRealtimePaymentTransfers"
import { groupTransfersByHelperMonth, payoutReference, transferDate } from "@/lib/helper-payout-reports"
import {
  aggregateProjectIncomeMonthly,
  groupProjectIncomeByTicket,
  PROJECT_INCOME_STATUS_LABELS,
  toProjectTicketIncomeRow,
  type ProjectIncomeStatus,
} from "@/lib/project-income-reports"
import {
  TransactionsPanel,
  TransactionsToggle,
  transactionsPanelId,
  useExpandedRows,
} from "@/components/reports/ticket-transactions"
import { buildProjectPayoutReport, reportToCsv, type ReportDocument } from "@/lib/report-export"
import { downloadCsv, downloadReportPdf } from "@/lib/report-pdf"

type Tab = "monthly" | "tickets" | "helpers"
type SortDirection = "asc" | "desc"
type MonthlySortField = "period" | "tickets" | "income" | "status"
type TicketsSortField = "ticket" | "date" | "income" | "status"
type HelpersSortField = "helper" | "date" | "amount"

// Tickets: checkbox · Ticket ID · Date · Project income · Status · kebab menu.
// Every column has a width that does not depend on the row's content.
// Status: fixed, sized for the widest status badge ("No project share").
// Last: the kebab trigger (2.75rem) plus 36px which, with the 16px grid gap, puts 52px between the Status column and the kebab menu.
const TICKETS_GRID = {
  gridTemplateColumns: "2rem minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.5fr) 9rem calc(2.75rem + 36px)",
}
// Helpers: checkbox · Helper · Date · Helper income · kebab menu.
// Same fixed widths as the other tabs, so a helper's tickets (each its own grid) line up under the row's columns.
const HELPERS_GRID = {
  gridTemplateColumns: "2rem minmax(0,2fr) minmax(0,1fr) minmax(0,1.5fr) calc(2.75rem + 36px)",
}
// Monthly reports: every column has a width that does not depend on the row's content.
// Status: fixed, sized for the status badge.
// Last: the kebab trigger (2.75rem) plus 36px which, with the 16px grid gap, puts 52px between the Status column and the kebab menu.
const MONTHLY_GRID = {
  gridTemplateColumns: "2rem minmax(0,2fr) minmax(0,1fr) minmax(0,1.5fr) 9rem calc(2.75rem + 36px)",
}
const KEBAB_BUTTON_CLASS = "text-muted-foreground hover:bg-muted"

// The column headers already say "Project income (USD)" / "Helper income (USD)",
// so USD amounts drop the prefix. Any other currency keeps it so it is never silently hidden.
const formatAmountValue = (cents: number) => (cents / 100).toFixed(2)
const formatPaymentAmount = (cents: number, currency: string = "usd") =>
  currency.toLowerCase() === "usd" ? formatAmountValue(cents) : formatAmount(cents, currency)

// Rows are clickable; controls inside a row stop the event so they do not trigger the row's action.
const stopRowNavigation = (event: SyntheticEvent) => event.stopPropagation()

const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"

// Same Badge classes as User reports: design-token colours from getStatusBadgeClass.
const statusBadgeClass = (label: string) =>
  `${getStatusBadgeClass(label)} flex items-center gap-1 w-fit text-[13px] px-3 py-1`

// "Received" and "Awaiting payment" are not known to getStatusBadgeClass,
// so they use the key Monthly reports uses for the same meaning.
const INCOME_BADGE_CLASS: Record<ProjectIncomeStatus, string> = {
  received: statusBadgeClass("paid out"),
  pending: statusBadgeClass("pending"),
  no_share: statusBadgeClass("no project share"),
  on_hold: statusBadgeClass("on hold"),
  awaiting_payment: statusBadgeClass("pending"),
  action_required: statusBadgeClass("action required"),
  failed: statusBadgeClass("failed"),
  cancelled: statusBadgeClass("cancelled"),
}

const TICKET_PREVIEW_LENGTH = 15
/** Start of the user's initial message: the first 15 characters followed by "..", or the whole text when it is no longer than that. */
const ticketPreview = (text: string) =>
  text.length > TICKET_PREVIEW_LENGTH ? `${text.slice(0, TICKET_PREVIEW_LENGTH)}..` : text

const RECEIPT_AVAILABLE_TITLE = "Open the Stripe receipt for this charge"
const RECEIPT_UNAVAILABLE_TITLE = "A receipt becomes available once the payment has been captured"

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
  /** Whole tickets to cover on top of `paymentIds`, for an export that spans several tickets. */
  ticketIds?: string[]
  /** Specific helper payouts; when set, only these (plus the project's own share of the same charges) are exported. */
  transfers?: PaymentTransfer[]
  title: string
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

/** "Receipt" entry of the row's kebab menu, for a ticket with a single charge. */
function ReceiptMenuItem({ url }: { url: string | null }) {
  if (url) {
    return (
      <DropdownMenuItem asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title={RECEIPT_AVAILABLE_TITLE}>
          <ExternalLink />
          Receipt
        </a>
      </DropdownMenuItem>
    )
  }
  // Disabled items ignore pointer events, so the explanation sits on a wrapper.
  return (
    <span title={RECEIPT_UNAVAILABLE_TITLE} className="block">
      <DropdownMenuItem disabled>
        <ExternalLink />
        Receipt
      </DropdownMenuItem>
    </span>
  )
}

export default function ReportsSupportPage() {
  const router = useRouter()
  const [activeTab, setActiveTabState] = useState<Tab>("monthly")
  // "all", "current", or a month label from `monthOptions` (Radix Select items cannot have an empty value)
  const [selectedPeriod, setSelectedPeriod] = useState("all")
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

  // Include the selected month even when it's older than the last 12 months,
  // so the Select can still display it (e.g. after clicking an old monthly report row).
  const monthOptions = useMemo(
    () =>
      selectedPeriod !== "all" && selectedPeriod !== "current" && !months.includes(selectedPeriod)
        ? [...months, selectedPeriod]
        : months,
    [months, selectedPeriod],
  )

  const targetMonth =
    selectedPeriod === "all"
      ? null
      : selectedPeriod === "current"
        ? getMonthYear(new Date().toISOString())
        : selectedPeriod

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
    if (targetMonth) list = list.filter((row) => row.period === targetMonth)
    const { field, direction } = monthlySort
    if (!field) return list // already newest first
    return [...list].sort((a, b) => {
      switch (field) {
        case "period":
          return compare(a.periodRaw, b.periodRaw, direction)
        case "tickets":
          return compare(a.ticketCount, b.ticketCount, direction)
        case "income":
          return compare(a.projectIncomeSmallestUnit, b.projectIncomeSmallestUnit, direction)
        case "status":
          return compare(a.allReceived ? "Received" : "Pending", b.allReceived ? "Received" : "Pending", direction)
        default:
          return 0
      }
    })
  }, [incomeRows, targetMonth, monthlySort])

  // Helpers: one row per helper and month, with every transfer of that month
  // underneath. A helper without transfers in a month has no row for it. The
  // project's own cut is also a payments_transfers row (transfer_user_type
  // "project", no helper) and is reported on the other tabs instead.
  const helperRows = useMemo(() => {
    if (!transfersData) return []
    let transfers = transfersData.filter((t) => t.transfer_user_type === "helper")
    if (targetMonth) transfers = transfers.filter((t) => getMonthYear(transferDate(t)) === targetMonth)
    const list = groupTransfersByHelperMonth(transfers).map((group) => {
      const first = group.transfers[0]
      const helperName = getHelperDisplayName(first.helper)
      const { initial, color } = getHelperInitialAndColor(helperName, first.helper?.user_id ?? first.helper_id)
      return {
        id: group.key,
        period: group.period,
        // The month's last day: only then is it known which tickets the helper worked on that month.
        date: formatDate(group.monthEnd),
        dateRaw: new Date(group.monthEnd).getTime(),
        helper: helperName,
        helperInitial: initial,
        helperColor: color,
        amountRaw: group.amountSmallestUnit,
        failedSmallestUnit: group.failedSmallestUnit,
        currency: group.currency,
        ticketCount: group.ticketCount,
        transfers: group.transfers,
      }
    })
    const { field, direction } = helpersSort
    return list.sort((a, b) => {
      switch (field) {
        case "date":
          return compare(a.dateRaw, b.dateRaw, direction)
        case "helper":
          return compare(a.helper.toLowerCase(), b.helper.toLowerCase(), direction)
        case "amount":
          return compare(a.amountRaw, b.amountRaw, direction)
        default:
          // Newest month first, helpers alphabetically within a month.
          return compare(a.dateRaw, b.dateRaw, "desc") || compare(a.helper.toLowerCase(), b.helper.toLowerCase(), "asc")
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
   * helper's payouts) exports every charge and transfer involved, so
   * the document reconciles with itself and shows the ticket as one record.
   */
  const buildExport = (period: string | null, single?: SingleExport): ReportDocument => {
    const paymentIds = single?.paymentIds ?? []
    const ticketIds = single?.ticketIds ?? []
    const sameCharge = (row: { payment_id?: string | null; ticket_id: string | null }) =>
      (!!row.ticket_id && ticketIds.includes(row.ticket_id)) ||
      (paymentIds.length > 0
        ? !!row.payment_id && paymentIds.includes(row.payment_id)
        : ticketIds.length === 0 && row.ticket_id === single?.ticketId)
    let transfers = transfersData ?? []
    let payments = paymentsData ?? []
    if (single) {
      const transferIds = new Set(single.transfers?.map((t) => t.id))
      transfers = transfers.filter((t) =>
        single.transfers ? transferIds.has(t.id) || (t.transfer_user_type === "project" && sameCharge(t)) : sameCharge(t),
      )
      payments = payments.filter((p) => sameCharge({ payment_id: p.id, ticket_id: p.ticket_id }))
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
  const exportPeriod = targetMonth

  /** One helper payout with its customer charge: the "Receipt" of a transaction on the Helpers tab. */
  const payoutExport = (transfer: PaymentTransfer): SingleExport => ({
    ticketId: transfer.ticket_id,
    // Legacy payouts without payment_id fall back to the whole ticket.
    paymentIds: transfer.payment_id ? [transfer.payment_id] : undefined,
    transfers: [transfer],
    title: `Payout ${payoutReference(transfer)}`,
  })
  /** All of a helper's payouts in one month, with their customer charges, as one document. */
  const helperMonthExport = (row: (typeof helperRows)[number]): SingleExport => ({
    ticketId: null,
    paymentIds: row.transfers.map((t) => t.payment_id).filter((id): id is string => !!id),
    // Legacy payouts without payment_id fall back to their whole ticket.
    ticketIds: row.transfers.filter((t) => !t.payment_id).map((t) => t.ticket_id).filter((id): id is string => !!id),
    transfers: row.transfers,
    title: `${row.helper} · ${row.period}`,
  })

  /** Open the Tickets tab filtered to the given month (row.period, e.g. "January 2026"). */
  const openMonthTickets = (period: string) => {
    setActiveTab("tickets")
    setSelectedPeriod(period)
  }

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
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px] h-9 text-muted-foreground">
                  <SelectValue placeholder="Choose period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="current">Current month</SelectItem>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all months" />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Period" field="period" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Tickets" field="tickets" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="min-w-0 whitespace-nowrap">
                      <SortHeader label="Project income (USD)" field="income" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Status" field="status" sortField={monthlySort.field} sortDirection={monthlySort.direction} onSort={(f) => cycleSort(f, monthlySort.field, monthlySort.direction, (field, direction) => setMonthlySort({ field, direction }))} />
                    </div>
                    <div />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading...</div>
                  ) : monthlyRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                      {targetMonth ? `No income found for ${targetMonth}` : "No income found"}
                    </div>
                  ) : (
                    monthlyRows.map((row) => (
                      <div
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View tickets for ${row.period}`}
                        className="px-6 py-4 hover:bg-[#f7f9ff] cursor-pointer focus-visible:outline-none focus-visible:bg-[#f7f9ff]"
                        onClick={() => openMonthTickets(row.period)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            openMonthTickets(row.period)
                          }
                        }}
                      >
                        <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                          <div onClick={stopRowNavigation}>
                            <Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={() => handleRowSelect(row.id)} aria-label={`Select ${row.period}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground">{row.period}</span>
                          </div>
                          <div className="min-w-0 text-sm text-foreground">{row.ticketCount}</div>
                          <div className="min-w-0 text-sm font-medium text-foreground whitespace-nowrap">
                            {formatPaymentAmount(row.projectIncomeSmallestUnit, row.currency)}
                          </div>
                          <div className="min-w-0">
                            <Badge className={`${getStatusBadgeClass(row.allReceived ? "paid out" : "pending")} hover:opacity-90 text-[13px] px-3 py-1`}>
                              {row.allReceived ? "Received" : "Pending"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={KEBAB_BUTTON_CLASS}
                                  aria-label={`More actions for ${row.period}`}
                                  onClick={stopRowNavigation}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Portalled, but React events still bubble to the row. */}
                              <DropdownMenuContent align="end" className="w-44" onClick={stopRowNavigation}>
                                <DropdownMenuItem
                                  title={`Download the ${row.period} project report as PDF`}
                                  onSelect={() => exportPdf(row.period)}
                                >
                                  <Download />
                                  PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  title={`Export the ${row.period} project report as CSV`}
                                  onSelect={() => exportCsv(row.period)}
                                >
                                  <FileSpreadsheet />
                                  CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                  <div className="grid gap-4 items-center" style={TICKETS_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all tickets" />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Ticket ID" field="ticket" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Date" field="date" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="min-w-0 whitespace-nowrap">
                      <SortHeader label="Project income (USD)" field="income" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Status" field="status" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                    </div>
                    <div />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading...</div>
                  ) : ticketRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("ticket payments")}</div>
                  ) : (
                    ticketRows.map((row) => {
                      const count = row.transactions.length
                      const expanded = count > 1 && isExpanded(row.id)
                      const panelId = transactionsPanelId(row.id)
                      const ticketHref = row.ticketId ? `/helper/tickets/${row.ticketId}` : null
                      return (
                      <div
                        key={row.id}
                        className={cn(
                          "px-6 py-4 hover:bg-[#f7f9ff]",
                          ticketHref &&
                            "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
                        )}
                        {...(ticketHref
                          ? {
                              role: "link",
                              tabIndex: 0,
                              "aria-label": `Open ticket ${getShortTicketId(row.ticketId)}`,
                              onClick: () => router.push(ticketHref),
                              // Only when the row itself has focus, not a control inside it.
                              onKeyDown: (event) => {
                                if (event.key === "Enter" && event.target === event.currentTarget) {
                                  router.push(ticketHref)
                                }
                              },
                            }
                          : {})}
                      >
                        <div className="grid gap-4 items-center" style={TICKETS_GRID}>
                          <div className="flex items-center">
                            <Checkbox
                              checked={selectedRows.includes(row.id)}
                              onCheckedChange={() => handleRowSelect(row.id)}
                              onClick={stopRowNavigation}
                              aria-label={`Select ticket ${row.ticketShortId}`}
                            />
                          </div>
                          <div className="min-w-0">
                            {ticketHref ? (
                              <Link
                                href={ticketHref}
                                onClick={stopRowNavigation}
                                className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                              >
                                {getShortTicketId(row.ticketId)}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground">—</span>
                            )}
                            <div className="text-xs text-muted-foreground" title={row.ticketTitle}>
                              {ticketPreview(row.ticketTitle)}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm text-muted-foreground">{formatDate(row.date)}</div>
                          <div className="min-w-0 text-sm font-medium text-foreground whitespace-nowrap">
                            {formatPaymentAmount(row.projectIncomeSmallestUnit, row.currency)}
                          </div>
                          <div className="min-w-0">
                            <Badge className={INCOME_BADGE_CLASS[row.status]}>{PROJECT_INCOME_STATUS_LABELS[row.status]}</Badge>
                          </div>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={KEBAB_BUTTON_CLASS}
                                  aria-label={`More actions for ticket ${row.ticketShortId}`}
                                  onClick={stopRowNavigation}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Portalled, but React events still bubble to the row. */}
                              <DropdownMenuContent align="end" className="w-44" onClick={stopRowNavigation}>
                                {count > 1 ? (
                                  <DropdownMenuItem title="Each charge has its own Stripe receipt" onSelect={() => toggle(row.id)}>
                                    <ExternalLink />
                                    Receipts
                                  </DropdownMenuItem>
                                ) : (
                                  <ReceiptMenuItem url={row.receiptUrl} />
                                )}
                                <DropdownMenuItem
                                  title="Download this ticket's charges, payouts and project income as a PDF"
                                  onSelect={() =>
                                    exportPdf(null, {
                                      ticketId: row.ticketId,
                                      paymentIds: row.ticketId ? undefined : row.transactions.map((t) => t.id),
                                      title: `Ticket ${row.ticketShortId}`,
                                    })
                                  }
                                >
                                  <Download />
                                  PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {count > 1 && (
                          <div className="w-fit" onClick={stopRowNavigation}>
                            <TransactionsToggle
                              className="ml-12 mt-2"
                              count={count}
                              expanded={expanded}
                              onToggle={() => toggle(row.id)}
                              panelId={panelId}
                              noun="charge"
                            />
                          </div>
                        )}
                        {expanded && (
                          <div className="cursor-default" onClick={stopRowNavigation}>
                          {/* The panel reaches 12px past the row's columns; border + line padding bring the lines back onto the same grid. */}
                          <TransactionsPanel id={panelId} className="-mx-3 overflow-x-visible">
                            {row.transactions.map((charge, index) => (
                              <div
                                key={charge.id}
                                role="listitem"
                                className="grid items-center gap-4 px-[11px] py-2 text-sm"
                                style={TICKETS_GRID}
                              >
                                <span />
                                <span className="min-w-0 text-xs text-muted-foreground tabular-nums">
                                  {index + 1} of {count}
                                </span>
                                <span className="min-w-0 text-muted-foreground tabular-nums">{formatDate(charge.date)}</span>
                                <span className="min-w-0 whitespace-nowrap text-foreground tabular-nums">
                                  {formatPaymentAmount(charge.projectIncomeSmallestUnit, charge.currency)}
                                </span>
                                <span className="min-w-0">
                                  <Badge className={INCOME_BADGE_CLASS[charge.status]}>{PROJECT_INCOME_STATUS_LABELS[charge.status]}</Badge>
                                </span>
                                {/* Wider than the kebab column: right-aligned, it extends left into the spacing before it. */}
                                <span className="flex items-center justify-end [&>*]:shrink-0">
                                  <ReceiptButton url={charge.receiptUrl} />
                                </span>
                              </div>
                            ))}
                          </TransactionsPanel>
                          </div>
                        )}
                      </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Helpers: each helper's income per month, with that month's tickets underneath */}
            {activeTab === "helpers" && (
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={HELPERS_GRID}>
                    <div>
                      <input type="checkbox" className="rounded border-border" checked={allSelected} onChange={handleSelectAll} aria-label="Select all helpers" />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Helper" field="helper" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="min-w-0">
                      <SortHeader label="Date" field="date" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div className="min-w-0 whitespace-nowrap">
                      <SortHeader label="Helper income (USD)" field="amount" sortField={helpersSort.field} sortDirection={helpersSort.direction} onSort={(f) => cycleSort(f, helpersSort.field, helpersSort.direction, (field, direction) => setHelpersSort({ field, direction }))} />
                    </div>
                    <div />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading...</div>
                  ) : helperRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("helper payouts")}</div>
                  ) : (
                    helperRows.map((row) => {
                      const expanded = isExpanded(row.id)
                      const panelId = transactionsPanelId(row.id)
                      return (
                      <div
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        aria-label={`Tickets for ${row.helper}, ${row.period}`}
                        className="px-6 py-4 hover:bg-[#f7f9ff] cursor-pointer focus-visible:outline-none focus-visible:bg-[#f7f9ff]"
                        onClick={() => toggle(row.id)}
                        onKeyDown={(e) => {
                          // Only when the row itself has focus, not a control inside it.
                          if (e.target !== e.currentTarget) return
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggle(row.id)
                          }
                        }}
                      >
                        <div className="grid gap-4 items-center" style={HELPERS_GRID}>
                          <div onClick={stopRowNavigation}>
                            <Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={() => handleRowSelect(row.id)} aria-label={`Select ${row.helper}, ${row.period}`} />
                          </div>
                          <div className="min-w-0 flex items-center gap-[18px]">
                            <div
                              className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                              style={{ backgroundColor: row.helperColor }}
                            >
                              {row.helperInitial}
                            </div>
                            <span className="min-w-0 truncate text-sm font-medium text-foreground" title={row.helper}>
                              {row.helper}
                            </span>
                          </div>
                          <div className="min-w-0 text-sm text-muted-foreground">{row.date}</div>
                          <div className="min-w-0 text-sm text-foreground">
                            <div className="whitespace-nowrap">{formatPaymentAmount(row.amountRaw, row.currency)}</div>
                            {row.failedSmallestUnit > 0 && (
                              <div className="text-xs text-red-700">{formatPaymentAmount(row.failedSmallestUnit, row.currency)} failed</div>
                            )}
                          </div>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={KEBAB_BUTTON_CLASS}
                                  aria-label={`More actions for ${row.helper}, ${row.period}`}
                                  onClick={stopRowNavigation}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Portalled, but React events still bubble to the row. */}
                              <DropdownMenuContent align="end" className="w-44" onClick={stopRowNavigation}>
                                <DropdownMenuItem
                                  title={`Download all of ${row.helper}'s transactions in ${row.period} as one PDF`}
                                  onSelect={() => exportPdf(null, helperMonthExport(row))}
                                >
                                  <Download />
                                  PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="w-fit" onClick={stopRowNavigation}>
                          <TransactionsToggle
                            className="ml-12 mt-2"
                            count={row.ticketCount}
                            minCount={1}
                            expanded={expanded}
                            onToggle={() => toggle(row.id)}
                            panelId={panelId}
                            noun="ticket"
                          />
                        </div>
                        {expanded && (
                          <div className="cursor-default" onClick={stopRowNavigation}>
                          {/* The panel reaches 12px past the row's columns; border + line padding bring the lines back onto the same grid. */}
                          <TransactionsPanel id={panelId} className="-mx-3 overflow-x-visible">
                            {row.transfers.map((transfer) => (
                              <div
                                key={transfer.id}
                                role="listitem"
                                className="grid items-center gap-4 px-[11px] py-2 text-sm"
                                style={HELPERS_GRID}
                              >
                                <span />
                                {/* Starts where the helper's avatar starts. */}
                                <span className="min-w-0">
                                  {transfer.ticket_id ? (
                                    <Link
                                      href={`/helper/tickets/${transfer.ticket_id}`}
                                      className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                                    >
                                      {getShortTicketId(transfer.ticket_id)}
                                    </Link>
                                  ) : (
                                    <span className="text-sm font-medium text-foreground">—</span>
                                  )}
                                </span>
                                <span className="min-w-0 text-muted-foreground tabular-nums">{formatDate(transferDate(transfer))}</span>
                                <span className="min-w-0 whitespace-nowrap text-foreground tabular-nums">
                                  {formatPaymentAmount(transfer.amount_smallest_unit, transfer.currency)}
                                  {/* Not paid, and not part of the row's income. */}
                                  {transfer.status === "failed" && <span className="ml-2 text-xs text-red-700">failed</span>}
                                </span>
                                {/* Wider than the kebab column: right-aligned, it extends left into the spacing before it. */}
                                <span className="flex items-center justify-end [&>*]:shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className={OUTLINE_BUTTON_CLASS}
                                    title="Download this transaction and its customer charge as a PDF"
                                    onClick={() => exportPdf(null, payoutExport(transfer))}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Receipt
                                  </Button>
                                </span>
                              </div>
                            ))}
                          </TransactionsPanel>
                          </div>
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
