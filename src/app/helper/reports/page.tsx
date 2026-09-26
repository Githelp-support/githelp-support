"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, FileSpreadsheet, FileText } from "lucide-react"
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
  transferTicketType,
  type HelperMonthlyReportRow,
} from "@/lib/helper-payout-reports"
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

/** One ticket's payouts to this helper; a ticket paid out more than once lists each transfer underneath. */
interface PayoutData {
  /** Group key (the ticket, or the payout itself when it has no ticket). */
  id: string
  ticketId: string | null
  ticketShortId: string
  ticketTitle: string
  /** ISO date of the latest transfer, used for display and sorting. */
  date: string
  ticketType: string
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

type SortField = "ticketId" | "date" | "ticketType" | "amount" | "status"
type MonthlySortField = "month" | "ticketsClosed" | "hoursLogged" | "earnings"
type SortDirection = "asc" | "desc"

const STATUS_LABEL: Record<PaymentTransfer["status"], string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
}

const STATUS_BADGE_CLASS: Record<PaymentTransfer["status"], string> = {
  completed: "bg-green-100 text-green-800 hover:bg-green-100",
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  failed: "bg-red-100 text-red-800 hover:bg-red-100",
}

const PAYOUTS_GRID = { gridTemplateColumns: "2rem repeat(11, 1fr)" }
const MONTHLY_GRID = { gridTemplateColumns: "repeat(12, 1fr)" }
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
  const [activeTab, setActiveTab] = useState<"monthly" | "payouts">("payouts")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
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

  const targetMonth =
    selectedFilter === "current" || selectedMonth
      ? selectedMonth || monthLabel(new Date().toISOString())
      : null

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
        date: group.date,
        ticketType: transferTicketType(first),
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
        case "ticketType":
          return compare(a.ticketType.toLowerCase(), b.ticketType.toLowerCase(), sortDirection)
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

  const monthlyReports: HelperMonthlyReportRow[] = useMemo(() => {
    let list = aggregateHelperMonthly(transfersData ?? [], timeEntries ?? [])
    if (targetMonth) {
      list = list.filter((row) => row.period === targetMonth)
    }
    if (!monthlySortField) return list // already newest first
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (monthlySortField) {
        case "month":
          return compare(a.periodRaw, b.periodRaw, monthlySortDirection)
        case "ticketsClosed":
          return compare(a.ticketsClosed, b.ticketsClosed, monthlySortDirection)
        case "hoursLogged":
          return compare(a.minutesLogged, b.minutesLogged, monthlySortDirection)
        case "earnings":
          return compare(a.earningsSmallestUnit, b.earningsSmallestUnit, monthlySortDirection)
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
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                type="button"
                onClick={() => setActiveTab("monthly")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "monthly"
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Monthly reports
              </button>
              <button
                type="button"
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
            <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid gap-4 items-center text-sm font-medium text-foreground" style={PAYOUTS_GRID}>
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
                  <div className="col-span-2">
                    <SortHeader label="Ticket ID" field="ticketId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="col-span-1">
                    <SortHeader label="Date" field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Ticket type" field="ticketType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="col-span-1">
                    <SortHeader label="Amount" field="amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-medium text-foreground">Actions</span>
                  </div>
                </div>
              </div>

              {isBusy ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payouts...</div>
              ) : showPreview ? (
                PAYOUT_PREVIEW_ROWS.map((payout) => (
                  <div key={payout.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 opacity-80">
                    <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
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
                        <Badge variant="secondary" className={STATUS_BADGE_CLASS[payout.status]}>
                          {STATUS_LABEL[payout.status]}
                        </Badge>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                              Open
                            </Button>
                          </span>
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                              <FileText className="w-3.5 h-3.5" />
                              Statement
                            </Button>
                          </span>
                          <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                            <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </span>
                        </div>
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
                  return (
                  <div key={payout.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                    <div className="grid gap-4 items-center" style={PAYOUTS_GRID}>
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectedRows.includes(payout.id)}
                          onCheckedChange={() => handleRowSelect(payout.id)}
                          aria-label={`Select payout for ticket ${payout.ticketShortId}`}
                        />
                      </div>
                      <div className="col-span-2 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-sm text-gray-900">{payout.ticketShortId}</span>
                          {payout.status === "pending" && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                        </div>
                        {payout.ticketTitle && (
                          <div className="text-xs text-muted-foreground truncate" title={payout.ticketTitle}>
                            {payout.ticketTitle}
                          </div>
                        )}
                        <TransactionsToggle count={count} expanded={expanded} onToggle={() => toggle(payout.id)} panelId={panelId} noun="payout" />
                      </div>
                      <div className="col-span-1 text-sm text-muted-foreground">{formatDate(payout.date)}</div>
                      <div className="col-span-2">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                          {payout.ticketType}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-sm text-gray-900">
                        <div>{formatAmount(payout.amountSmallestUnit, payout.currency)}</div>
                        {payout.failedSmallestUnit > 0 && (
                          <div className="text-xs text-red-700">{formatAmount(payout.failedSmallestUnit, payout.currency)} failed</div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="secondary" className={STATUS_BADGE_CLASS[payout.status]}>
                          {STATUS_LABEL[payout.status]}
                        </Badge>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {payout.ticketId ? (
                            <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
                              <Link href={`/helper/tickets/${payout.ticketId}`}>Open</Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                              Open
                            </Button>
                          )}
                          {count > 1 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className={OUTLINE_BUTTON_CLASS}
                              aria-expanded={expanded}
                              aria-controls={panelId}
                              title="Each payout has its own statement"
                              onClick={() => toggle(payout.id)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Statements
                            </Button>
                          ) : (
                            <StatementLink transfer={payout.transfers[0]} />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className={OUTLINE_BUTTON_CLASS}
                            title={
                              count > 1
                                ? "Download this ticket's payouts as a PDF for your accounting"
                                : "Download this payout as a PDF for your accounting"
                            }
                            onClick={() => exportPdf(null, payout.transfers)}
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <TransactionsPanel id={panelId}>
                        {payout.transfers.map((transfer, index) => (
                          <TransactionLine
                            key={transfer.id}
                            index={index}
                            count={count}
                            date={formatDate(transferDate(transfer))}
                            description={<span className="font-mono text-xs">{payoutReference(transfer)}</span>}
                            amount={formatAmount(transfer.amount_smallest_unit, transfer.currency || payout.currency)}
                            status={
                              <Badge variant="secondary" className={STATUS_BADGE_CLASS[transfer.status]}>
                                {STATUS_LABEL[transfer.status]}
                              </Badge>
                            }
                            actions={<StatementLink transfer={transfer} />}
                          />
                        ))}
                      </TransactionsPanel>
                    )}
                  </div>
                  )
                })
              )}
            </div>
          )}

          {/* Monthly Reports Tab Content */}
          {activeTab === "monthly" && (
            <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid gap-4 text-sm font-medium text-foreground" style={MONTHLY_GRID}>
                  <div className="col-span-3">
                    <SortHeader label="Month" field="month" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Tickets closed" field="ticketsClosed" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Hours logged" field="hoursLogged" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-2">
                    <SortHeader label="Earnings" field="earnings" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-medium text-foreground">Actions</span>
                  </div>
                </div>
              </div>
              {isBusy ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading reports...</div>
              ) : showPreview ? (
                HELPER_MONTHLY_PREVIEW_ROWS.map((row) => (
                  <div key={row.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 opacity-80">
                    <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                      <div className="col-span-3 flex items-center gap-2 text-sm text-gray-900">
                        {row.period}
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Preview
                        </Badge>
                      </div>
                      <div className="col-span-2 text-sm text-gray-900">{row.ticketsClosed}</div>
                      <div className="col-span-2 text-sm text-gray-900">{row.hoursLogged}</div>
                      <div className="col-span-2 text-sm text-gray-900">{row.earnings}</div>
                      <div className="col-span-3 flex items-center gap-2 flex-wrap">
                        <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                          <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                            <Download className="w-3.5 h-3.5" />
                            Download PDF
                          </Button>
                        </span>
                        <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                          <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            CSV
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
                  <div key={row.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                    <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                      <div className="col-span-3 text-sm text-gray-900">{row.period}</div>
                      <div className="col-span-2 text-sm text-gray-900">{row.ticketsClosed}</div>
                      <div className="col-span-2 text-sm text-gray-900">{formatMinutes(row.minutesLogged)}</div>
                      <div className="col-span-2 text-sm text-gray-900">
                        <div>{formatAmount(row.earningsSmallestUnit, row.currency)}</div>
                        {row.paidOutSmallestUnit !== row.earningsSmallestUnit && (
                          <div className="text-xs text-muted-foreground">
                            {formatAmount(row.paidOutSmallestUnit, row.currency)} paid out
                          </div>
                        )}
                      </div>
                      <div className="col-span-3 flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className={OUTLINE_BUTTON_CLASS}
                          title={`Download the ${row.period} payout report as PDF`}
                          onClick={() => exportPdf(row.period)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className={OUTLINE_BUTTON_CLASS}
                          title={`Export the ${row.period} payout report as CSV`}
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
          )}
        </main>
      </div>
    </div>
  )
}
