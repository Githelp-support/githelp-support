"use client"

import { useState, useMemo, type ReactNode } from "react"
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
import { usePaymentTransfers, type PaymentTransfer } from "@/hooks/usePayments"
import { useProject } from "@/hooks/useProject"
import { useUser } from "@/contexts/user-context"
import { useRealtimePaymentTransfers } from "@/hooks/useRealtimePaymentTransfers"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useTicketFirstMessages } from "@/hooks/useTicketFirstMessages"
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
  formatAmountNumber,
  formatMinutes,
  groupTransfersByTicket,
  monthLabel,
  payoutReference,
  transferDate,
  truncateFirstMessage,
} from "@/lib/helper-payout-reports"
import { getStatusBadgeClass } from "@/lib/status-colors"
import {
  TransactionLine,
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
  /** The ticket's first message ("" when it has none); shown truncated below the ticket id. */
  firstMessage: string
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

type SortField = "ticketId" | "date" | "amount" | "status"
type MonthlySortField = "period" | "description" | "earnings" | "status"
type SortDirection = "asc" | "desc"

const STATUS_LABEL: Record<PaymentTransfer["status"], string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
}

type MonthlyStatus = "Paid out" | "Pending"

const PAYOUT_STATUSES = Object.keys(STATUS_LABEL) as PaymentTransfer["status"][]
const MONTHLY_STATUSES: MonthlyStatus[] = ["Paid out", "Pending"]

/**
 * Payouts columns, shared by the header, real rows and preview rows (gap-4 between tracks):
 * checkbox | ticket id (first message below) | date | earnings | status | kebab.
 *
 * Widths are relative to the original "2rem repeat(11, 1fr)" layout, where one
 * track was (100% - 208px) / 11 (2rem checkbox + 11 gaps of 16px = 208px):
 * - Ticket ID and Date: old track + 32px each.
 * - Status: as wide as the widest status badge (see StatusCell), so the kebab
 *   is 52px from the status container.
 */
const PAYOUTS_GRID = {
  gridTemplateColumns: [
    "2rem",
    "calc((100% - 208px) / 11 + 32px)",
    "calc((100% - 208px) / 11 + 32px)",
    "minmax(0, 1fr)",
    "max-content",
    "5rem",
  ].join(" "),
}
/** checkbox | period (2) | description (3) | earnings (2) | status | kebab. */
const MONTHLY_GRID = { gridTemplateColumns: "2rem repeat(7, minmax(0, 1fr)) max-content 5rem" }
/**
 * Kebab cell, after the Status track: 16px grid gap + 22px margin + the
 * button's 14px padding put the kebab icon 52px from the status container.
 */
const KEBAB_CELL_CLASS = "ml-[22px] flex items-center"
const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"

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

function MonthlyStatusBadge({ status }: { status: MonthlyStatus }) {
  return (
    <Badge className={`${getStatusBadgeClass(status)} hover:opacity-90 text-[13px] px-3 py-1`}>{status}</Badge>
  )
}

/**
 * Status column cell. Rows are separate grids, so to give the "max-content"
 * Status track the same width in every row (and the header), each cell also
 * holds every possible badge, invisible and with no height: the track is as
 * wide as the widest badge.
 */
function StatusCell({ children, sizers }: { children: ReactNode; sizers: ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      {children}
      <div aria-hidden="true" className="invisible flex h-0 flex-col items-start overflow-hidden">
        {sizers}
      </div>
    </div>
  )
}

