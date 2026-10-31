"use client"

import { useState, useMemo, use, type KeyboardEvent, type SyntheticEvent } from "react"
import {
  MessageCircle,
  Mail,
  Info,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowLeft,
  HelpCircle,
  ExternalLink,
  List,
  MoreVertical,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Header } from "@/components/layout/header"
import { useHelper } from "@/hooks/useHelpers"
import { useTimeEntries, formatTime, calculateTotalTime } from "@/hooks/useTimeEntries"
import { usePaymentTransfers, usePayments, formatAmount, type PaymentTransfer } from "@/hooks/usePayments"
import { useHelperTickets } from "@/hooks/useHelperTickets"
import { useProjectSelection } from "@/contexts/project-context"
import { getAvatarColorHexForId, SQUIRCLE_RADIUS } from "@/lib/constants"
import { getStatusBadgeClass } from "@/lib/status-colors"
import { groupTransfersByTicket, payoutReference, transferDate } from "@/lib/helper-payout-reports"
import { monthLabel } from "@/lib/user-payment-reports"
import {
  TransactionsPanel,
  TransactionsToggle,
  transactionsPanelId,
  useExpandedRows,
} from "@/components/reports/ticket-transactions"
import { EmptyState } from "@/components/ui/empty-state"
import { ListSkeleton } from "@/components/ui/skeleton"
import { ListHeader, listRowClass } from "@/components/ui/list"

type SortDirection = "asc" | "desc"
type TicketsSortField = "ticket" | "date" | "amount" | "status"

/** Close date: cancelled tickets carry cancelled_at, completed ones completed_at. */
function ticketDisplayDate(ticket: { status?: string | null; completed_at?: string | null; created_at?: string | null }): string | null {
  const closed =
    ticket.status === "cancelled"
      ? (ticket as { cancelled_at?: string | null }).cancelled_at ?? ticket.completed_at
      : ticket.completed_at
  return closed ?? ticket.created_at ?? null
}

// Same Badge classes as Reports: design-token colours from getStatusBadgeClass.
const statusBadgeClass = (label: string) =>
  `${getStatusBadgeClass(label)} flex items-center gap-1 w-fit text-ui px-3 py-1`

// A payout line reads "Received" once the money has reached the helper; the
// ticket row itself keeps "Completed".
const TRANSFER_STATUS_LABEL: Record<PaymentTransfer["status"], string> = {
  completed: "Received",
  pending: "Pending",
  failed: "Failed",
}
// "Received" is not known to getStatusBadgeClass, so it uses the key Reports uses for the same meaning.
const TRANSFER_STATUS_BADGE_CLASS: Record<PaymentTransfer["status"], string> = {
  completed: statusBadgeClass("paid out"),
  pending: statusBadgeClass("pending"),
  failed: statusBadgeClass("failed"),
}

// All tickets: checkbox · Ticket ID · Date · Helper income (the helper's payouts on the ticket) · Status · kebab menu.
// Same construction as Reports → Tickets: every column has a width that does not depend on the row's content.
// Status: fixed, sized for the widest status badge.
// Last: the kebab trigger (2.75rem) plus 36px which, with the 16px grid gap, puts 52px between the Status column and the kebab menu.
const HELPER_TICKETS_GRID = {
  gridTemplateColumns: "2rem minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.5fr) 9rem calc(2.75rem + 36px)",
}
const KEBAB_BUTTON_CLASS = "text-muted-foreground hover:bg-muted"
const OUTLINE_BUTTON_CLASS = "text-muted-foreground border-border hover:bg-muted bg-transparent"

// As on Reports: the column header already says "Helper income (USD)", so USD
// amounts drop the prefix. Any other currency keeps it so it is never silently hidden.
const formatAmountValue = (cents: number) => (cents / 100).toFixed(2)
const formatPaymentAmount = (cents: number, currency: string = "usd") =>
  currency.toLowerCase() === "usd" ? formatAmountValue(cents) : formatAmount(cents, currency)

// Rows are clickable; controls inside a row stop the event so they do not trigger the row's action.
const stopRowNavigation = (event: SyntheticEvent) => event.stopPropagation()

const TICKET_PREVIEW_LENGTH = 15
/** Start of the ticket title: the first 15 characters followed by "..", or the whole text when it is no longer than that. */
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

/** Three-state sort: asc → desc → off, matching the Reports pages. */
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

/** Extract a short ticket ID for display (e.g. from uuid 02735023-... to 2735023) */
function getShortTicketId(ticketId: string | null): string {
  if (!ticketId) return "—"
  const first = ticketId.split("-")[0] || ""
  return first.replace(/^0+/, "") || first.slice(0, 8)
}

