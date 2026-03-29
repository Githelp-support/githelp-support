"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MessageCircle, Filter, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react"
import { useTicketsWithDetails } from "@/hooks/useTicketsWithDetails"
import { useProjectPaymentSettings } from "@/hooks/useProject"
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets"
import { useProjectSelection } from "@/contexts/project-context"
import { getTicketStatusBadgeClass, getPriorityBadgeClass } from "@/lib/status-colors"

interface Ticket {
  id: string
  title: string
  description: string
  user: {
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
    return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
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

  // Transform tickets to UI format
  const tickets = useMemo(() => {
    if (!ticketsData) return []
    return ticketsData.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      user: {
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

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Tickets" subtitle="Manage and track support tickets" />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Stats Cards */}
          <div className="flex gap-5 max-w-fit">
            <Card className="border-border/60 min-w-[200px] rounded-lg py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-muted-foreground">Total Tickets</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 min-w-[200px] rounded-lg py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stats.available}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 min-w-[200px] rounded-lg py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stats.inProgress}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 min-w-[200px] rounded-lg py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stats.completed}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Bug">Bug</SelectItem>
                <SelectItem value="Best practice">Best practice</SelectItem>
                <SelectItem value="Dependency">Dependency</SelectItem>
                <SelectItem value="Code review">Code review</SelectItem>
                <SelectItem value="Mentoring">Mentoring</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Tickets Table */}
          <Card className="border-border py-0">
            <CardContent className="p-0">
              <div className="bg-brand-primary/10 px-6 py-4 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
                  <div className="col-span-4">
                    <button type="button"
                      onClick={() => handleSort("title")}
                      className="flex items-center gap-2 hover:text-brand-primary cursor-pointer"
                    >
                      Ticket
                      <TicketsSortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button"
                      onClick={() => handleSort("type")}
                      className="flex items-center gap-2 hover:text-brand-primary cursor-pointer"
                    >
                      Type
                      <TicketsSortIcon field="type" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button"
                      onClick={() => handleSort("priority")}
                      className="flex items-center gap-2 hover:text-brand-primary cursor-pointer"
                    >
                      Priority
                      <TicketsSortIcon field="priority" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button"
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-2 hover:text-brand-primary cursor-pointer"
                    >
                      Status
                      <TicketsSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button"
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center gap-2 hover:text-brand-primary cursor-pointer"
                    >
                      Created
                      <TicketsSortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                </div>
              </div>
              {isLoading ? (
                <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((ticket, index) => (
                <div key={ticket.id} className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f9f9f9]">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#f4bccc] text-foreground text-sm">
                            {ticket.user.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link href={`/helper/tickets/${ticket.id}`}>
                            <h4 className="font-medium text-foreground hover:text-brand-primary cursor-pointer truncate">
                              {ticket.title}
                            </h4>
                          </Link>
                          <p className="text-sm text-muted-foreground">{ticket.user.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{ticket.description}</p>
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
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="bg-brand-primary text-white text-xs">
                              {ticket.helper.avatar}
                            </AvatarFallback>
                          </Avatar>
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
                <div className="px-6 py-8 text-center text-muted-foreground">No tickets found</div>
              )}
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  )
}