const PAYOUT_STATUS_SIZERS = PAYOUT_STATUSES.map((status) => <PayoutStatusBadge key={status} status={status} />)
const MONTHLY_STATUS_SIZERS = MONTHLY_STATUSES.map((status) => <MonthlyStatusBadge key={status} status={status} />)

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
  const [activeTab, setActiveTab] = useState<"monthly" | "payouts">("monthly")
  // "all", "current", or a month label from `months`
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [monthlySelectedRows, setMonthlySelectedRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const { isExpanded, toggle } = useExpandedRows()
  const router = useRouter()
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

  const ticketIds = useMemo(
    () => (transfersData ?? []).map((transfer) => transfer.ticket_id).filter((id): id is string => !!id),
    [transfersData],
  )
  const { data: firstMessages } = useTicketFirstMessages(ticketIds)

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

  const targetMonth =
    selectedPeriod === "all"
      ? null
      : selectedPeriod === "current"
        ? monthLabel(new Date().toISOString())
        : selectedPeriod

  // The month filter applies to individual transfers, then they are grouped per ticket.
  const payouts: PayoutData[] = useMemo(() => {
    let transfers = transfersData ?? []
    if (targetMonth) {
      transfers = transfers.filter((transfer) => monthLabel(transferDate(transfer)) === targetMonth)
    }
    const list: PayoutData[] = groupTransfersByTicket(transfers).map((group) => {
      const first = group.items[0]
      return {
        id: group.key,
        ticketId: group.ticketId,
        ticketShortId: group.ticketId?.slice(0, 7) || "-",
        ticketTitle: first.ticket?.title?.trim() || "",
        firstMessage: (group.ticketId && firstMessages?.[group.ticketId]) || "",
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
  }, [transfersData, firstMessages, targetMonth, sortField, sortDirection])

  const monthlyReports = useMemo(() => {
    let list = aggregateHelperMonthly(transfersData ?? [], timeEntries ?? []).map((row) => ({
      id: row.id,
      period: row.period,
      periodRaw: row.periodRaw,
      description: `${row.ticketsClosed} ticket${row.ticketsClosed === 1 ? "" : "s"} · Total time logged: ${formatMinutes(row.minutesLogged)}`,
      earnings: formatAmountNumber(row.earningsSmallestUnit),
      earningsRaw: row.earningsSmallestUnit,
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
          return compare(a.earningsRaw, b.earningsRaw, monthlySortDirection)
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
              <SelectTrigger
                className="w-[180px] h-9 text-muted-foreground"
                aria-label="Choose period"
              >
                <SelectValue placeholder="Choose period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="current">Current month</SelectItem>
                {months.map((month) => (
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
                  <div>
                    <SortHeader label="Ticket ID" field="ticketId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div>
                    <SortHeader label="Date" field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div>
                    <SortHeader label="Earnings (USD)" field="amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <StatusCell sizers={PAYOUT_STATUS_SIZERS}>
                    <SortHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </StatusCell>
                  <div></div>
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
                          <Checkbox disabled checked={false} />
                        </div>
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground font-mono tabular-nums">
                            {payout.ticketId}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            Preview
                          </Badge>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{payout.date}</span>
                        </div>
                        <div>
                          <span className="text-sm text-foreground">{payout.amount.replace(/^USD\s*/, "")}</span>
                        </div>
                        <StatusCell sizers={PAYOUT_STATUS_SIZERS}>
                          <PayoutStatusBadge status={payout.status} />
                        </StatusCell>
                        <div className={KEBAB_CELL_CLASS}>
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled
                              className="text-muted-foreground hover:bg-muted"
                              aria-label={`More actions for ticket ${payout.ticketId}`}
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
                    const count = payout.transfers.length
                    const expanded = count > 1 && isExpanded(payout.id)
                    const panelId = transactionsPanelId(payout.id)
                    const ticketHref = payout.ticketId ? `/helper/tickets/${payout.ticketId}` : null
                    const snippet = truncateFirstMessage(payout.firstMessage || payout.ticketTitle)
                    return (
                    <div
                      key={payout.id}
                      className={cn("px-6 py-4 hover:bg-[#f7f9ff]", ticketHref && "cursor-pointer")}
                      role={ticketHref ? "link" : undefined}
                      tabIndex={ticketHref ? 0 : undefined}
                      onClick={ticketHref ? () => router.push(ticketHref) : undefined}
                      onKeyDown={
                        ticketHref
                          ? (event) => {
                              // Only when the row itself has focus, not a control inside it.
                              if (event.key === "Enter" && event.target === event.currentTarget) {
                                router.push(ticketHref)
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
                        <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedRows.includes(payout.id)}
                            onCheckedChange={() => handleRowSelect(payout.id)}
                            aria-label={`Select payout for ticket ${payout.ticketShortId}`}
                          />
                        </div>
                        <div className="min-w-0">
                          {ticketHref ? (
                            <Link
                              href={ticketHref}
                              title={payout.ticketTitle || undefined}
                              className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {payout.ticketShortId}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-foreground">—</span>
                          )}
                          {snippet && (
                            <div
                              className="text-xs text-muted-foreground truncate"
                              title={payout.firstMessage || payout.ticketTitle}
                            >
                              {snippet}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{formatDate(payout.date)}</span>
                        </div>
                        <div>
                          <div className="text-sm text-foreground">{formatAmountNumber(payout.amountSmallestUnit)}</div>
                          {payout.failedSmallestUnit > 0 && (
                            <div className="text-xs text-red-700">{formatAmountNumber(payout.failedSmallestUnit)} failed</div>
                          )}
                        </div>
                        <StatusCell sizers={PAYOUT_STATUS_SIZERS}>
                          <PayoutStatusBadge status={payout.status} />
                        </StatusCell>
                        <div className={KEBAB_CELL_CLASS}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:bg-muted"
                                aria-label={`More actions for ticket ${payout.ticketShortId}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (count > 1) toggle(payout.id)
                                  else router.push(`/helper/reports/payouts/${payout.transfers[0].id}`)
                                }}
                              >
                                <FileText className="w-4 h-4" />
                                Statements
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => exportPdf(null, wholeTicket(payout))}>
                                <Download className="w-4 h-4" />
                                PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {count > 1 && (
                        // Below the grid row, aligned with the Ticket ID column (2rem checkbox + 1rem gap).
                        <div className="mt-2 ml-12 w-fit" onClick={(event) => event.stopPropagation()}>
                          <TransactionsToggle
                            count={count}
                            expanded={expanded}
                            onToggle={() => toggle(payout.id)}
                            panelId={panelId}
                            noun="payout"
                            className="mt-0"
                          />
                        </div>
                      )}
                      {expanded && (
                        <div className="cursor-default" onClick={(event) => event.stopPropagation()}>
                          <TransactionsPanel id={panelId} align="table">
                            {payout.transfers.map((transfer, index) => (
                              <TransactionLine
                                key={transfer.id}
                                align="table"
                                columns={PAYOUTS_GRID.gridTemplateColumns}
                                index={index}
                                count={count}
                                date={formatDate(transferDate(transfer))}
                                reference={
                                  <span className="font-mono" title={payoutReference(transfer)}>
                                    {payoutReference(transfer)}
                                  </span>
                                }
                                amount={formatAmountNumber(transfer.amount_smallest_unit)}
                                status={
                                  <StatusCell sizers={PAYOUT_STATUS_SIZERS}>
                                    <PayoutStatusBadge status={transfer.status} />
                                  </StatusCell>
                                }
                                actions={<StatementLink transfer={transfer} />}
                              />
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
                  <div className="col-span-2">
                    <SortHeader label="Period" field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-3">
                    <SortHeader label="Description" field="description" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Earnings (USD)" field="earnings" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <StatusCell sizers={MONTHLY_STATUS_SIZERS}>
                    <SortHeader label="Status" field="status" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </StatusCell>
                  <div></div>
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
                          <Checkbox disabled checked={false} />
                        </div>
                        <div className="col-span-2 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{row.period}</span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            Preview
                          </Badge>
                        </div>
                        <div className="col-span-3">
                          <span className="text-sm text-muted-foreground">{row.description}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{row.earnings.replace(/^USD\s*/, "")}</span>
                        </div>
                        <StatusCell sizers={MONTHLY_STATUS_SIZERS}>
                          <MonthlyStatusBadge status={row.status} />
                        </StatusCell>
                        <div className={KEBAB_CELL_CLASS}>
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled
                              className="text-muted-foreground hover:bg-muted"
                              aria-label={`More actions for ${row.period}`}
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
                    <div key={row.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                        <div className="flex items-center">
                          <Checkbox
                            checked={monthlySelectedRows.includes(row.id)}
                            onCheckedChange={() => handleMonthlyRowSelect(row.id)}
                            aria-label={`Select monthly report for ${row.period}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm font-medium text-foreground">{row.period}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-sm text-muted-foreground">{row.description}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-foreground">{row.earnings}</span>
                        </div>
                        <StatusCell sizers={MONTHLY_STATUS_SIZERS}>
                          <MonthlyStatusBadge status={row.status} />
                        </StatusCell>
                        <div className={KEBAB_CELL_CLASS}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:bg-muted"
                                aria-label={`More actions for ${row.period}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => exportPdf(row.period)}>
                                <Download className="w-4 h-4" />
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => exportCsv(row.period)}>
                                <FileSpreadsheet className="w-4 h-4" />
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
