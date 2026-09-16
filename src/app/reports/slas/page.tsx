"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { useProjectSelection } from "@/contexts/project-context"
import { useProjectSlaBillingPeriods, useProjectSlaTickets, ticketLoggedMinutes } from "@/hooks/useSlaReports"
import { getAvatarColorHexForId } from "@/lib/constants"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import { RequestPdfModal } from "@/components/modals/request-pdf-modal"
import { computePeriodUsage, formatSlaAmount, formatSlaDate, formatSlaMinutes, periodLabel } from "@/lib/sla"

type MonthlySortField = "period" | "entity" | "included" | "consumed" | "overage" | "amount"
type TicketsSortField = "date" | "entity" | "minutes" | "status"
type SortDirection = "asc" | "desc"

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
    <button type="button" onClick={() => onSort(field)} className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer">
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

function monthLabelOf(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function calendarDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(day)
}

interface ReportRow {
  id: string
  slaId: string
  entity: string
  period: string
  periodRaw: number
  /** Calendar month the period starts in, for the month filter. */
  monthLabel: string
  included: number
  rolledOver: number
  consumed: number
  remaining: number
  overage: number
  overageCostSmallestUnit: number
  subscriptionSmallestUnit: number
  currency: string
  isCurrent: boolean
}

interface TicketRow {
  id: string
  slaId: string | null
  entity: string
  title: string
  date: string
  dateRaw: string
  monthLabel: string
  minutes: number
  recorded: string | null
  status: string
}

const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"

