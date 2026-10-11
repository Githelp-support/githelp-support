"use client"

import { useState, useMemo, type SyntheticEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, ExternalLink, MoreVertical } from "lucide-react"
import { useUserPayments, formatAmount } from "@/hooks/usePayments"
import { useUser } from "@/contexts/user-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  USER_MONTHLY_PREVIEW_ROWS,
  USER_PAYMENT_PREVIEW_ROWS,
  USER_REPORTS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"
import {
  aggregateMonthly,
  groupUserPaymentsByTicket,
  monthLabel,
  toUserPaymentRow,
  USER_PAYMENT_STATUS_LABELS,
  USER_TRANSACTION_DESCRIPTIONS,
  type UserMonthlyReportRow,
  type UserPaymentRow,
  type UserTicketPaymentGroup,
} from "@/lib/user-payment-reports"
import { buildUserMonthlyReport, buildUserTicketReport } from "@/lib/report-export"
import { downloadReportPdf } from "@/lib/report-pdf"
import {
  TransactionsPanel,
  TransactionsToggle,
  transactionsPanelId,
  useExpandedRows,
} from "@/components/reports/ticket-transactions"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { cn } from "@/lib/utils"

// dd/mm/yyyy, matching the helper reports page
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Payments and Monthly reports: the column header already says "Amount (USD)",
// so USD amounts drop the prefix. Any other currency keeps it so it is never silently hidden.
const formatAmountValue = (cents: number) => (cents / 100).toFixed(2)
const formatPaymentAmount = (cents: number, currency: string = "usd") =>
  currency.toLowerCase() === "usd" ? formatAmountValue(cents) : formatAmount(cents, currency)

type SortField = "ticket" | "project" | "date" | "amount" | "status"
type MonthlySortField = "period" | "tickets" | "amount"
type SortDirection = "asc" | "desc"

// Same Badge classes as the Admin reports page (src/app/reports/support/page.tsx):
// default variant + design-token colours from getStatusBadgeClass.
const statusBadgeClass = (label: string) =>
  `${getStatusBadgeClass(label)} flex items-center gap-1 w-fit text-[13px] px-3 py-1`

// Each row (and each transaction line) is its own grid, so every column that must line up has a width that does not depend on the row's content.
// Status: fixed, sized for the widest status badge ("Action required").
// Last: the kebab trigger (2.75rem) plus 36px which, with the 16px grid gap, puts 52px between the Status column and the kebab menu.
const PAYMENTS_GRID = {
  gridTemplateColumns: "2rem minmax(0,1.5fr) minmax(0,1fr) minmax(0,2fr) minmax(0,1fr) 9rem calc(2.75rem + 36px)",
}
// Right padding of the Project column: with the 16px grid gap, text ends at least 60px before the amount.
const BEFORE_AMOUNT_CLASS = "pr-11"
const MONTHLY_GRID = { gridTemplateColumns: "2rem repeat(11, 1fr)" }

const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"
const KEBAB_BUTTON_CLASS = "text-muted-foreground hover:bg-muted"

// Payments rows are clickable; controls inside a row stop the event so they do not navigate.
const stopRowNavigation = (event: SyntheticEvent) => event.stopPropagation()

const RECEIPT_AVAILABLE_TITLE = "Open the Stripe receipt for this payment (view, download or print)"
const receiptUnavailableTitle = (row: UserPaymentRow) =>
  row.displayStatus === "paid"
    ? "The receipt is still being prepared by Stripe. Check back shortly."
    : "A receipt becomes available once the payment has been captured."

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