function ReceiptButton({ url }: { url: string | null }) {
  if (url) {
    return (
      <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title={RECEIPT_AVAILABLE_TITLE}>
          <ExternalLink className="w-3.5 h-3.5" />
          Receipt
        </a>
      </Button>
    )
  }
  return (
    <span title={RECEIPT_UNAVAILABLE_TITLE} className="inline-flex">
      <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} disabled>
        <ExternalLink className="w-3.5 h-3.5" />
        Receipt
      </Button>
    </span>
  )
}

/** "Receipt" entry of the row's kebab menu, for a ticket with a single charge. */
function ReceiptMenuItem({ url, label = "Receipt" }: { url: string | null; label?: string }) {
  if (url) {
    return (
      <DropdownMenuItem asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title={RECEIPT_AVAILABLE_TITLE}>
          <ExternalLink />
          {label}
        </a>
      </DropdownMenuItem>
    )
  }
  // Disabled items ignore pointer events, so the explanation sits on a wrapper.
  return (
    <span title={RECEIPT_UNAVAILABLE_TITLE} className="block">
      <DropdownMenuItem disabled>
        <ExternalLink />
        {label}
      </DropdownMenuItem>
    </span>
  )
}

// Only tickets the helper has actually worked on are listed; 'available'
// (unclaimed) and 'cancelled' tickets are excluded from the list and stats.
const HELPER_TICKET_STATUSES = ["completed", "in-progress", "claimed"] as const
type HelperTicketStatus = (typeof HELPER_TICKET_STATUSES)[number]

const TICKET_STATUS_LABEL: Record<HelperTicketStatus, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  claimed: "Claimed",
}

const isHelperTicket = <T extends { status: string }>(
  ticket: T
): ticket is T & { status: HelperTicketStatus } =>
  (HELPER_TICKET_STATUSES as readonly string[]).includes(ticket.status)

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