export default function ReportsSLAsPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "tickets">("monthly")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "current">("all")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectedTicketRows, setSelectedTicketRows] = useState<string[]>([])
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField | null>(null)
  const [monthlySortDirection, setMonthlySortDirection] = useState<SortDirection>("asc")
  const [ticketsSortField, setTicketsSortField] = useState<TicketsSortField | null>(null)
  const [ticketsSortDirection, setTicketsSortDirection] = useState<SortDirection>("asc")
  const [requestPdfOpen, setRequestPdfOpen] = useState(false)

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: periodsData, isLoading: periodsLoading, error: periodsError } = useProjectSlaBillingPeriods(projectId)
  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = useProjectSlaTickets(projectId)

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
    selectedFilter === "current" || selectedMonth ? selectedMonth || monthLabelOf(new Date().toISOString()) : null

  const today = new Date().toISOString().slice(0, 10)

  const allReports: ReportRow[] = useMemo(() => {
    return (periodsData ?? []).map((p) => {
      const usage = computePeriodUsage(p)
      const start = calendarDay(p.period_start)
      return {
        id: p.id,
        slaId: p.sla.id,
        entity: p.sla.name?.trim() || "Unnamed SLA",
        period: periodLabel(p, p.sla.payment_frequency),
        periodRaw: start.getTime(),
        monthLabel: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        included: usage.minutesIncluded,
        rolledOver: usage.minutesRolledOver,
        consumed: usage.minutesConsumed,
        remaining: usage.minutesRemaining,
        overage: usage.overageMinutes,
        overageCostSmallestUnit: usage.overageMinutes * (p.sla.ticket_price_minute_first_60 || 0),
        subscriptionSmallestUnit: p.sla.subscription_amount_smallest_unit,
        currency: p.sla.currency || "usd",
        isCurrent: p.period_start <= today && today < p.period_end,
      }
    })
  }, [periodsData, today])

  const reports = useMemo(() => {
    let list = allReports
    if (targetMonth) list = list.filter((r) => r.monthLabel === targetMonth)
    if (!monthlySortField) return list
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (monthlySortField) {
        case "period":
          return compare(a.periodRaw, b.periodRaw, monthlySortDirection)
        case "entity":
          return compare(a.entity.toLowerCase(), b.entity.toLowerCase(), monthlySortDirection)
        case "included":
          return compare(a.included + a.rolledOver, b.included + b.rolledOver, monthlySortDirection)
        case "consumed":
          return compare(a.consumed, b.consumed, monthlySortDirection)
        case "overage":
          return compare(a.overage, b.overage, monthlySortDirection)
        case "amount":
          return compare(a.subscriptionSmallestUnit, b.subscriptionSmallestUnit, monthlySortDirection)
        default:
          return 0
      }
    })
    return sorted
  }, [allReports, targetMonth, monthlySortField, monthlySortDirection])

  const allTickets: TicketRow[] = useMemo(() => {
    return (ticketsData ?? []).map((t) => {
      const dateRaw = t.completed_at || t.created_at
      return {
        id: t.id,
        slaId: t.sla?.id ?? t.sla_id ?? null,
        entity: t.sla?.name?.trim() || "Unnamed SLA",
        title: t.title?.trim() || "Untitled ticket",
        date: formatSlaDate(dateRaw),
        dateRaw,
        monthLabel: monthLabelOf(dateRaw),
        minutes: ticketLoggedMinutes(t.time_entries),
        recorded: t.sla_usage_recorded_at,
        status: t.status,
      }
    })
  }, [ticketsData])

  const tickets = useMemo(() => {
    let list = allTickets
    if (targetMonth) list = list.filter((t) => t.monthLabel === targetMonth)
    if (!ticketsSortField) return list
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (ticketsSortField) {
        case "date":
          return compare(new Date(a.dateRaw).getTime(), new Date(b.dateRaw).getTime(), ticketsSortDirection)
        case "entity":
          return compare(a.entity.toLowerCase(), b.entity.toLowerCase(), ticketsSortDirection)
        case "minutes":
          return compare(a.minutes, b.minutes, ticketsSortDirection)
        case "status":
          return compare(a.status, b.status, ticketsSortDirection)
        default:
          return 0
      }
    })
    return sorted
  }, [allTickets, targetMonth, ticketsSortField, ticketsSortDirection])

  const handleMonthlySort = (field: string) => {
    const next = field as MonthlySortField
    if (monthlySortField === next) setMonthlySortDirection(monthlySortDirection === "asc" ? "desc" : "asc")
    else {
      setMonthlySortField(next)
      setMonthlySortDirection("asc")
    }
  }

  const handleTicketsSort = (field: string) => {
    const next = field as TicketsSortField
    if (ticketsSortField === next) setTicketsSortDirection(ticketsSortDirection === "asc" ? "desc" : "asc")
    else {
      setTicketsSortField(next)
      setTicketsSortDirection("asc")
    }
  }

  const handleRowSelect = (id: string) =>
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  const handleSelectAll = () => setSelectedRows(selectedRows.length === reports.length ? [] : reports.map((r) => r.id))
  const handleTicketRowSelect = (id: string) =>
    setSelectedTicketRows((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  const handleTicketSelectAll = () =>
    setSelectedTicketRows(selectedTicketRows.length === tickets.length ? [] : tickets.map((t) => t.id))

  const emptyMessage = (what: string) => (targetMonth ? `No ${what} found for ${targetMonth}` : `No ${what} found`)
  const error = periodsError ?? ticketsError

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="SLA reports" subtitle="Included time, usage and overage for each agreement." />

        <main className="flex-1 p-6 overflow-y-auto">
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
                Billing periods
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tickets")}
                className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                  activeTab === "tickets"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Tickets
              </button>
            </div>
            <div className="h-px bg-border -mx-6"></div>
          </div>

          <div className="max-w-7xl space-y-6">
            {/* Filters */}
            <div className="flex gap-2">
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

            {!projectId && (
              <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">Select a project to see its SLA reports.</div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load SLA reports. Please try again later.</div>
            )}

            {activeTab === "monthly" && (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: "2rem repeat(12, 1fr)" }}>
                    <div>
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedRows.length === reports.length && reports.length > 0}
                        onChange={handleSelectAll}
                        disabled={reports.length === 0}
                        aria-label="Select all periods"
                      />
                    </div>
                    <div className="col-span-3">
                      <SortHeader label="Agreement" field="entity" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Period" field="period" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Available" field="included" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Used" field="consumed" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Overage" field="overage" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Subscription" field="amount" sortField={monthlySortField} sortDirection={monthlySortDirection} onSort={handleMonthlySort} />
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium text-foreground">Actions</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {periodsLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading reports...</div>
                  ) : reports.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                      {allReports.length === 0 && !targetMonth
                        ? "No billing periods yet. A period appears once an SLA is subscribed or its first ticket completes."
                        : emptyMessage("billing periods")}
                    </div>
                  ) : (
                    reports.map((r) => (
                      <div key={r.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={{ gridTemplateColumns: "2rem repeat(12, 1fr)" }}>
                          <div>
                            <Checkbox checked={selectedRows.includes(r.id)} onCheckedChange={() => handleRowSelect(r.id)} aria-label={`Select ${r.entity}`} />
                          </div>
                          <div className="col-span-3 flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                              style={{ backgroundColor: getAvatarColorHexForId(r.slaId) }}
                            >
                              {r.entity.charAt(0).toUpperCase()}
                            </div>
                            <Link href={`/slas/${r.slaId}`} className="text-sm font-medium text-foreground hover:text-brand-primary truncate">
                              {r.entity}
                            </Link>
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground">
                            {r.period}
                            {r.isCurrent && (
                              <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="col-span-1 text-sm text-foreground">
                            {formatSlaMinutes(r.included + r.rolledOver)}
                            {r.rolledOver > 0 && (
                              <div className="text-xs text-muted-foreground">incl. {formatSlaMinutes(r.rolledOver)} rolled over</div>
                            )}
                          </div>
                          <div className="col-span-1 text-sm text-foreground">{formatSlaMinutes(r.consumed)}</div>
                          <div className="col-span-1 text-sm">
                            {r.overage > 0 ? (
                              <>
                                <span className="text-red-700">{formatSlaMinutes(r.overage)}</span>
                                {r.overageCostSmallestUnit > 0 && (
                                  <div className="text-xs text-muted-foreground">≈ {formatSlaAmount(r.overageCostSmallestUnit, r.currency)}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="col-span-2 text-sm text-foreground">{formatSlaAmount(r.subscriptionSmallestUnit, r.currency)}</div>
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
                              <Link href={`/slas/${r.slaId}`}>Open</Link>
                            </Button>
                            <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} onClick={() => setRequestPdfOpen(true)}>
                              Request PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "tickets" && (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                  <div className="grid gap-4 items-center" style={{ gridTemplateColumns: "2rem repeat(12, 1fr)" }}>
                    <div>
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedTicketRows.length === tickets.length && tickets.length > 0}
                        onChange={handleTicketSelectAll}
                        disabled={tickets.length === 0}
                        aria-label="Select all tickets"
                      />
                    </div>
                    <div className="col-span-4">
                      <span className="text-sm font-medium text-foreground">Ticket</span>
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Agreement" field="entity" sortField={ticketsSortField} sortDirection={ticketsSortDirection} onSort={handleTicketsSort} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Date" field="date" sortField={ticketsSortField} sortDirection={ticketsSortDirection} onSort={handleTicketsSort} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Logged" field="minutes" sortField={ticketsSortField} sortDirection={ticketsSortDirection} onSort={handleTicketsSort} />
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-medium text-foreground">Recorded</span>
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Status" field="status" sortField={ticketsSortField} sortDirection={ticketsSortDirection} onSort={handleTicketsSort} />
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium text-foreground">Actions</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {ticketsLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
                  ) : tickets.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">{emptyMessage("SLA tickets")}</div>
                  ) : (
                    tickets.map((t) => (
                      <div key={t.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={{ gridTemplateColumns: "2rem repeat(12, 1fr)" }}>
                          <div>
                            <Checkbox checked={selectedTicketRows.includes(t.id)} onCheckedChange={() => handleTicketRowSelect(t.id)} aria-label={`Select ${t.title}`} />
                          </div>
                          <div className="col-span-4 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate" title={t.title}>{t.title}</div>
                            <div className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 7)}</div>
                          </div>
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-foreground shrink-0"
                              style={{ backgroundColor: getAvatarColorHexForId(t.slaId) }}
                            >
                              {t.entity.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-foreground truncate">{t.entity}</span>
                          </div>
                          <div className="col-span-1 text-sm text-muted-foreground">{t.date}</div>
                          <div className="col-span-1 text-sm text-foreground">{formatSlaMinutes(t.minutes)}</div>
                          <div className="col-span-1 text-sm text-muted-foreground">
                            {t.recorded ? "Yes" : t.status === "completed" ? "Pending" : "—"}
                          </div>
                          <div className="col-span-1">
                            <Badge variant="secondary" className={`${getTicketStatusBadgeClass(t.status)} border-0 capitalize`}>
                              {t.status.replace("-", " ")}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
                              <Link href={`/helper/tickets/${t.id}`}>Open</Link>
                            </Button>
                            <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} onClick={() => setRequestPdfOpen(true)}>
                              Request PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <RequestPdfModal open={requestPdfOpen} onOpenChange={setRequestPdfOpen} />
    </div>
  )
}
