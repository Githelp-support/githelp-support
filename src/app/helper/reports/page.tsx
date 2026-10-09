"use client"

import { useState, useMemo, type SyntheticEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, FileSpreadsheet, FileText, MoreVertical } from "lucide-react"
import { usePaymentTransfers, formatAmount, type PaymentTransfer } from "@/hooks/usePayments"
import { useProject } from "@/hooks/useProject"
import { useUser } from "@/contexts/user-context"
import { useRealtimePaymentTransfers } from "@/hooks/useRealtimePaymentTransfers"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useHelperTimeEntries } from "@/hooks/useHelperTimeEntries"
import { useProjectSelection } from "@/contexts/project-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  HELPER_MONTHLY_PREVIEW_ROWS,
  PAYOUT_PREVIEW_ROWS,
  REPORTS_PAYOUTS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"
import {
  aggregateHelperMonthly,
  formatMinutes,
  groupTransfersByTicket,
  monthLabel,
  payoutReference,
  transferDate,
  transferReportDate,
} from "@/lib/helper-payout-reports"
import { getStatusBadgeClass } from "@/lib/status-colors"
import {
  TransactionsPanel,
  TransactionsToggle,
  transactionsPanelId,
  useExpandedRows,
} from "@/components/reports/ticket-transactions"
import { buildHelperPayoutReport, reportToCsv, type ReportDocument } from "@/lib/report-export"
import { downloadCsv, downloadReportPdf } from "@/lib/report-pdf"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { cn } from "@/lib/utils"

/** One ticket's payouts to this helper; a ticket paid out more than once lists each transfer underneath. */
interface PayoutData {
  /** Group key (the ticket, or the payout itself when it has no ticket). */
  id: string
  ticketId: string | null
  ticketShortId: string
  ticketTitle: string
  /** ISO date of the latest transfer, used for display and sorting. */
  date: string
  amountSmallestUnit: number
  /** Transfers that failed (not paid) on top of `amountSmallestUnit`. */
  failedSmallestUnit: number
  currency: string
  status: PaymentTransfer["status"]
  /** The payout rows, oldest first, for statements and exports. */
  transfers: PaymentTransfer[]
}

// dd/mm/yyyy
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Payouts: the column header already says "Earnings (USD)", so USD amounts drop the prefix.
// Any other currency keeps it so it is never silently hidden.
const formatAmountValue = (cents: number) => (cents / 100).toFixed(2)
const formatPayoutAmount = (cents: number, currency: string = "usd") =>
  currency.toLowerCase() === "usd" ? formatAmountValue(cents) : formatAmount(cents, currency)

// Start of the ticket's initial text, shown under the ticket ID.
const TICKET_TEXT_MAX_LENGTH = 15
const ticketTextPreview = (text: string) =>
  text.length > TICKET_TEXT_MAX_LENGTH ? `${text.slice(0, TICKET_TEXT_MAX_LENGTH)}..` : text

type SortField = "ticketId" | "date" | "amount" | "status"
type MonthlySortField = "period" | "description" | "earnings" | "status"
type SortDirection = "asc" | "desc"

const STATUS_LABEL: Record<PaymentTransfer["status"], string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
}

// Each row (and each transaction line) is its own grid, so every column that must line up has a width that does not depend on the row's content.
// Status: fixed, sized for the widest status badge.
// Last: the kebab trigger (2.75rem) plus 36px which, with the 16px grid gap, puts 52px between the Status column and the kebab menu.
const PAYOUTS_GRID = {
  gridTemplateColumns: "2rem minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 9rem calc(2.75rem + 36px)",
}
// Extra 32px after the Ticket ID and Date columns (header, rows and transaction lines alike).
const COLUMN_SPACING_CLASS = "pr-8"
// Monthly reports: the fixed tracks add up to the same width as in the payouts grid, so the flexible columns keep their size.
// The kebab track is just the trigger; the 36px it used to carry sits in the Status track instead.
const MONTHLY_GRID = {
  gridTemplateColumns: "2rem minmax(0,1.5fr) minmax(0,2.5fr) minmax(0,1fr) calc(9rem + 36px) 2.75rem",
}
// Monthly reports column offsets (header and rows alike):
// Description sits 30px closer to Period (142px -> 112px between the texts).
const MONTHLY_DESCRIPTION_CLASS = "-ml-[30px]"
// Earnings sits a further 80px closer to Description (180px -> 100px between the texts).
const MONTHLY_EARNINGS_CLASS = "-ml-[110px]"
// Status sits 70px closer to the kebab menu (134px -> 64px between the badge and the menu).
const MONTHLY_STATUS_CLASS = "pl-[70px]"
const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"
const KEBAB_BUTTON_CLASS = "text-muted-foreground hover:bg-muted"