export default function HelperProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [ticketsSort, setTicketsSort] = useState<{ field: TicketsSortField | null; direction: SortDirection }>({ field: null, direction: "asc" })

  // Unwrap params Promise
  const { id } = use(params)

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Fetch helper data
  const { data: helperData, isLoading: helperLoading } = useHelper(id)
  const { data: helperTicketsData, isLoading: helperTicketsLoading } = useHelperTickets(id, projectId)
  const { data: timeEntriesData } = useTimeEntries({
    helperId: id,
    projectId,
  })
  const { data: transfersData, isLoading: transfersLoading } = usePaymentTransfers({
    helperId: id,
    projectId,
  })
  const ticketsLoading = helperTicketsLoading || transfersLoading
  // Customer-side charges for this project — the source of the Stripe receipt
  // link shown on each ticket row.
  const { data: paymentsData } = usePayments(projectId)

  // Last 12 months for the period filter dropdown
  const months = useMemo(() => {
    const result: string[] = []
    const currentDate = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      result.push(date.toLocaleDateString("en-US", { month: "long", year: "numeric" }))
    }
    return result
  }, [])

  // Period the stats and ticket list are shown for: null = "All", otherwise a
  // monthLabel() string ("October 2026") matching the dropdown labels. A
  // ticket belongs to the month it closed in (created_at when not completed).
  const targetMonth =
    selectedPeriod === "all"
      ? null
      : selectedPeriod === "current"
        ? monthLabel(new Date().toISOString())
        : selectedPeriod

  // The hooks fetch everything once; the status and period filters are
  // applied in memory. Both the ticket list and the Key stats derive from
  // this, so they always agree.
  const periodTickets = useMemo(() => {
    const all = (helperTicketsData ?? []).filter(isHelperTicket)
    if (!targetMonth) return all
    return all.filter((ticket) => monthLabel(ticketDisplayDate(ticket) ?? "") === targetMonth)
  }, [helperTicketsData, targetMonth])

  const periodTimeEntries = useMemo(() => {
    const all = timeEntriesData ?? []
    if (!targetMonth) return all
    const ticketIds = new Set(periodTickets.map((ticket) => ticket.id))
    return all.filter((entry) => ticketIds.has(entry.ticket_id))
  }, [timeEntriesData, periodTickets, targetMonth])

  const { isExpanded, toggle } = useExpandedRows()

  const stats = useMemo(() => {
    const totalTime = calculateTotalTime(periodTimeEntries)
    const tickets = periodTickets
    const completedCount = tickets.filter((t) => t.status === "completed").length

    return {
      ticketsSolved: completedCount,
      totalTime: formatTime(totalTime),
      percentageSolved:
        tickets.length > 0
          ? Math.round((completedCount / tickets.length) * 100)
          : 0,
    }
  }, [periodTimeEntries, periodTickets])

  // Transform helper tickets to ticket list. A ticket can be paid out to
  // the helper in several transfers (hold capture + overage, weekly
  // captures, a retried charge); they are summed into one record and listed
  // underneath, each with the receipt of the charge it was split from.
  const tickets = useMemo(() => {
    // Stripe receipt URLs per ticket, oldest charge first; used when payouts
    // can't be matched to their charge (legacy rows without payment_id).
    const receiptsByTicket = new Map<string, string[]>()
    for (const payment of [...(paymentsData ?? [])].reverse()) {
      if (!payment.ticket_id || !payment.stripe_receipt_url) continue
      const list = receiptsByTicket.get(payment.ticket_id) ?? []
      list.push(payment.stripe_receipt_url)
      receiptsByTicket.set(payment.ticket_id, list)
    }
    const receiptsFor = (ticketId: string | null | undefined) =>
      ticketId ? receiptsByTicket.get(ticketId) ?? [] : []

    const groups = groupTransfersByTicket(transfersData ?? [])

    const list =
      !helperTicketsData || helperTicketsData.length === 0
        ? // Fallback to transfers if no tickets found via participants
          groups
            .filter((group) => !targetMonth || (group.date && monthLabel(group.date) === targetMonth))
            .map((group) => ({
              key: group.key,
              id: group.ticketId ?? "",
              shortId: getShortTicketId(group.ticketId),
              title: "—",
              dateIso: group.date || null,
              amountRaw: group.amountSmallestUnit as number | null,
              currency: group.currency,
              status: group.status === "completed" ? "Completed" : "In progress",
              receipts: receiptsFor(group.ticketId),
              transfers: group.items,
            }))
        : (() => {
            const groupsByTicket = new Map(groups.filter((g) => g.ticketId).map((group) => [group.ticketId as string, group]))
            return periodTickets.map((ticket) => {
              const group = groupsByTicket.get(ticket.id)
              return {
                key: ticket.id,
                id: ticket.id,
                shortId: getShortTicketId(ticket.id),
                title: ticket.title?.trim() || "—",
                dateIso: ticketDisplayDate(ticket),
                amountRaw: group ? group.amountSmallestUnit : null,
                currency: group?.currency ?? "usd",
                status: TICKET_STATUS_LABEL[ticket.status],
                receipts: receiptsFor(ticket.id),
                transfers: group?.items ?? [],
              }
            })
          })()

    const { field, direction } = ticketsSort
    if (!field) return list
    return list.sort((a, b) => {
      switch (field) {
        case "ticket":
          return compare(a.shortId, b.shortId, direction)
        case "date":
          return compare(a.dateIso ? new Date(a.dateIso).getTime() : 0, b.dateIso ? new Date(b.dateIso).getTime() : 0, direction)
        case "amount":
          return compare(a.amountRaw ?? -1, b.amountRaw ?? -1, direction)
        case "status":
          return compare(a.status, b.status, direction)
        default:
          return 0
      }
    })
  }, [helperTicketsData, periodTickets, targetMonth, transfersData, paymentsData, ticketsSort])

  const visibleKeys = tickets.map((ticket) => ticket.key)
  const allSelected = visibleKeys.length > 0 && selectedRows.length === visibleKeys.length
  const handleRowSelect = (key: string) => {
    setSelectedRows((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]))
  }
  const handleSelectAll = () => {
    setSelectedRows((prev) => (prev.length === visibleKeys.length ? [] : visibleKeys))
  }

  const receiptForTransfer = (transfer: PaymentTransfer) =>
    (transfer.payment_id && paymentsData?.find((p) => p.id === transfer.payment_id)?.stripe_receipt_url) || null

  // Back to the list, shown above the page title.
  const backLink = (
    <Link
      href="/helpers"
      className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-brand-primary focus-visible:text-brand-primary focus-visible:outline-none"
    >
      <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
      Helpers
    </Link>
  )

  if (helperLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Helper Details" aboveTitle={backLink} />
        <main className="flex-1 overflow-y-auto bg-background px-8 py-6 space-y-6">
          <ListSkeleton rows={4} className="rounded-lg border border-border-subtle" />
        </main>
      </div>
    )
  }

  if (!helperData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Helper Details" aboveTitle={backLink} />
        <main className="flex-1 overflow-y-auto bg-background px-8 py-6 space-y-6">
          <div>Helper not found</div>
        </main>
      </div>
    )
  }

  const helper = {
    id: helperData.helper_id,
    name: helperData.user?.name || "Unknown",
    avatar: (helperData.user?.name || "U")[0].toUpperCase(),
    avatarColor: getAvatarColorHexForId(helperData.user_id ?? helperData.helper_id),
    category: helperData.category || "Community",
    isRemoved: !!helperData.deleted_at,
    discord: helperData.user?.username || "-",
    email: helperData.user?.email || "-",
    github: helperData.user?.username || "-",
    stats,
    tickets,
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Helper Details" aboveTitle={backLink} />

      <main className="flex-1 overflow-y-auto bg-background px-8 py-6 space-y-6">
        {/* Profile header + Contact information */}
        <Card className="border-0 py-0">
          <CardContent className="px-0 py-8 space-y-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 ${SQUIRCLE_RADIUS[48]} flex items-center justify-center text-[21px] font-medium text-foreground shrink-0`}
                style={{ backgroundColor: helper.avatarColor }}
              >
                {helper.avatar}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-base font-semibold text-foreground">{helper.name}</h1>
                <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-0 text-xs font-medium">
                  {helper.category.toLowerCase() === "core" ? "Core team" : helper.category}
                </Badge>
                {helper.isRemoved && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs font-medium">
                    Removed
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                <span className="text-sm text-foreground/80 truncate">{helper.discord}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                <span className="text-sm text-foreground/80 truncate">{helper.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <GithubIcon className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                <span className="text-sm text-brand-primary truncate">{helper.github}</span>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Key stats */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">Key stats</h2>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
            <Card className="h-28 py-0 justify-center animate-enter">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Number of tickets solved</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{helper.stats.ticketsSolved}</div>
              </CardContent>
            </Card>
            <Card className="h-28 py-0 justify-center animate-enter">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Total time spent</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{helper.stats.totalTime}</div>
              </CardContent>
            </Card>
            <Card className="h-28 py-0 justify-center animate-enter">
              <CardContent className="px-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Percentage solved</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-stat font-medium text-foreground tabular-nums">{helper.stats.percentageSolved}%</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* All tickets */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">All tickets</h2>
          <div className="bg-card rounded-lg border border-border overflow-x-auto">
            <ListHeader>
              <div className="grid gap-4 items-center" style={HELPER_TICKETS_GRID}>
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
                  <SortHeader label="Helper income (USD)" field="amount" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                </div>
                <div className="min-w-0">
                  <SortHeader label="Status" field="status" sortField={ticketsSort.field} sortDirection={ticketsSort.direction} onSort={(f) => cycleSort(f, ticketsSort.field, ticketsSort.direction, (field, direction) => setTicketsSort({ field, direction }))} />
                </div>
                <div />
              </div>
            </ListHeader>
            <div className="divide-y divide-border-subtle">
              {ticketsLoading ? (
                <ListSkeleton rows={5} />
              ) : helper.tickets.length === 0 ? (
                <EmptyState size="sm" title="No tickets for this period." />
              ) : (
                helper.tickets.map((ticket) => {
                  const count = ticket.transfers.length
                  const expanded = isExpanded(ticket.key)
                  const panelId = transactionsPanelId(ticket.key)
                  const ticketHref = ticket.id ? `/helper/tickets/${ticket.id}` : null
                  // Receipts per payout need each payout linked to its charge;
                  // older payouts aren't, so keep the per-ticket receipt list then.
                  const receiptsPerPayout = count > 1 && ticket.transfers.every((t) => !!t.payment_id)
                  return (
                    <div
                      key={ticket.key}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      aria-controls={expanded ? panelId : undefined}
                      aria-label={`Transactions for ticket ${ticket.shortId}`}
                      className={listRowClass({ interactive: true })}
                      onClick={() => toggle(ticket.key)}
                      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                        // Only when the row itself has focus, not a control inside it.
                        if (event.target !== event.currentTarget) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          toggle(ticket.key)
                        }
                      }}
                    >
                      <div className="grid gap-4 items-center" style={HELPER_TICKETS_GRID}>
                        <div className="flex items-center">
                          <Checkbox
                            checked={selectedRows.includes(ticket.key)}
                            onCheckedChange={() => handleRowSelect(ticket.key)}
                            onClick={stopRowNavigation}
                            aria-label={`Select ticket ${ticket.shortId}`}
                          />
                        </div>
                        <div className="min-w-0">
                          {ticketHref ? (
                            <Link
                              href={ticketHref}
                              onClick={stopRowNavigation}
                              className="text-sm font-medium text-brand-primary hover:underline font-mono tabular-nums"
                            >
                              {ticket.shortId}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-foreground">—</span>
                          )}
                          <div className="text-xs text-muted-foreground" title={ticket.title}>
                            {ticketPreview(ticket.title)}
                          </div>
                        </div>
                        <div className="min-w-0 text-sm text-muted-foreground">{ticket.dateIso ? formatDate(ticket.dateIso) : "—"}</div>
                        <div className="min-w-0 text-sm font-medium text-foreground whitespace-nowrap">
                          {ticket.amountRaw === null ? "—" : formatPaymentAmount(ticket.amountRaw, ticket.currency)}
                        </div>
                        <div className="min-w-0">
                          <Badge className={statusBadgeClass(ticket.status)}>{ticket.status}</Badge>
                        </div>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={KEBAB_BUTTON_CLASS}
                                aria-label={`More actions for ticket ${ticket.shortId}`}
                                onClick={stopRowNavigation}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            {/* Portalled, but React events still bubble to the row. */}
                            <DropdownMenuContent align="end" className="w-44" onClick={stopRowNavigation}>
                              {ticketHref ? (
                                <DropdownMenuItem asChild>
                                  <Link href={ticketHref}>
                                    <ExternalLink />
                                    Open
                                  </Link>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled>
                                  <ExternalLink />
                                  Open
                                </DropdownMenuItem>
                              )}
                              {/* Opens the same list as clicking the row; an already open list stays open. */}
                              <DropdownMenuItem
                                title={`Show the transactions on ticket ${ticket.shortId}`}
                                onSelect={() => {
                                  if (!expanded) toggle(ticket.key)
                                }}
                              >
                                <List />
                                See transactions
                              </DropdownMenuItem>
                              {receiptsPerPayout ? (
                                <DropdownMenuItem title="Each payout links to the receipt of the charge it came from" onSelect={() => toggle(ticket.key)}>
                                  <ExternalLink />
                                  Receipts
                                </DropdownMenuItem>
                              ) : ticket.receipts.length > 1 ? (
                                ticket.receipts.map((url, index) => (
                                  <ReceiptMenuItem key={`${index}-${url}`} url={url} label={`Receipt ${index + 1}`} />
                                ))
                              ) : (
                                <ReceiptMenuItem url={ticket.receipts[0] ?? null} />
                              )}
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
                            onToggle={() => toggle(ticket.key)}
                            panelId={panelId}
                            noun="payout"
                          />
                        </div>
                      )}
                      {expanded && (
                        <div className="cursor-default" onClick={stopRowNavigation}>
                          {/* The panel reaches 12px past the row's columns; border + line padding bring the lines back onto the same grid. */}
                          <TransactionsPanel id={panelId} className="-mx-3 overflow-x-visible">
                            {count === 0 && (
                              // Same grid as the payout lines so the text lines up under the ticket ID.
                              <div className="grid items-center gap-4 px-3 py-2 text-sm" style={HELPER_TICKETS_GRID}>
                                <span />
                                <span className="col-[2/-1] min-w-0 text-muted-foreground">No transactions for this ticket yet.</span>
                              </div>
                            )}
                            {ticket.transfers.map((transfer, index) => (
                              <div
                                key={transfer.id}
                                role="listitem"
                                className="grid items-center gap-4 px-3 py-2 text-sm"
                                style={HELPER_TICKETS_GRID}
                              >
                                <span />
                                <span className="min-w-0 text-xs text-muted-foreground tabular-nums" title={payoutReference(transfer)}>
                                  {index + 1} of {count}
                                </span>
                                <span className="min-w-0 text-muted-foreground tabular-nums">{formatDate(transferDate(transfer))}</span>
                                <span className="min-w-0 whitespace-nowrap text-foreground tabular-nums">
                                  {formatPaymentAmount(transfer.amount_smallest_unit, transfer.currency || ticket.currency)}
                                </span>
                                <span className="min-w-0">
                                  <Badge className={TRANSFER_STATUS_BADGE_CLASS[transfer.status]}>{TRANSFER_STATUS_LABEL[transfer.status]}</Badge>
                                </span>
                                {/* Wider than the kebab column: right-aligned, it extends left into the spacing before it. */}
                                <span className="flex items-center justify-end [&>*]:shrink-0">
                                  <ReceiptButton url={receiptForTransfer(transfer)} />
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
        </div>
      </main>

    </div>
  )
}