function ReceiptButton({ row }: { row: UserPaymentRow }) {
  if (row.receiptUrl) {
    return (
      <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
        <a
          href={row.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={RECEIPT_AVAILABLE_TITLE}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Receipt
        </a>
      </Button>
    )
  }
  return (
    <span title={receiptUnavailableTitle(row)} className="inline-flex">
      <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
        <ExternalLink className="w-3.5 h-3.5" />
        Receipt
      </Button>
    </span>
  )
}

/** "Receipt" entry of the row's kebab menu, for a ticket with a single transaction. */
function ReceiptMenuItem({ row }: { row: UserPaymentRow }) {
  if (row.receiptUrl) {
    return (
      <DropdownMenuItem asChild>
        <a href={row.receiptUrl} target="_blank" rel="noopener noreferrer" title={RECEIPT_AVAILABLE_TITLE}>
          <ExternalLink />
          Receipt
        </a>
      </DropdownMenuItem>
    )
  }
  // Disabled items ignore pointer events, so the explanation sits on a wrapper.
  return (
    <span title={receiptUnavailableTitle(row)} className="block">
      <DropdownMenuItem disabled>
        <ExternalLink />
        Receipt
      </DropdownMenuItem>
    </span>
  )
}

function ticketHref(row: UserPaymentRow): string | null {
  if (!row.ticketId) return null
  const params = new URLSearchParams({ ticket: row.ticketId })
  if (row.projectId) params.set("project", row.projectId)
  return `/support/chat?${params.toString()}`
}

export default function UserReportsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"monthly" | "payments">("payments")
  // "all", "current", or a month label from `months` (Radix Select items cannot have an empty value)
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectedMonthlyRows, setSelectedMonthlyRows] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const { isExpanded, toggle } = useExpandedRows()

  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id
  const isAuthenticated = !!userId

  // The customer's own charges/holds, across every project they have opened
  // tickets in (this view is not scoped to the selected project — a customer
  // is usually not a member of the projects they get support from).
  const {
    data: paymentRecords,
    isLoading: paymentsLoading,
    isFetched: paymentsFetched,
    error: paymentsError,
  } = useUserPayments(userId)

  const allPayments: UserPaymentRow[] = useMemo(
    () => (paymentRecords ?? []).map(toUserPaymentRow),
    [paymentRecords],
  )

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

  // One record per ticket; a ticket charged more than once lists its
  // transactions underneath. The month filter applies to transactions, so a
  // ticket charged in two months shows each month's part in that month.
  const payments: UserTicketPaymentGroup[] = useMemo(() => {
    let list = allPayments
    if (targetMonth) {
      list = list.filter((row) => monthLabel(row.date) === targetMonth)
    }
    const groups = groupUserPaymentsByTicket(list)
    if (!sortField) return groups
    const sorted = [...groups]
    sorted.sort((a, b) => {
      switch (sortField) {
        case "ticket":
          return compare(a.ticketTitle.toLowerCase(), b.ticketTitle.toLowerCase(), sortDirection)
        case "project":
          return compare(a.projectName.toLowerCase(), b.projectName.toLowerCase(), sortDirection)
        case "date":
          return compare(new Date(a.date).getTime(), new Date(b.date).getTime(), sortDirection)
        case "amount":
          return compare(a.amountSmallestUnit, b.amountSmallestUnit, sortDirection)
        case "status":
          return compare(
            USER_PAYMENT_STATUS_LABELS[a.displayStatus],
            USER_PAYMENT_STATUS_LABELS[b.displayStatus],
            sortDirection,
          )
        default:
          return 0
      }
    })
    return sorted
  }, [allPayments, targetMonth, sortField, sortDirection])

  const monthlyReports: UserMonthlyReportRow[] = useMemo(() => {
    let list = aggregateMonthly(allPayments)
    if (targetMonth) {
      list = list.filter((row) => row.period === targetMonth)
    }
    if (!monthlySortField) return list // already newest first
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (monthlySortField) {
        case "period":
          return compare(a.periodRaw, b.periodRaw, monthlySortDirection)
        case "tickets":
          return compare(a.ticketCount, b.ticketCount, monthlySortDirection)
        case "amount":
          return compare(a.amountSmallestUnit, b.amountSmallestUnit, monthlySortDirection)
        default:
          return 0
      }
    })
    return sorted
  }, [allPayments, targetMonth, monthlySortField, monthlySortDirection])

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
    setSelectedRows(selectedRows.length === payments.length ? [] : payments.map((payment) => payment.id))
  }

  const handleMonthlyRowSelect = (id: string) => {
    setSelectedMonthlyRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const handleMonthlySelectAll = () => {
    setSelectedMonthlyRows(
      selectedMonthlyRows.length === monthlyReports.length ? [] : monthlyReports.map((row) => row.id),
    )
  }

  // The PDF covers the whole ticket, even when the list is filtered to a
  // month and shows only that month's transactions.
  const downloadTicketPdf = (row: UserTicketPaymentGroup) => {
    const ticket =
      (row.ticketId
        ? groupUserPaymentsByTicket(allPayments.filter((p) => p.ticketId === row.ticketId))[0]
        : undefined) ?? row
    const report = buildUserTicketReport({
      ticket,
      customer: { name: user?.name || "Customer", email: user?.email ?? null },
    })
    downloadReportPdf(report).catch((error) => console.error("PDF export failed", error))
  }

  const downloadMonthlyPdf = (period: string) => {
    const report = buildUserMonthlyReport({
      rows: allPayments,
      period,
      customer: { name: user?.name || "Customer", email: user?.email ?? null },
    })
    downloadReportPdf(report).catch((error) => console.error("PDF export failed", error))
  }

  const isBusy = isAuthenticated ? paymentsLoading || !paymentsFetched : userLoading
  const hasRealData = allPayments.length > 0

  /**
   * Preview (sample rows + disclaimer) is shown only when the customer has no
   * payments at all. As soon as one real row exists, only real data is shown —
   * a filter that matches nothing gets a plain empty state instead.
   */
  const showPreview = isAuthenticated && !isBusy && !paymentsError && !hasRealData

  const emptyMessage = (what: string) =>
    targetMonth ? `No ${what} found for ${targetMonth}` : `No ${what} found`

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports and Payments" subtitle="Keep track of your support spending and payments." />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {!isAuthenticated && !userLoading && (
            <Card className="border-border">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Sign in to see the payments and monthly reports for the support tickets you have created.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                >
                  <Link href={`/auth/signin?redirect=${encodeURIComponent("/user/reports")}`}>Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {(isAuthenticated || userLoading) && (
            <>
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
                    onClick={() => setActiveTab("payments")}
                    className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                      activeTab === "payments"
                        ? "text-brand-primary border-brand-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                  >
                    Payments
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
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentsError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Could not load your payments. Please try again later.
                </div>
              )}

              {showPreview && (
                <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-foreground">
                  {USER_REPORTS_PREVIEW_DISCLAIMER}
                </div>
              )}

              {/* Payments Table */}
              {activeTab === "payments" && (
                <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid gap-4 items-center text-sm font-medium text-foreground" style={PAYMENTS_GRID}>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedRows.length === payments.length && payments.length > 0}
                          onChange={handleSelectAll}
                          aria-label="Select all payments"
                        />
                      </div>
                      <div className="min-w-0">
                        <SortHeader label="Ticket" field="ticket" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="min-w-0">
                        <SortHeader label="Date" field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="min-w-0">
                        <SortHeader label="Project" field="project" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="min-w-0 whitespace-nowrap">
                        <SortHeader label="Amount (USD)" field="amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="min-w-0">
                        <SortHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div />
                    </div>
                  </div>

                  {isBusy ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payments...</div>
                  ) : showPreview ? (
                    USER_PAYMENT_PREVIEW_ROWS.map((row) => (
                      <div key={row.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 opacity-80">
                        <div className="grid gap-4 items-center" style={PAYMENTS_GRID}>
                          <div className="flex items-center">
                            <Checkbox disabled checked={false} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground font-mono tabular-nums">{row.ticketShortId}</span>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                Preview
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{row.ticketTitle}</div>
                          </div>
                          <div className="min-w-0 text-sm text-muted-foreground">{row.date}</div>
                          <div className={cn("min-w-0 text-sm text-gray-900 truncate", BEFORE_AMOUNT_CLASS)}>{row.projectName}</div>
                          <div className="min-w-0 text-sm text-gray-900 whitespace-nowrap">{row.amount.replace(/^USD\s+/, "")}</div>
                          <div className="min-w-0">
                            <Badge className={statusBadgeClass(row.status)}>{row.status}</Badge>
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
                  ) : payments.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("payments")}</div>
                  ) : (
                    payments.map((row) => {
                      const href = ticketHref(row)
                      const count = row.transactions.length
                      const expanded = count > 1 && isExpanded(row.id)
                      const panelId = transactionsPanelId(row.id)
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]",
                            href &&
                              "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
                          )}
                          {...(href
                            ? {
                                role: "link",
                                tabIndex: 0,
                                "aria-label": `Open ticket ${row.ticketShortId}`,
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
                          <div className="grid gap-4 items-center" style={PAYMENTS_GRID}>
                            <div className="flex items-center">
                              <Checkbox
                                checked={selectedRows.includes(row.id)}
                                onCheckedChange={() => handleRowSelect(row.id)}
                                onClick={stopRowNavigation}
                                aria-label={`Select payment for ticket ${row.ticketShortId}`}
                              />
                            </div>
                            <div className="min-w-0">
                              {href ? (
                                <Link
                                  href={href}
                                  onClick={stopRowNavigation}
                                  className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                                >
                                  {row.ticketShortId}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium text-foreground">—</span>
                              )}
                              <div className="text-xs text-muted-foreground truncate" title={row.ticketTitle}>
                                {row.ticketTitle}
                              </div>
                            </div>
                            <div className="min-w-0 text-sm text-muted-foreground">{formatDate(row.date)}</div>
                            <div className={cn("min-w-0 text-sm text-gray-900 truncate", BEFORE_AMOUNT_CLASS)} title={row.projectName}>
                              {row.projectName}
                            </div>
                            <div className="min-w-0 text-sm text-gray-900">
                              <div className="whitespace-nowrap">{formatPaymentAmount(row.amountSmallestUnit, row.currency)}</div>
                              {row.paidSmallestUnit > 0 && row.openSmallestUnit > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {formatPaymentAmount(row.openSmallestUnit, row.currency)} not charged yet
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Badge className={statusBadgeClass(USER_PAYMENT_STATUS_LABELS[row.displayStatus])}>
                                {USER_PAYMENT_STATUS_LABELS[row.displayStatus]}
                              </Badge>
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
                                    <DropdownMenuItem
                                      title="Each transaction has its own Stripe receipt"
                                      onSelect={() => toggle(row.id)}
                                    >
                                      <ExternalLink />
                                      Receipts
                                    </DropdownMenuItem>
                                  ) : (
                                    <ReceiptMenuItem row={row.transactions[0]} />
                                  )}
                                  <DropdownMenuItem
                                    title="Download a PDF report of this ticket with all its transactions"
                                    onSelect={() => downloadTicketPdf(row)}
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
                              />
                            </div>
                          )}
                          {expanded && (
                            <div className="cursor-default" onClick={stopRowNavigation}>
                            {/* The panel reaches 12px past the row's columns; border + line padding bring the lines back onto the same grid. */}
                            <TransactionsPanel id={panelId} className="-mx-3 overflow-x-visible">
                              {row.transactions.map((transaction, index) => {
                                const description = USER_TRANSACTION_DESCRIPTIONS[transaction.displayStatus]
                                return (
                                  <div
                                    key={transaction.id}
                                    role="listitem"
                                    className="grid items-center gap-4 px-[11px] py-2 text-sm"
                                    style={PAYMENTS_GRID}
                                  >
                                    <span />
                                    <span className="min-w-0 text-xs text-muted-foreground tabular-nums">
                                      {index + 1} of {count}
                                    </span>
                                    <span className="min-w-0 text-muted-foreground tabular-nums">
                                      {formatDate(transaction.date)}
                                    </span>
                                    <span className={cn("min-w-0 truncate text-foreground", BEFORE_AMOUNT_CLASS)} title={description}>
                                      {description}
                                    </span>
                                    <span className="min-w-0 whitespace-nowrap text-foreground tabular-nums">
                                      {formatPaymentAmount(transaction.amountSmallestUnit, transaction.currency)}
                                    </span>
                                    <span className="min-w-0">
                                      <Badge className={statusBadgeClass(USER_PAYMENT_STATUS_LABELS[transaction.displayStatus])}>
                                        {USER_PAYMENT_STATUS_LABELS[transaction.displayStatus]}
                                      </Badge>
                                    </span>
                                    {/* Wider than the kebab column: right-aligned, it extends left into the spacing before it. */}
                                    <span className="flex items-center justify-end [&>*]:shrink-0">
                                      <ReceiptButton row={transaction} />
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
              )}

              {/* Monthly Reports Tab Content */}
              {activeTab === "monthly" && (
                <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid gap-4 items-center text-sm font-medium text-foreground" style={MONTHLY_GRID}>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedMonthlyRows.length === monthlyReports.length && monthlyReports.length > 0}
                          onChange={handleMonthlySelectAll}
                          aria-label="Select all monthly reports"
                        />
                      </div>
                      <div className="col-span-3">
                        <SortHeader label="Period" field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Tickets" field="tickets" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Amount (USD)" field="amount" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-foreground">Status</span>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-foreground">Actions</span>
                      </div>
                    </div>
                  </div>
                  {isBusy ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading reports...</div>
                  ) : showPreview ? (
                    USER_MONTHLY_PREVIEW_ROWS.map((row) => (
                      <div key={row.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 opacity-80">
                        <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                          <div className="flex items-center">
                            <Checkbox disabled checked={false} />
                          </div>
                          <div className="col-span-3 flex items-center gap-2 text-sm text-gray-900">
                            {row.period}
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                          <div className="col-span-2 text-sm text-gray-900">{row.ticketCount}</div>
                          <div className="col-span-2 text-sm text-gray-900">{row.amount.replace(/^USD\s+/, "")}</div>
                          <div className="col-span-2">
                            <Badge className={statusBadgeClass("Paid")}>Paid</Badge>
                          </div>
                          <div className="col-span-2">
                            <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                              <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </Button>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : monthlyReports.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                      {hasRealData && !targetMonth
                        ? "No completed payments yet. Monthly reports appear once a ticket has been paid."
                        : emptyMessage("monthly reports")}
                    </div>
                  ) : (
                    monthlyReports.map((row) => (
                      <div key={row.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={MONTHLY_GRID}>
                          <div className="flex items-center">
                            <Checkbox
                              checked={selectedMonthlyRows.includes(row.id)}
                              onCheckedChange={() => handleMonthlyRowSelect(row.id)}
                              aria-label={`Select monthly report for ${row.period}`}
                            />
                          </div>
                          <div className="col-span-3 text-sm text-gray-900">{row.period}</div>
                          <div className="col-span-2 text-sm text-gray-900">{row.ticketCount}</div>
                          <div className="col-span-2 text-sm text-gray-900">
                            {formatPaymentAmount(row.amountSmallestUnit, row.currency)}
                          </div>
                          <div className="col-span-2">
                            <Badge className={statusBadgeClass("Paid")}>Paid</Badge>
                          </div>
                          <div className="col-span-2">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className={OUTLINE_BUTTON_CLASS}
                              title="Download a PDF report of this month's charges"
                              onClick={() => downloadMonthlyPdf(row.period)}
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
