"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from "lucide-react"
import { useUserPayments, formatAmount } from "@/hooks/usePayments"
import { useUser } from "@/contexts/user-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { RequestPdfModal } from "@/components/modals/request-pdf-modal"
import {
  USER_MONTHLY_PREVIEW_ROWS,
  USER_PAYMENT_PREVIEW_ROWS,
  USER_REPORTS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"
import {
  aggregateMonthly,
  monthLabel,
  toUserPaymentRow,
  USER_PAYMENT_STATUS_LABELS,
  type UserMonthlyReportRow,
  type UserPaymentDisplayStatus,
  type UserPaymentRow,
} from "@/lib/user-payment-reports"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"

// dd/mm/yyyy, matching the helper reports page
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

type SortField = "ticket" | "project" | "date" | "ticketType" | "amount" | "status"
type MonthlySortField = "period" | "tickets" | "amount"
type SortDirection = "asc" | "desc"

const STATUS_BADGE_CLASS: Record<UserPaymentDisplayStatus, string> = {
  paid: "bg-green-100 text-green-800 hover:bg-green-100",
  on_hold: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  action_required: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  failed: "bg-red-100 text-red-800 hover:bg-red-100",
  cancelled: "bg-gray-100 text-gray-700 hover:bg-gray-100",
}

const PREVIEW_STATUS_CLASS: Record<"Paid" | "On hold" | "Pending", string> = {
  Paid: STATUS_BADGE_CLASS.paid,
  "On hold": STATUS_BADGE_CLASS.on_hold,
  Pending: STATUS_BADGE_CLASS.pending,
}

const PAYMENTS_GRID = { gridTemplateColumns: "2rem repeat(12, 1fr)" }
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

function ticketHref(row: UserPaymentRow): string | null {
  if (!row.ticketId) return null
  const params = new URLSearchParams({ ticket: row.ticketId })
  if (row.projectId) params.set("project", row.projectId)
  return `/support/chat?${params.toString()}`
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
  const [requestPdfOpen, setRequestPdfOpen] = useState(false)

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
    selectedFilter === "current" || selectedMonth
      ? selectedMonth || monthLabel(new Date().toISOString())
      : null

  const payments: UserPaymentRow[] = useMemo(() => {
    let list = allPayments
    if (targetMonth) {
      list = list.filter((row) => monthLabel(row.date) === targetMonth)
    }
    if (!sortField) return list
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sortField) {
        case "ticket":
          return compare(a.ticketTitle.toLowerCase(), b.ticketTitle.toLowerCase(), sortDirection)
        case "project":
          return compare(a.projectName.toLowerCase(), b.projectName.toLowerCase(), sortDirection)
        case "date":
          return compare(new Date(a.date).getTime(), new Date(b.date).getTime(), sortDirection)
        case "ticketType":
          return compare(a.ticketType.toLowerCase(), b.ticketType.toLowerCase(), sortDirection)
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
                          disabled={payments.length === 0}
                          aria-label="Select all payments"
                        />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Ticket" field="ticket" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Project" field="project" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="col-span-1">
                        <SortHeader label="Date" field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </div>
                      <div className="col-span-1">
                        <SortHeader label="Type" field="ticketType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
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
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">Loading payments...</div>
                  ) : showPreview ? (
                    USER_PAYMENT_PREVIEW_ROWS.map((row) => (
                      <div key={row.id} role="presentation" className="px-6 py-4 border-b border-border last:border-b-0 opacity-80">
                        <div className="grid gap-4 items-center" style={PAYMENTS_GRID}>
                          <div className="flex items-center">
                            <Checkbox disabled checked={false} />
                          </div>
                          <div className="col-span-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono tabular-nums text-sm text-gray-900">{row.ticketShortId}</span>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                Preview
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{row.ticketTitle}</div>
                          </div>
                          <div className="col-span-2 text-sm text-gray-900 truncate">{row.projectName}</div>
                          <div className="col-span-1 text-sm text-muted-foreground">{row.date}</div>
                          <div className="col-span-1">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                              {row.ticketType}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-sm text-gray-900">{row.amount}</div>
                          <div className="col-span-2">
                            <Badge variant="secondary" className={PREVIEW_STATUS_CLASS[row.status]}>
                              {row.status}
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
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Receipt
                                </Button>
                              </span>
                              <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                                <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                                  Request PDF
                                </Button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : payments.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("payments")}</div>
                  ) : (
                    payments.map((row) => {
                      const href = ticketHref(row)
                      return (
                        <div key={row.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f7f9ff]">
                          <div className="grid gap-4 items-center" style={PAYMENTS_GRID}>
                            <div className="flex items-center">
                              <Checkbox
                                checked={selectedRows.includes(row.id)}
                                onCheckedChange={() => handleRowSelect(row.id)}
                                aria-label={`Select payment for ticket ${row.ticketShortId}`}
                              />
                            </div>
                            <div className="col-span-2 min-w-0">
                              <span className="font-mono tabular-nums text-sm text-gray-900">{row.ticketShortId}</span>
                              <div className="text-xs text-muted-foreground truncate" title={row.ticketTitle}>
                                {row.ticketTitle}
                              </div>
                            </div>
                            <div className="col-span-2 text-sm text-gray-900 truncate" title={row.projectName}>
                              {row.projectName}
                            </div>
                            <div className="col-span-1 text-sm text-muted-foreground">{formatDate(row.date)}</div>
                            <div className="col-span-1">
                              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                                {row.ticketType}
                              </Badge>
                            </div>
                            <div className="col-span-1 text-sm text-gray-900">
                              {formatAmount(row.amountSmallestUnit, row.currency)}
                            </div>
                            <div className="col-span-2">
                              <Badge variant="secondary" className={STATUS_BADGE_CLASS[row.displayStatus]}>
                                {USER_PAYMENT_STATUS_LABELS[row.displayStatus]}
                              </Badge>
                            </div>
                            <div className="col-span-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {href ? (
                                  <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
                                    <Link href={href}>Open</Link>
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                                    Open
                                  </Button>
                                )}
                                {row.receiptUrl ? (
                                  <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
                                    <a
                                      href={row.receiptUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open the Stripe receipt for this payment (view, download or print)"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Receipt
                                    </a>
                                  </Button>
                                ) : (
                                  <span
                                    title={
                                      row.displayStatus === "paid"
                                        ? "The receipt is still being prepared by Stripe. Check back shortly."
                                        : "A receipt becomes available once the payment has been captured."
                                    }
                                    className="inline-flex"
                                  >
                                    <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Receipt
                                    </Button>
                                  </span>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  className={OUTLINE_BUTTON_CLASS}
                                  onClick={() => setRequestPdfOpen(true)}
                                >
                                  Request PDF
                                </Button>
                              </div>
                            </div>
                          </div>
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
                        <SortHeader label="Period" field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Tickets" field="tickets" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2">
                        <SortHeader label="Amount spent" field="amount" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-foreground">Status</span>
                      </div>
                      <div className="col-span-3 flex items-center">
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
                          <div className="col-span-3 flex items-center gap-2 text-sm text-gray-900">
                            {row.period}
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                          <div className="col-span-2 text-sm text-gray-900">{row.ticketCount}</div>
                          <div className="col-span-2 text-sm text-gray-900">{row.amount}</div>
                          <div className="col-span-2">
                            <Badge variant="secondary" className={STATUS_BADGE_CLASS.paid}>
                              Paid
                            </Badge>
                          </div>
                          <div className="col-span-3">
                            <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                              <Button variant="outline" size="sm" type="button" disabled className={OUTLINE_BUTTON_CLASS}>
                                Request PDF
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
                          <div className="col-span-3 text-sm text-gray-900">{row.period}</div>
                          <div className="col-span-2 text-sm text-gray-900">{row.ticketCount}</div>
                          <div className="col-span-2 text-sm text-gray-900">
                            {formatAmount(row.amountSmallestUnit, row.currency)}
                          </div>
                          <div className="col-span-2">
                            <Badge variant="secondary" className={STATUS_BADGE_CLASS.paid}>
                              Paid
                            </Badge>
                          </div>
                          <div className="col-span-3">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className={OUTLINE_BUTTON_CLASS}
                              onClick={() => setRequestPdfOpen(true)}
                            >
                              Request PDF
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

      <RequestPdfModal open={requestPdfOpen} onOpenChange={setRequestPdfOpen} />
    </div>
  )
}