// Payout rows are clickable; controls inside a row stop the event so they do not navigate.
const stopRowNavigation = (event: SyntheticEvent) => event.stopPropagation()

/** Start of the ticket's initial text under the ticket ID; nothing when the ticket has no text. */
function TicketText({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="text-xs text-muted-foreground truncate" title={text}>
      {ticketTextPreview(text)}
    </div>
  )
}

function SortIcon({ field, sortField, sortDirection }: { field: string; sortField: string | null; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

function SortHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string
  field: string
  sortField: string | null
  sortDirection: SortDirection
  onSort: (field: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
    </button>
  )
}

/** Status badge for a single payout, as on the admin Support reports. */
function PayoutStatusBadge({ status }: { status: PaymentTransfer["status"] }) {
  return (
    <Badge className={`${getStatusBadgeClass(status)} flex items-center gap-1 w-fit text-[13px] px-3 py-1`}>
      {status === "pending" && (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" fill="currentColor" />
        </svg>
      )}
      {status === "completed" && (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function compare(a: string | number, b: string | number, direction: SortDirection) {
  if (a < b) return direction === "asc" ? -1 : 1
  if (a > b) return direction === "asc" ? 1 : -1
  return 0
}

function StatementLink({ transfer }: { transfer: PaymentTransfer }) {
  return (
    <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
      <Link
        href={`/helper/reports/payouts/${transfer.id}`}
        title="Payout statement: your proof of payment for this payout (printable, save as PDF)"
      >
        <FileText className="w-3.5 h-3.5" />
        Statement
      </Link>
    </Button>
  )
}

export default function HelperReportsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"monthly" | "payouts">("monthly")
  // "all", "current", or a month label (Radix Select items cannot have an empty value)
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [monthlySelectedRows, setMonthlySelectedRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const { isExpanded, toggle } = useExpandedRows()
  const { user } = useUser()
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined
  const { data: project } = useProject(projectId ?? "")
  const { data: helperId, isFetched: helperFetched } = useCurrentHelper(projectId)

  const transfersQueryEnabled = !!projectId && helperFetched && !!helperId

  useRealtimePaymentTransfers(projectId)
  // Fetch payment transfers only once we know the current user's helper row (avoids unscoped queries).
  const { data: transfersData, isLoading: transfersLoading, isFetched: transfersFetched } = usePaymentTransfers({
    helperId: helperId ?? undefined,
    projectId,
    enabled: transfersQueryEnabled,
  })
  const { data: timeEntries, isLoading: timeLoading } = useHelperTimeEntries(helperId, projectId)

  // Last 12 months for the month filter dropdown
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
        ? monthLabel(new Date().toISOString())
        : selectedPeriod

  // The month filter applies to individual transfers (by the month their ticket
  // closed, same as the monthly reports), then they are grouped per ticket.
  const payouts: PayoutData[] = useMemo(() => {
    let transfers = transfersData ?? []
    if (targetMonth) {
      transfers = transfers.filter((transfer) => monthLabel(transferReportDate(transfer)) === targetMonth)
    }
    const list: PayoutData[] = groupTransfersByTicket(transfers).map((group) => {
      const first = group.items[0]
      return {
        id: group.key,
        ticketId: group.ticketId,
        ticketShortId: group.ticketId?.slice(0, 7) || "-",
        ticketTitle: first.ticket?.title?.trim() || "",
        date: group.date,
        amountSmallestUnit: group.amountSmallestUnit,
        failedSmallestUnit: group.failedSmallestUnit,
        currency: group.currency,
        status: group.status,
        transfers: group.items,
      }
    })
    if (!sortField) return list
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sortField) {
        case "ticketId":
          return compare(a.ticketShortId, b.ticketShortId, sortDirection)
        case "date":
          return compare(new Date(a.date).getTime(), new Date(b.date).getTime(), sortDirection)
        case "amount":
          return compare(a.amountSmallestUnit, b.amountSmallestUnit, sortDirection)
        case "status":
          return compare(STATUS_LABEL[a.status], STATUS_LABEL[b.status], sortDirection)
        default:
          return 0
      }
    })
    return sorted
  }, [transfersData, targetMonth, sortField, sortDirection])

  const monthlyReports = useMemo(() => {
    let list = aggregateHelperMonthly(transfersData ?? [], timeEntries ?? []).map((row) => ({
      id: row.id,
      period: row.period,
      periodRaw: row.periodRaw,
      description: `${row.ticketsClosed} ticket${row.ticketsClosed === 1 ? "" : "s"} · Total time logged: ${formatMinutes(row.minutesLogged)}`,
      earningsSmallestUnit: row.earningsSmallestUnit,
      currency: row.currency,
      status:
        row.earningsSmallestUnit > 0 && row.paidOutSmallestUnit === row.earningsSmallestUnit
          ? ("Paid out" as const)
          : ("Pending" as const),
    }))
    if (targetMonth) {
      list = list.filter((row) => row.period === targetMonth)
    }
    if (!monthlySortField) return list // already newest first
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (monthlySortField) {
        case "period":
          return compare(a.periodRaw, b.periodRaw, monthlySortDirection)
        case "description":
          return compare(a.description.toLowerCase(), b.description.toLowerCase(), monthlySortDirection)
        case "earnings":
          return compare(a.earningsSmallestUnit, b.earningsSmallestUnit, monthlySortDirection)
        case "status":
          return compare(a.status.toLowerCase(), b.status.toLowerCase(), monthlySortDirection)
        default:
          return 0
      }
    })
    return sorted
  }, [transfersData, timeEntries, targetMonth, monthlySortField, monthlySortDirection])

  const handleSort = (field: string) => {
    const next = field as SortField
    if (sortField === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(next)
      setSortDirection("asc")
    }
  }

  const handleMonthlySort = (field: string) => {
    const next = field as MonthlySortField
    if (monthlySortField === next) {
      setMonthlySortDirection(monthlySortDirection === "asc" ? "desc" : "asc")
    } else {
      setMonthlySortField(next)
      setMonthlySortDirection("asc")
    }
  }

  /** Open the Payouts tab filtered to the given month (row.period, e.g. "January 2026"). */
  const openMonthPayouts = (period: string) => {
    setActiveTab("payouts")
    setSelectedPeriod(period)
  }

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    setSelectedRows(selectedRows.length === payouts.length ? [] : payouts.map((payout) => payout.id))
  }

  const handleMonthlyRowSelect = (id: string) => {
    setMonthlySelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleMonthlySelectAll = () => {
    setMonthlySelectedRows(
      monthlySelectedRows.length === monthlyReports.length ? [] : monthlyReports.map((row) => row.id),
    )
  }

  const isBusy =
    !!projectId && (!helperFetched || (transfersQueryEnabled && (transfersLoading || !transfersFetched || timeLoading)))

  const hasRealData = (transfersData?.length ?? 0) > 0 || (timeEntries?.length ?? 0) > 0

  /**
   * Preview (sample rows + disclaimer) only while the helper has no payouts
   * and no logged time at all in this project — also when they have no helper
   * row here yet. Once real rows exist, only real data is shown.
   */
  const showPreview = !!projectId && !isBusy && !hasRealData

  const emptyMessage = (what: string) =>
    targetMonth ? `No ${what} found for ${targetMonth}` : `No ${what} found`

  /**
   * Accounting export for this helper on the selected project: every payout
   * in `period` (or all time) plus a monthly summary with hours logged. One
   * ticket can be exported by passing its transfers (all of them together,
   * so a ticket paid out more than once is still one record).
   */
  const buildExport = (period: string | null, single?: PaymentTransfer[]): ReportDocument => {
    const ticketId = single?.[0]?.ticket_id
    return buildHelperPayoutReport({
      transfers: single ?? transfersData ?? [],
      timeEntries: single
        ? (timeEntries ?? []).filter((entry) => !!ticketId && entry.ticket_id === ticketId)
        : timeEntries ?? [],
      period,
      periodTitle: single
        ? single.length === 1
          ? `Payout ${payoutReference(single[0])}`
          : `Ticket ${ticketId?.slice(0, 7) ?? "-"}`
        : undefined,
      helper: { name: user.name, email: user.email ?? null },
      projectName: project?.name || "Project",
    })
  }
  /** Every payout on the payout's ticket, not only those in the filtered month. */
  const wholeTicket = (payout: PayoutData): PaymentTransfer[] =>
    payout.ticketId ? (transfersData ?? []).filter((t) => t.ticket_id === payout.ticketId) : payout.transfers
  const exportPdf = (period: string | null, single?: PaymentTransfer[]) => {
    downloadReportPdf(buildExport(period, single)).catch((error) => console.error("PDF export failed", error))
  }
  const exportCsv = (period: string | null, single?: PaymentTransfer[]) => {
    const report = buildExport(period, single)
    downloadCsv(report.fileName, reportToCsv(report))
  }
  const exportTitle = (kind: "PDF" | "CSV") =>
    `Download the ${targetMonth ?? "all-time"} payout report as ${kind} for your accounting`

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payouts" subtitle="Keep track of reports and transactions" />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Tab Navigation */}
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
                onClick={() => setActiveTab("payouts")}
                className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                  activeTab === "payouts"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Payouts
              </button>
            </div>
            <div className="h-px bg-border -mx-6" />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
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
                disabled={!hasRealData}
                title={exportTitle("CSV")}
                onClick={() => exportCsv(targetMonth)}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </Button>
              <Button
                variant="lavender"
                size="sm"
                type="button"
                className="h-9"
                disabled={!hasRealData}
                title={exportTitle("PDF")}
                onClick={() => exportPdf(targetMonth)}
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </Button>
            </div>
          </div>

          {!projectId && (
            <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
              Select a project to see your payouts and monthly reports.
            </div>
          )}

          {showPreview && (
            <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-foreground">
              {REPORTS_PAYOUTS_PREVIEW_DISCLAIMER}
            </div>
          )}

          {/* Payouts Table */}
          {activeTab === "payouts" && (
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={selectedRows.length === payouts.length && payouts.length > 0}
                      onChange={handleSelectAll}
                      disabled={payouts.length === 0}
                      aria-label="Select all payouts"
                    />
                  </div>
                  <div className={cn("min-w-0", COLUMN_SPACING_CLASS)}>
                    <SortHeader label="Ticket ID" field="ticketId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className={cn("min-w-0", COLUMN_SPACING_CLASS)}>
                    <SortHeader label="Date" field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="min-w-0 whitespace-nowrap">
                    <SortHeader label="Earnings (USD)" field="amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="min-w-0">
                    <SortHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div />
                </div>
              </div>

              <div className="divide-y divide-border">
                {isBusy ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payouts...</div>
                ) : showPreview ? (
                  PAYOUT_PREVIEW_ROWS.map((payout) => (
                    <div key={payout.id} role="presentation" className="px-6 py-4 opacity-80">
                      <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
                        <div className="flex items-center">
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Checkbox disabled checked={false} />
                          </span>
                        </div>
                        <div className={cn("min-w-0", COLUMN_SPACING_CLASS)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground font-mono tabular-nums">
                              {payout.ticketId}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                          <TicketText text={payout.ticketTitle} />
                        </div>
                        <div className={cn("min-w-0 text-sm text-muted-foreground", COLUMN_SPACING_CLASS)}>{payout.date}</div>
                        <div className="min-w-0 text-sm text-foreground whitespace-nowrap">
                          {payout.amount.replace(/^USD\s+/, "")}
                        </div>
                        <div className="min-w-0">
                          <PayoutStatusBadge status={payout.status} />
                        </div>
                        <div className="flex items-center justify-end">
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled
                              className={KEBAB_BUTTON_CLASS}
                              aria-label="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : payouts.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("payouts")}</div>
                ) : (
                  payouts.map((payout) => {
                    const href = payout.ticketId ? `/helper/tickets/${payout.ticketId}` : null
                    const count = payout.transfers.length
                    const expanded = count > 1 && isExpanded(payout.id)
                    const panelId = transactionsPanelId(payout.id)
                    return (
                      <div
                        key={payout.id}
                        className={cn(
                          "px-6 py-4 hover:bg-[#f7f9ff]",
                          href &&
                            "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
                        )}
                        {...(href
                          ? {
                              role: "link",
                              tabIndex: 0,
                              "aria-label": `Open ticket ${payout.ticketShortId}`,
                              onClick: () => router.push(href),
                              // Only when the row itself has focus, not a control inside it.
                              onKeyDown: (event) => {
                                if (event.key === "Enter" && event.target === event.currentTarget) {
                                  router.push(href)
                                }
                              },
                            }
                          : {})}
                      >
                        <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
                          <div className="flex items-center">
                            <Checkbox
                              checked={selectedRows.includes(payout.id)}
                              onCheckedChange={() => handleRowSelect(payout.id)}
                              onClick={stopRowNavigation}
                              aria-label={`Select payout for ticket ${payout.ticketShortId}`}
                            />
                          </div>
                          <div className={cn("min-w-0", COLUMN_SPACING_CLASS)}>
                            {href ? (
                              <Link
                                href={href}
                                onClick={stopRowNavigation}
                                className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                              >
                                {payout.ticketShortId}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground">—</span>
                            )}
                            <TicketText text={payout.ticketTitle} />
                          </div>
                          <div className={cn("min-w-0 text-sm text-muted-foreground", COLUMN_SPACING_CLASS)}>
                            {formatDate(payout.date)}
                          </div>
                          <div className="min-w-0 text-sm text-foreground">
                            <div className="whitespace-nowrap">
                              {formatPayoutAmount(payout.amountSmallestUnit, payout.currency)}
                            </div>
                            {payout.failedSmallestUnit > 0 && (
                              <div className="text-xs text-red-700">
                                {formatPayoutAmount(payout.failedSmallestUnit, payout.currency)} failed
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <PayoutStatusBadge status={payout.status} />
                          </div>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={KEBAB_BUTTON_CLASS}
                                  aria-label={`More actions for ticket ${payout.ticketShortId}`}
                                  onClick={stopRowNavigation}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Portalled, but React events still bubble to the row. */}
                              <DropdownMenuContent align="end" className="w-44" onClick={stopRowNavigation}>
                                {count > 1 ? (
                                  <DropdownMenuItem
                                    title="Each payout has its own statement"
                                    onSelect={() => toggle(payout.id)}
                                  >
                                    <FileText />
                                    Statements
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/helper/reports/payouts/${payout.transfers[0].id}`}
                                      title="Payout statement: your proof of payment for this payout (printable, save as PDF)"
                                    >
                                      <FileText />
                                      Statement
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  title="Download all your payouts on this ticket as a PDF for your accounting"
                                  onSelect={() => exportPdf(null, wholeTicket(payout))}
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
                              onToggle={() => toggle(payout.id)}
                              panelId={panelId}
                              noun="payout"
                            />
                          </div>
                        )}
                        {expanded && (
                          <div className="cursor-default" onClick={stopRowNavigation}>
                            {/* The panel reaches 12px past the row's columns; border + line padding bring the lines back onto the same grid. */}
                            <TransactionsPanel id={panelId} className="-mx-3 overflow-x-visible">
                              {payout.transfers.map((transfer, index) => {
                                const reference = payoutReference(transfer)
                                return (
                                  <div
                                    key={transfer.id}
                                    role="listitem"
                                    className="grid items-center gap-4 px-[11px] py-2 text-sm"
                                    style={PAYOUTS_GRID}
                                  >
                                    <span />
                                    {/* Index with the statement reference underneath, left-aligned with the ticket ID. */}
                                    <span className={cn("min-w-0", COLUMN_SPACING_CLASS)}>
                                      <span className="block text-xs text-muted-foreground tabular-nums">
                                        {index + 1} of {count}
                                      </span>
                                      <span className="block truncate font-mono text-xs text-foreground" title={reference}>
                                        {reference}
                                      </span>
                                    </span>
                                    <span className={cn("min-w-0 text-muted-foreground tabular-nums", COLUMN_SPACING_CLASS)}>
                                      {formatDate(transferDate(transfer))}
                                    </span>
                                    <span className="min-w-0 whitespace-nowrap text-foreground tabular-nums">
                                      {formatPayoutAmount(transfer.amount_smallest_unit, transfer.currency || payout.currency)}
                                    </span>
                                    <span className="min-w-0">
                                      <PayoutStatusBadge status={transfer.status} />
                                    </span>
                                    {/* Wider than the kebab column: right-aligned, it extends left into the spacing before it. */}
                                    <span className="flex items-center justify-end [&>*]:shrink-0">
                                      <StatementLink transfer={transfer} />
                                    </span>
                                  </div>
                                )
                              })}
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

          {/* Monthly Reports Tab Content */}
          {activeTab === "monthly" && (
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={monthlySelectedRows.length === monthlyReports.length && monthlyReports.length > 0}
                      onChange={handleMonthlySelectAll}
                      disabled={monthlyReports.length === 0}
                      aria-label="Select all monthly reports"
                    />
                  </div>
                  <div className="min-w-0">
                    <SortHeader label="Period" field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className={cn("min-w-0", MONTHLY_DESCRIPTION_CLASS)}>
                    <SortHeader label="Description" field="description" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className={cn("min-w-0 whitespace-nowrap", MONTHLY_EARNINGS_CLASS)}>
                    <SortHeader label="Earnings (USD)" field="earnings" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className={cn("min-w-0", MONTHLY_STATUS_CLASS)}>
                    <SortHeader label="Status" field="status" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div />
                </div>
              </div>
              <div className="divide-y divide-border">
                {isBusy ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading reports...</div>
                ) : showPreview ? (
                  HELPER_MONTHLY_PREVIEW_ROWS.map((row) => (
                    <div key={row.id} role="presentation" className="px-6 py-4 opacity-80">
                      <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                        <div className="flex items-center">
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Checkbox disabled checked={false} />
                          </span>
                        </div>
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{row.period}</span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            Preview
                          </Badge>
                        </div>
                        <div className={cn("min-w-0", MONTHLY_DESCRIPTION_CLASS)}>
                          <span className="text-sm text-muted-foreground">{row.description}</span>
                        </div>
                        <div className={cn("min-w-0 text-sm text-foreground whitespace-nowrap", MONTHLY_EARNINGS_CLASS)}>
                          {row.earnings.replace(/^USD\s+/, "")}
                        </div>
                        <div className={cn("min-w-0", MONTHLY_STATUS_CLASS)}>
                          <Badge className={`${getStatusBadgeClass(row.status)} hover:opacity-90 text-[13px] px-3 py-1`}>
                            {row.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-end">
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled
                              className={KEBAB_BUTTON_CLASS}
                              aria-label="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : monthlyReports.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("monthly reports")}</div>
                ) : (
                  monthlyReports.map((row) => (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View payouts for ${row.period}`}
                      className="px-6 py-4 hover:bg-[#f7f9ff] cursor-pointer focus-visible:outline-none focus-visible:bg-[#f7f9ff]"
                      onClick={() => openMonthPayouts(row.period)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          openMonthPayouts(row.period)
                        }
                      }}
                    >
                      <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={monthlySelectedRows.includes(row.id)}
                            onCheckedChange={() => handleMonthlyRowSelect(row.id)}
                            aria-label={`Select monthly report for ${row.period}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{row.period}</span>
                        </div>
                        <div className={cn("min-w-0", MONTHLY_DESCRIPTION_CLASS)}>
                          <span className="text-sm text-muted-foreground">{row.description}</span>
                        </div>
                        <div className={cn("min-w-0 text-sm text-foreground whitespace-nowrap", MONTHLY_EARNINGS_CLASS)}>
                          {formatPayoutAmount(row.earningsSmallestUnit, row.currency)}
                        </div>
                        <div className={cn("min-w-0", MONTHLY_STATUS_CLASS)}>
                          <Badge className={`${getStatusBadgeClass(row.status)} hover:opacity-90 text-[13px] px-3 py-1`}>
                            {row.status}
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
                                title={`Download the ${row.period} payout report as PDF`}
                                onSelect={() => exportPdf(row.period)}
                              >
                                <Download />
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                title={`Export the ${row.period} payout report as CSV`}
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
        </main>
      </div>
    </div>
  )
}
