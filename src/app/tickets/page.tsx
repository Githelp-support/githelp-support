"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Clock, MessageCircle, User, Filter, ChevronUp, ChevronDown, ChevronsUpDown, Sparkles } from "lucide-react"
import { useTicketsWithDetails } from "@/hooks/useTicketsWithDetails"
import { useProjectPaymentSettings } from "@/hooks/useProject"
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets"
import { useProjectSelection } from "@/contexts/project-context"
import { getTicketStatusBadgeClass, getPriorityBadgeClass } from "@/lib/status-colors"
import { getAvatarColorHexForId } from "@/lib/constants"
import { SUPPORT_TICKET_PREVIEW_CARDS, SUPPORT_TICKETS_PREVIEW_DISCLAIMER } from "@/lib/helper-area-preview-copy"

interface Ticket {
  id: string
  title: string
  description: string
  user: {
    id: string | null
    name: string
    avatar: string
  }
  type: "Bug" | "Best practice" | "Dependency" | "Code review" | "Mentoring"
  topics: string[]
  status: "available" | "claimed" | "in-progress" | "completed"
  priority: "low" | "medium" | "high"
  createdAt: string
  estimatedTime?: string
  rate?: string
  messages?: number
  helper?: {
    name: string
    avatar: string
  }
}

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

  // Fetch tickets
  const { data: ticketsData, isLoading } = useTicketsWithDetails(projectId)

  // Fetch payment settings
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")

  // Set up real-time subscriptions
  useRealtimeTickets(projectId)

  // Format rate (convert cents to dollars)
  const ratePerMinute = paymentSettings?.ticket_price_minute_first_60 
    ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) 
    : "1.50"
  const startPrice = paymentSettings?.ticket_start_price
    ? (paymentSettings.ticket_start_price / 100).toFixed(2)
    : "10.00"
  const after60Price = paymentSettings?.ticket_price_minute_after_60
    ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2)
    : "1.00"

  // Transform tickets to UI format
  const tickets = useMemo(() => {
    if (!ticketsData) return []
    return ticketsData.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      user: {
        id: ticket.created_by ?? null,
        name: ticket.user?.name || "Unknown",
        avatar: (ticket.user?.name || "U")[0].toUpperCase(),
      },
      type: "Bug" as const, // TODO: Map from help categories
      topics: ticket.keywords?.map((k) => k.value) || [],
      status: ticket.status as "available" | "claimed" | "in-progress" | "completed",
      priority: ticket.priority as "low" | "medium" | "high",
      createdAt: formatDate(ticket.created_at),
      estimatedTime: "30-45 min", // TODO: Calculate from time entries
      rate: `USD ${ratePerMinute}/min`,
      messages: ticket.message_count || 0,
      helper: undefined as { name: string; avatar: string } | undefined, // TODO: Fetch helper data if ticket is claimed/in-progress
    })) as Ticket[]
  }, [ticketsData, ratePerMinute])

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
    const filtered = tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false
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

  const filteredTickets = getSortedTickets()

  const getStatusColor = (status: string) =>
    getTicketStatusBadgeClass(status)
  const getPriorityColor = (priority: string) =>
    getPriorityBadgeClass(priority)

  const getTicketStats = () => {
    const total = tickets.length
    const available = tickets.filter((t) => t.status === "available").length
    const inProgress = tickets.filter((t) => t.status === "in-progress").length
    const completed = tickets.filter((t) => t.status === "completed").length

    return { total, available, inProgress, completed }
  }

  const stats = getTicketStats()

  const togglePreviewCard = (id: string) => {
    setExpandedPreviewCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    )
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Tickets" subtitle="Manage and track support tickets" />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              aria-pressed={statusFilter === "all"}
              className="text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <Card className="relative overflow-hidden rounded-lg border-[#E1E1E1] py-0 shadow-none transition-colors hover:bg-muted/40">
                {statusFilter === "all" && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3C2EC5]" />
                )}
                <CardContent className="px-5 py-4">
                  <div className="text-xl font-bold text-foreground mb-1">{stats.total}</div>
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
              <Card className="relative overflow-hidden rounded-lg border-[#E1E1E1] py-0 shadow-none transition-colors hover:bg-muted/40">
                {statusFilter === "available" && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3C2EC5]" />
                )}
                <CardContent className="px-5 py-4">
                  <div className="text-xl font-bold text-foreground mb-1">{stats.available}</div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Available</span>
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
              <Card className="relative overflow-hidden rounded-lg border-[#E1E1E1] py-0 shadow-none transition-colors hover:bg-muted/40">
                {statusFilter === "in-progress" && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3C2EC5]" />
                )}
                <CardContent className="px-5 py-4">
                  <div className="text-xl font-bold text-foreground mb-1">{stats.inProgress}</div>
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
              <Card className="relative overflow-hidden rounded-lg border-[#E1E1E1] py-0 shadow-none transition-colors hover:bg-muted/40">
                {statusFilter === "completed" && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3C2EC5]" />
                )}
                <CardContent className="px-5 py-4">
                  <div className="text-xl font-bold text-foreground mb-1">{stats.completed}</div>
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Completed</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>

          {/* Preview disclaimer banner */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-muted/40 px-6 py-3">
            <p className="text-sm text-gray-600">{SUPPORT_TICKETS_PREVIEW_DISCLAIMER}</p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                size="sm"
                variant={statusFilter !== "all" ? "lavender" : "outline"}
                className="w-[140px] rounded-lg text-sm font-medium"
              >
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Status</SelectItem>
                <SelectItem value="available" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Available</SelectItem>
                <SelectItem value="claimed" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Claimed</SelectItem>
                <SelectItem value="in-progress" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">In Progress</SelectItem>
                <SelectItem value="completed" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                size="sm"
                variant={typeFilter !== "all" ? "lavender" : "outline"}
                className="w-[140px] rounded-lg text-sm font-medium"
              >
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Types</SelectItem>
                <SelectItem value="Bug" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Bug</SelectItem>
                <SelectItem value="Best practice" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Best practice</SelectItem>
                <SelectItem value="Dependency" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Dependency</SelectItem>
                <SelectItem value="Code review" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Code review</SelectItem>
                <SelectItem value="Mentoring" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Mentoring</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger
                size="sm"
                variant={priorityFilter !== "all" ? "lavender" : "outline"}
                className="w-[140px] rounded-lg text-sm font-medium"
              >
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">All Priority</SelectItem>
                <SelectItem value="high" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">High</SelectItem>
                <SelectItem value="medium" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Medium</SelectItem>
                <SelectItem value="low" className="text-[#737373] focus:text-accent-foreground focus:font-medium data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
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
              <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
              <div key={ticket.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f9f9f9]">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4">
                    <div className="flex items-start gap-[18px]">
                      <div
                        className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
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
                        <p className="text-sm text-muted-foreground">{ticket.title}</p>
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
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                        {ticket.status === "in-progress"
                          ? "In Progress"
                          : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </Badge>
                      {ticket.helper && (
                        <div className="w-5 h-5 rounded-[7px] flex items-center justify-center bg-brand-primary text-white text-xs font-medium shrink-0">
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
            ))
            ) : (
              <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No tickets found</div>
            )}
          </div>

          {/* Available Tickets */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Available Tickets</h2>
            <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                  <div className="col-span-10 flex items-center">
                    <span className="text-sm font-medium text-foreground">Ticket</span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-medium text-foreground">Created</span>
                  </div>
                </div>
              </div>
              {SUPPORT_TICKET_PREVIEW_CARDS.map((card) => {
                const isExpanded = expandedPreviewCards.includes(card.id)
                return (
                  <div
                    key={card.id}
                    role="presentation"
                    className="px-6 py-4 border-b border-border last:border-b-0 bg-gray-50/50"
                  >
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-10">
                        <div className="flex items-start gap-[18px]">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: getAvatarColorHexForId(card.id) }}
                          >
                            {card.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-medium text-foreground">{card.customer}</h4>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                Preview
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-foreground mt-0.5">{card.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{card.description}</p>

                            {isExpanded && (
                              <div className="mt-4 space-y-4">
                                {/* Other topics */}
                                <div>
                                  <h4 className="font-medium text-foreground mb-2">Other topics</h4>
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
                                  <h4 className="font-medium text-foreground mb-2">Type of help</h4>
                                  <div className="flex gap-2 flex-wrap">
                                    <Badge variant="secondary" className="bg-muted text-muted-foreground capitalize">
                                      {card.helpType}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Rates */}
                                <div>
                                  <h4 className="font-medium text-foreground mb-3">Rates</h4>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-card border border-border rounded-lg p-3">
                                      <p className="text-sm text-muted-foreground mb-1">Start price</p>
                                      <p className="font-medium text-foreground">USD {startPrice}</p>
                                    </div>
                                    <div className="bg-card border border-border rounded-lg p-3">
                                      <p className="text-sm text-muted-foreground mb-1">First 60 min</p>
                                      <p className="font-medium text-foreground">USD {ratePerMinute}/min</p>
                                    </div>
                                    <div className="bg-card border border-border rounded-lg p-3">
                                      <p className="text-sm text-muted-foreground mb-1">After 60 min</p>
                                      <p className="font-medium text-foreground">USD {after60Price}/min</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                  <Button variant="lavender" disabled>
                                    Claim ticket
                                  </Button>
                                  <Button
                                    variant="outline"
                                    disabled
                                    className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                                  >
                                    <Sparkles className="w-4 h-4" />
                                    Rephrase with AI
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePreviewCard(card.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Collapse ticket details" : "Expand ticket details"}
                            className="shrink-0 text-muted-foreground hover:text-brand-primary cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-muted-foreground">
                          <div>{card.timestamp.split(", ")[0]}</div>
                          <div className="text-xs text-muted-foreground">{card.timestamp.split(", ")[1]}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
