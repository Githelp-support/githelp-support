"use client"

import { useState } from "react"
import { useUser } from "@/contexts/user-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NewTicketModal } from "@/components/modals/new-ticket-modal"
import { useUserTickets } from "@/hooks/useTicketsWithDetails"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import { MessageCircle, Plus } from "lucide-react"
import Link from "next/link"

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}.${month}.${year}, ${hours}:${minutes}`
}

export default function SupportTicketsPage() {
  const { user } = useUser()
  const isAuthenticated = !!user?.id
  const { data: tickets = [], isLoading } = useUserTickets(user?.id)
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9ff]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="My tickets"
          subtitle="View and manage your support requests"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isAuthenticated
                ? `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""}`
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
            <Card className="border-border mb-6">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Sign in to see all support tickets you have created and continue existing conversations.
                </p>
                <Button asChild variant="outline" className="mt-4 border-brand-primary text-brand-primary hover:bg-brand-primary/10">
                  <Link href={`/auth/signin?redirect=${encodeURIComponent("/support/tickets")}`}>
                    Sign in
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isAuthenticated && isLoading && (
            <div className="py-8 text-center text-muted-foreground">Loading your tickets...</div>
          )}

          {isAuthenticated && !isLoading && tickets.length === 0 && (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">You have not created any support tickets yet.</p>
                <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                  <Link href="/support/chat">
                    <Plus className="h-4 w-4" />
                    New ticket
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isAuthenticated && !isLoading && tickets.length > 0 && (
            <Card className="border-border py-0">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {tickets.map((ticket: any) => {
                    const chatHref = `/support/chat?ticket=${ticket.id}&project=${ticket.project_id}`
                    const projectName = ticket.project?.name ?? "Project"
                    const statusClass = getTicketStatusBadgeClass(ticket.status)
                    const statusLabel =
                      ticket.status === "in-progress"
                        ? "In progress"
                        : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)
                    return (
                      <Link
                        key={ticket.id}
                        href={chatHref}
                        className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground truncate">{ticket.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {projectName} · {formatDate(ticket.created_at)}
                          </p>
                          {ticket.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                              {ticket.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>{ticket.message_count ?? 0} messages</span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
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
