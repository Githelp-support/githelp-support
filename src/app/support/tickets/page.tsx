"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useUser } from "@/contexts/user-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NewTicketModal } from "@/components/modals/new-ticket-modal"
import { useUserTickets } from "@/hooks/useTicketsWithDetails"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import {
  MessageCircle,
  Plus,
  User,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react"

type TicketFilter = "in-progress" | "completed"
type SortField = "title" | "createdAt" | "status" | "type"
type SortDirection = "asc" | "desc"

type DisplayStatus = "Claimed" | "Unclaimed" | "Completed"

interface UITicket {
  id: string
  title: string
  description: string
  project: {
    name: string
    logoUrl: string | null
  }
  helper: {
    name: string
    avatarUrl: string | null
  } | null
  type: string
  status: "available" | "claimed" | "in-progress" | "completed"
  displayStatus: DisplayStatus
  createdAt: string
  messages: number
  projectId: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}.${month}.${year}, ${hours}:${minutes}`
}

function TicketsSortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField
  sortField: SortField | null
  sortDirection: SortDirection
}) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  )
}

export default function SupportTicketsPage() {
  const { user } = useUser()
  const isAuthenticated = !!user?.id
  const { data: ticketsData = [], isLoading } = useUserTickets(user?.id)
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TicketFilter>("in-progress")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const tickets = useMemo<UITicket[]>(() => {
    return (ticketsData as any[]).map((ticket) => {
      const firstCategory: string | undefined = ticket.help_categories?.[0]?.value
      const type = firstCategory
        ? firstCategory.charAt(0).toUpperCase() + firstCategory.slice(1)
        : "Support"
      const projectName: string =
        ticket.project_name || ticket.project?.name || "Project"
      const projectLogoUrl: string | null =
        ticket.project_logo_url ?? ticket.project?.logo_url ?? null
      const helper = ticket.helper
        ? {
            name: ticket.helper.name || "Helper",
            avatarUrl: ticket.helper.avatar_url ?? null,
          }
        : null
      const status = ticket.status as
        | "available"
        | "claimed"
        | "in-progress"
        | "completed"
      const displayStatus: DisplayStatus =
        status === "completed"
          ? "Completed"
          : helper
            ? "Claimed"
            : "Unclaimed"
      return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        project: {
          name: projectName,
          logoUrl: projectLogoUrl,
        },
        helper,
        type,
        status,
        displayStatus,
        createdAt: formatDate(ticket.created_at),
        messages: ticket.message_count || 0,
        projectId: ticket.project_id,
      }
    })
  }, [ticketsData])

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

  const stats = useMemo(() => {
    // "Active tickets" includes any ticket that has not been formally completed
    // (e.g. available, claimed, in-progress). Only "completed" is excluded.
    const inProgress = tickets.filter((t) => t.status !== "completed").length
    const completed = tickets.filter((t) => t.status === "completed").length
    return { inProgress, completed }
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) =>
      statusFilter === "in-progress"
        ? ticket.status !== "completed"
        : ticket.status === "completed"
    )

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
            aValue = new Date(
              a.createdAt.split(", ")[0].split(".").reverse().join("-")
            ).getTime()
            bValue = new Date(
              b.createdAt.split(", ")[0].split(".").reverse().join("-")
            ).getTime()
            break
          case "status":
            aValue = a.displayStatus
            bValue = b.displayStatus
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
  }, [tickets, statusFilter, sortField, sortDirection])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="My tickets"
          subtitle="View and manage your support requests"
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isAuthenticated
                ? `${filteredTickets.length} ticket${filteredTickets.length !== 1 ? "s" : ""}`
                : "Sign in to see your tickets"}
            </p>
            <Button
              onClick={() => setIsNewTicketModalOpen(true)}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              <Plus className="h-4 w-4" />
              New ticket
            </Button>
          </div>

          {!isAuthenticated && (
            <Card className="border-border">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Sign in to see all support tickets you have created and continue existing conversations.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                >
                  <Link href={`/auth/signin?redirect=${encodeURIComponent("/support/tickets")}`}>
                    Sign in
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isAuthenticated && (
            <>
              {/* Filter Cards */}
              <div className="grid grid-cols-2 gap-4 min-[1200px]:grid-cols-4">
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
                        <span className="text-xs text-muted-foreground">Active tickets</span>
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
                        <span className="text-xs text-muted-foreground">Completed tickets</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </div>

              {/* Loading / Empty / Table */}
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading your tickets...</div>
              ) : tickets.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      You have not created any support tickets yet.
                    </p>
                    <Button
                      onClick={() => setIsNewTicketModalOpen(true)}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                    >
                      <Plus className="h-4 w-4" />
                      New ticket
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-white rounded-lg border border-[#E1E1E1] overflow-hidden shadow-none">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                      <div className="col-span-5 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSort("title")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Ticket</span>
                          <TicketsSortIcon
                            field="title"
                            sortField={sortField}
                            sortDirection={sortDirection}
                          />
                        </button>
                      </div>
                      <div className="col-span-2 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSort("type")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Type</span>
                          <TicketsSortIcon
                            field="type"
                            sortField={sortField}
                            sortDirection={sortDirection}
                          />
                        </button>
                      </div>
                      <div className="col-span-2 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSort("status")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Status</span>
                          <TicketsSortIcon
                            field="status"
                            sortField={sortField}
                            sortDirection={sortDirection}
                          />
                        </button>
                      </div>
                      <div className="col-span-3 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSort("createdAt")}
                          className="flex items-center space-x-2 hover:text-brand-primary cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">Created</span>
                          <TicketsSortIcon
                            field="createdAt"
                            sortField={sortField}
                            sortDirection={sortDirection}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => {
                      const chatHref = `/support/chat?ticket=${ticket.id}&project=${ticket.projectId}`
                      return (
                        <Link
                          key={ticket.id}
                          href={chatHref}
                          className="block px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f9f9f9]"
                        >
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-5">
                              <div className="flex items-start gap-[18px]">
                                <Avatar
                                  key={`${ticket.project.logoUrl ?? ""}|${ticket.project.name}`}
                                  className="w-8 h-8 rounded-[11px] shrink-0"
                                >
                                  {ticket.project.logoUrl ? (
                                    <AvatarImage
                                      src={ticket.project.logoUrl}
                                      alt={ticket.project.name}
                                    />
                                  ) : null}
                                  <AvatarFallback className="bg-brand-primary text-white text-sm font-medium rounded-[11px]">
                                    {(ticket.project.name?.[0] || "?").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-foreground hover:text-brand-primary cursor-pointer truncate">
                                    {ticket.project.name}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">{ticket.title}</p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <MessageCircle className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {ticket.messages} messages
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-span-2">
                              <Badge
                                variant="secondary"
                                className="bg-muted text-muted-foreground text-xs"
                              >
                                {ticket.type}
                              </Badge>
                            </div>
                            <div className="col-span-2">
                              <Badge className={`text-xs ${getTicketStatusBadgeClass(ticket.displayStatus)}`}>
                                {ticket.displayStatus}
                              </Badge>
                            </div>
                            <div className="col-span-3">
                              <div className="text-sm text-muted-foreground">
                                <div>{ticket.createdAt.split(", ")[0]}</div>
                                <div className="text-xs text-muted-foreground">
                                  {ticket.createdAt.split(", ")[1]}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                      No tickets found
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
      />
    </div>
  )
}
