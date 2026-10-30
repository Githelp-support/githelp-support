"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Header } from "@/components/layout/header"
import { Clock, MessageCircle, User, ChevronUp, ChevronDown, ChevronsUpDown, Sparkles } from "lucide-react"
import { useTicketsWithDetails } from "@/hooks/useTicketsWithDetails"
import { GuestTicketBadge, ticketCreatorDisplayName } from "@/components/ticket-chat/guest-ticket"
import { useProjectPaymentSettings } from "@/hooks/useProject"
import { formatTicketRates, RATES_NOT_CONFIGURED } from "@/lib/ticket-pricing"
import { truncateText } from "@/lib/format"
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets"
import { useMyParticipatingTicketIds, useOtherHelperParticipatingTicketIds } from "@/hooks/useTicketParticipants"
import { useProjectSelection } from "@/contexts/project-context"
import { useUser } from "@/contexts/user-context"
import { getTicketStatusBadgeClass, getPriorityBadgeClass } from "@/lib/status-colors"
import { getAvatarColorHexForId, ILLUSTRATIVE_BUTTON_TOOLTIP, SQUIRCLE_RADIUS } from "@/lib/constants"
import { SUPPORT_TICKET_PREVIEW_CARDS, SUPPORT_TICKETS_PREVIEW_DISCLAIMER } from "@/lib/helper-area-preview-copy"
import { EmptyState } from "@/components/ui/empty-state"
import { ListSkeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

interface Ticket {
  id: string
  title: string
  description: string
  user: {
    id: string | null
    name: string
    avatar: string
  }
  /** Name of the ticket's first help category, or GENERAL_TYPE when it has none. */
  type: string
  topics: string[]
  status: "available" | "claimed" | "in-progress" | "completed"
  priority: "low" | "medium" | "high"
  createdAt: string
  messages?: number
  /** Opened by a visitor who hasn't signed in yet. */
  guest?: boolean
  helper?: {
    name: string
    avatar: string
  }
}

/** Type label for tickets without a help category. */
const GENERAL_TYPE = "General"

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year}, ${hours}:${minutes}`
}

type SortField = "title" | "createdAt" | "priority" | "status" | "type"
type SortDirection = "asc" | "desc"

function TicketsSortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [expandedPreviewCards, setExpandedPreviewCards] = useState<string[]>([])

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Current user / role — helpers should only see claimed/in-progress/completed
  // tickets where they are a participant.
  const { user } = useUser()
  const isHelper = user.role === "helper"

  // Fetch tickets
  const { data: ticketsData, isLoading, isError, refetch } = useTicketsWithDetails(projectId)

  // Ticket IDs in this project where the current auth user has a
  // tickets_participants row (covers both 'claimed' and 'invited' cases).
  const { data: participatingTicketIds } = useMyParticipatingTicketIds(projectId)

  // Ticket IDs taken by ANOTHER helper (claimed or participating in the chat).
  // Used to decide whether an "available" ticket is still genuinely Unclaimed.
  const { data: otherHelperTicketIds } = useOtherHelperParticipatingTicketIds(projectId)

  // Fetch payment settings
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")

  // Set up real-time subscriptions
  useRealtimeTickets(projectId)

  // Format rates (convert cents to dollars); null until the project has
  // payment settings — the expanded rows then say "Rates not configured".
  const rates = formatTicketRates(paymentSettings)

  // Transform tickets to UI format
  const tickets = useMemo(() => {
    if (!ticketsData) return []
    return ticketsData.map((ticket) => {
      const firstCategory = ticket.help_categories?.find((c) => !!c.value)
      return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        user: {
          id: ticket.created_by ?? null,
          name: ticketCreatorDisplayName(ticket.user?.name, !!ticket.guest, "Unknown"),
          avatar: ticketCreatorDisplayName(ticket.user?.name, !!ticket.guest, "U")[0].toUpperCase(),
        },
        guest: !!ticket.guest,
        // Type = the ticket's first help category (projects_help_categories.value).
        type: firstCategory?.value || GENERAL_TYPE,
        topics: ticket.keywords?.map((k) => k.value) || [],
        status: ticket.status as "available" | "claimed" | "in-progress" | "completed",
        priority: ticket.priority as "low" | "medium" | "high",
        createdAt: formatDate(ticket.created_at),
        messages: ticket.message_count || 0,
        helper: undefined as { name: string; avatar: string } | undefined, // TODO: Fetch helper data if ticket is claimed/in-progress
      }
    }) as Ticket[]
  }, [ticketsData])

  // Type filter options = the types that actually occur in this project's tickets.
  const typeOptions = useMemo(
    () => [...new Set(tickets.map((t) => t.type))].sort((a, b) => a.localeCompare(b)),
    [tickets],
  )

  // For helpers, scope claimed/in-progress/completed tickets to the ones they
  // participate in. Available tickets remain unfiltered so helpers can still
  // pick up new work. Admins and end-users see the full list.
  const visibleTickets = useMemo(() => {
    if (!isHelper) return tickets
    return tickets.filter((t) => {
      if (t.status === "available") return true
      return participatingTicketIds?.has(t.id) ?? false
    })
  }, [tickets, isHelper, participatingTicketIds])

  // A ticket is "Unclaimed" only when it is available AND no other helper has
  // claimed it or joined its chat as a participant.
  const isUnclaimed = (ticket: Ticket) =>
    ticket.status === "available" && !(otherHelperTicketIds?.has(ticket.id) ?? false)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortField(null)
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortedTickets = () => {
    const filtered = visibleTickets.filter((ticket) => {
      if (statusFilter !== "all") {
        if (statusFilter === "available") {
          // "Unclaimed" filter — apply the same eligibility used for the table
          // rows and the stat container so they always agree.
          if (!isUnclaimed(ticket)) return false
        } else if (statusFilter === "in-progress") {
          // "Claimed" and "In progress" are merged into a single In Progress group.
          if (ticket.status !== "in-progress" && ticket.status !== "claimed") return false
        } else if (ticket.status !== statusFilter) {
          return false
        }
      }
      if (typeFilter !== "all" && ticket.type !== typeFilter) return false
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false
      return true
    })

    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        switch (sortField) {
          case "title":
            aValue = a.title.toLowerCase()
            bValue = b.title.toLowerCase()
            break
          case "createdAt":
            aValue = new Date(a.createdAt.split(", ")[0].split(".").reverse().join("-")).getTime()
            bValue = new Date(b.createdAt.split(", ")[0].split(".").reverse().join("-")).getTime()
            break
          case "priority":
            const priorityOrder = { low: 1, medium: 2, high: 3 }
            aValue = priorityOrder[a.priority]
            bValue = priorityOrder[b.priority]
            break
          case "status":
            aValue = a.status
            bValue = b.status
            break
          case "type":
            aValue = a.type
            bValue = b.type
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }

  const getSortedPreviewCards = () => {
    const cards = [...SUPPORT_TICKET_PREVIEW_CARDS]
    if (sortField === "title" || sortField === "createdAt") {
      cards.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number
        if (sortField === "title") {
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
        } else {
          aValue = new Date(a.timestamp.split(", ")[0].split(".").reverse().join("-")).getTime()
          bValue = new Date(b.timestamp.split(", ")[0].split(".").reverse().join("-")).getTime()
        }
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }
    return cards
  }

  const filteredTickets = getSortedTickets()
  const sortedPreviewCards = getSortedPreviewCards()
  /** Show the preview disclaimer only when the project has no real tickets yet (mirrors the Reports page payout preview behavior). */
  const showTicketsPreview = !!projectId && !isLoading && tickets.length === 0
  /** Only render the preview cards when there are no real tickets yet. When real tickets exist, the "Available" filter must show actual available tickets so the table and the "Available" stat container agree. */
  const showAvailablePreviewCards = statusFilter === "available" && showTicketsPreview
  const visibleTicketCount =
    showAvailablePreviewCards ? sortedPreviewCards.length : filteredTickets.length

  const getStatusColor = (status: string) =>
    getTicketStatusBadgeClass(status)
  const getPriorityColor = (priority: string) =>
    getPriorityBadgeClass(priority)
  // Map the underlying status value to its display label: "available" reads as
  // "Unclaimed", and "claimed"/"in-progress" are merged into "In Progress".
  const getStatusLabel = (status: string) =>
    status === "available"
      ? "Unclaimed"
      : status === "in-progress" || status === "claimed"
        ? "In Progress"
        : status.charAt(0).toUpperCase() + status.slice(1)

  const getTicketStats = () => {
    const total = visibleTickets.length
    // When showing preview cards (no real tickets yet), the "Unclaimed" stat should reflect
    // the preview cards rendered in the table — otherwise the container reads 0 while 3 preview
    // tickets are visible. Otherwise apply the SAME unclaimed-eligibility filter used for the
    // table rows so the stat count and the rows below it always agree.
    const available = showTicketsPreview
      ? SUPPORT_TICKET_PREVIEW_CARDS.length
      : visibleTickets.filter(isUnclaimed).length
    // "Claimed" and "In progress" tickets are merged into a single In Progress group.
    const inProgress = visibleTickets.filter(
      (t) => t.status === "in-progress" || t.status === "claimed"
    ).length
    const completed = visibleTickets.filter((t) => t.status === "completed").length

    return { total, available, inProgress, completed }
  }

  const stats = getTicketStats()

  const togglePreviewCard = (id: string) => {
    setExpandedPreviewCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Tickets" subtitle="Manage and track support tickets" />

      <main className="flex-1 px-8 py-6 space-y-6 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className="text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Card className="relative overflow-hidden rounded-lg border-border-subtle py-0 shadow-none transition-colors hover:bg-muted/40">
              {statusFilter === "all" && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-primary" />
              )}
              <CardContent className="px-5 py-4">
                <div className="text-xl font-semibold text-foreground mb-1">{stats.total}</div>
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Tickets</span>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("available")}
            aria-pressed={statusFilter === "available"}
            className="text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Card className="relative overflow-hidden rounded-lg border-border-subtle py-0 shadow-none transition-colors hover:bg-muted/40">
              {statusFilter === "available" && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-primary" />
              )}
              <CardContent className="px-5 py-4">
                <div className="text-xl font-semibold text-foreground mb-1">{stats.available}</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Unclaimed</span>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("in-progress")}
            aria-pressed={statusFilter === "in-progress"}
            className="text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Card className="relative overflow-hidden rounded-lg border-border-subtle py-0 shadow-none transition-colors hover:bg-muted/40">
              {statusFilter === "in-progress" && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-primary" />
              )}
              <CardContent className="px-5 py-4">
                <div className="text-xl font-semibold text-foreground mb-1">{stats.inProgress}</div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">In Progress</span>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            aria-pressed={statusFilter === "completed"}
            className="text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Card className="relative overflow-hidden rounded-lg border-border-subtle py-0 shadow-none transition-colors hover:bg-muted/40">
              {statusFilter === "completed" && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-primary" />
              )}
              <CardContent className="px-5 py-4">
                <div className="text-xl font-semibold text-foreground mb-1">{stats.completed}</div>
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>

        {/* Preview disclaimer banner */}
        {showTicketsPreview && (
          <div className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-text-muted">{SUPPORT_TICKETS_PREVIEW_DISCLAIMER}</div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              size="sm"
              variant={statusFilter !== "all" ? "neutral" : "outline"}
              className="w-[140px] rounded-lg text-sm font-medium"
            >
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Statuses</SelectItem>
              <SelectItem value="available" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Unclaimed</SelectItem>
              <SelectItem value="in-progress" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">In Progress</SelectItem>
              <SelectItem value="completed" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              size="sm"
              variant={typeFilter !== "all" ? "neutral" : "outline"}
              className="w-[140px] rounded-lg text-sm font-medium"
            >
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Types</SelectItem>
              {typeOptions.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium"
                >
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger
              size="sm"
              variant={priorityFilter !== "all" ? "neutral" : "outline"}
              className="w-[140px] rounded-lg text-sm font-medium"
            >
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Priority</SelectItem>
              <SelectItem value="high" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">High</SelectItem>
              <SelectItem value="medium" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Medium</SelectItem>
              <SelectItem value="low" className="text-muted-foreground focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto text-sm text-muted-foreground">
            {visibleTicketCount} ticket{visibleTicketCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-card rounded-lg border border-border-subtle overflow-hidden shadow-none">
          {showAvailablePreviewCards ? (
          <>
            <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                <div className="col-span-9 flex items-center space-x-2">
                  <button type="button"
                    onClick={() => handleSort("title")}
                    className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                  >
                    <span className="text-sm font-medium text-foreground">Ticket</span>
                    <TicketsSortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <button type="button"
                    onClick={() => handleSort("createdAt")}
                    className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                  >
                    <span className="text-sm font-medium text-foreground">Created</span>
                    <TicketsSortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </div>
                <div className="col-span-1" aria-hidden="true" />
              </div>
            </div>
            {sortedPreviewCards.map((card) => {
              const isExpanded = expandedPreviewCards.includes(card.id)
              return (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePreviewCard(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      togglePreviewCard(card.id)
                    }
                  }}
                  aria-expanded={isExpanded}
                  className="px-6 py-4 border-b border-border last:border-b-0 bg-bg-subtle/50 cursor-pointer hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
                >
                  <div className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-9">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} flex items-center justify-center text-sm font-medium text-foreground shrink-0`}
                          style={{ backgroundColor: getAvatarColorHexForId(card.id) }}
                        >
                          {card.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium text-foreground">{card.customer}</h4>
                            <Badge variant="outline" className="text-xs uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-0.5">{card.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 truncate">{card.description}</p>

                          {isExpanded && (
                            <div className="mt-4 space-y-4">
                              {/* Other topics */}
                              <div>
                                <h4 className="text-ui font-semibold text-foreground mb-2">Other topics</h4>
                                <div className="flex gap-2 flex-wrap">
                                  {card.topics.map((topic) => (
                                    <Badge key={topic} variant="secondary" className="bg-muted text-muted-foreground">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {/* Type of help */}
                              <div>
                                <h4 className="text-ui font-semibold text-foreground mb-2">Type of help</h4>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="secondary" className="bg-muted text-muted-foreground capitalize">
                                    {card.helpType}
                                  </Badge>
                                </div>
                              </div>

                              {/* Rates */}
                              <div>
                                <h4 className="text-ui font-semibold text-foreground mb-3">Rates</h4>
                                {rates == null ? (
                                  <p className="text-sm text-muted-foreground">{RATES_NOT_CONFIGURED}</p>
                                ) : (
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-card border border-border rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground mb-1">Start price</p>
                                    <p className="text-sm font-medium text-foreground">USD {rates.startPrice}</p>
                                  </div>
                                  <div className="bg-card border border-border rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
                                    <p className="text-sm font-medium text-foreground">USD {rates.first60Price}/min</p>
                                  </div>
                                  <div className="bg-card border border-border rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
                                    <p className="text-sm font-medium text-foreground">USD {rates.after60Price}/min</p>
                                  </div>
                                </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-3">
                                <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                                  <Button variant="lavender" disabled>
                                    Claim ticket
                                  </Button>
                                </span>
                                <span title={ILLUSTRATIVE_BUTTON_TOOLTIP} className="inline-flex">
                                  <Button
                                    variant="outline"
                                    disabled
                                    className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                                  >
                                    <Sparkles className="w-4 h-4" />
                                    Rephrase with AI
                                  </Button>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">
                        <div>{card.timestamp.split(", ")[0]}</div>
                        <div className="text-xs text-muted-foreground">{card.timestamp.split(", ")[1]}</div>
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
          ) : (
          <>
          <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
              <div className="col-span-4 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("title")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Ticket</span>
                  <TicketsSortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("type")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Type</span>
                  <TicketsSortIcon field="type" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("priority")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Priority</span>
                  <TicketsSortIcon field="priority" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("status")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <TicketsSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button type="button"
                  onClick={() => handleSort("createdAt")}
                  className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">Created</span>
                  <TicketsSortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                </button>
              </div>
            </div>
          </div>
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : isError ? (
            <ErrorState size="sm" onRetry={() => refetch()} />
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              // Unclaimed tickets reuse the expandable gray-row layout from the
              // "Preview" cards, driven by real ticket data. Type and Status
              // columns are visible, and expanding reveals the full question.
              if (isUnclaimed(ticket)) {
                const isExpanded = expandedPreviewCards.includes(ticket.id)
                return (
                  <div
                    key={ticket.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => togglePreviewCard(ticket.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        togglePreviewCard(ticket.id)
                      }
                    }}
                    aria-expanded={isExpanded}
                    className="px-6 py-4 border-b border-border last:border-b-0 bg-bg-subtle/50 cursor-pointer hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
                  >
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} flex items-center justify-center text-sm font-medium text-foreground shrink-0`}
                            style={{ backgroundColor: getAvatarColorHexForId(ticket.user.id ?? ticket.user.name) }}
                          >
                            {ticket.user.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-foreground truncate">
                              {ticket.user.name}
                            </h4>
                            {ticket.guest && <GuestTicketBadge className="mt-1" />}
                            <p className="text-xs text-muted-foreground">{truncateText(ticket.title)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <MessageCircle className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{ticket.messages} messages</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                          {ticket.type}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                      <div className="col-span-2 flex items-start justify-between gap-2">
                        <div className="text-sm text-muted-foreground">
                          <div>{ticket.createdAt.split(", ")[0]}</div>
                          <div className="text-xs text-muted-foreground">{ticket.createdAt.split(", ")[1]}</div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 pl-12 space-y-4">
                        {/* Full question asked */}
                        <div>
                          <h4 className="text-ui font-semibold text-foreground mb-2">Question asked</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                        </div>

                        {/* Rates associated with the ticket */}
                        <div>
                          <h4 className="text-ui font-semibold text-foreground mb-3">Rates</h4>
                          {rates == null ? (
                            <p className="text-sm text-muted-foreground">{RATES_NOT_CONFIGURED}</p>
                          ) : (
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-card border border-border rounded-lg p-3">
                              <p className="text-sm text-muted-foreground mb-1">Start price</p>
                              <p className="text-sm font-medium text-foreground">USD {rates.startPrice}</p>
                            </div>
                            <div className="bg-card border border-border rounded-lg p-3">
                              <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
                              <p className="text-sm font-medium text-foreground">USD {rates.first60Price}/min</p>
                            </div>
                            <div className="bg-card border border-border rounded-lg p-3">
                              <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
                              <p className="text-sm font-medium text-foreground">USD {rates.after60Price}/min</p>
                            </div>
                          </div>
                          )}
                        </div>

                        {/* Access the full ticket in addition to the inline expansion */}
                        <div>
                          <Link
                            href={`/helper/tickets/${ticket.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="lavender">Open ticket</Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              return (
            <div key={ticket.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-surface-hover">
              <div className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-8 h-8 ${SQUIRCLE_RADIUS[32]} flex items-center justify-center text-sm font-medium text-foreground shrink-0`}
                      style={{ backgroundColor: getAvatarColorHexForId(ticket.user.id ?? ticket.user.name) }}
                    >
                      {ticket.user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/helper/tickets/${ticket.id}`}>
                        <h4 className="text-sm font-medium text-foreground hover:text-brand-primary cursor-pointer truncate">
                          {ticket.user.name}
                        </h4>
                      </Link>
                      {ticket.guest && <GuestTicketBadge className="mt-1" />}
                      <p className="text-xs text-muted-foreground">{truncateText(ticket.title)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <MessageCircle className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{ticket.messages} messages</span>
                        </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                    {ticket.type}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <div className="flex items-start gap-2">
                    <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </Badge>
                    {ticket.helper && (
                      <div className={`w-5 h-5 ${SQUIRCLE_RADIUS[20]} flex items-center justify-center bg-brand-primary text-brand-foreground text-xs font-medium shrink-0`}>
                        {ticket.helper.avatar}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">
                    <div>{ticket.createdAt.split(", ")[0]}</div>
                    <div className="text-xs text-muted-foreground">{ticket.createdAt.split(", ")[1]}</div>
                  </div>
                </div>
              </div>
            </div>
              )
            })
          ) : (
            <EmptyState size="sm" title="No tickets found" />
          )}
          </>
          )}
        </div>

      </main>
    </div>
  )
}
