"use client"

import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Users, Plus, Sparkles } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import {
    SUPPORT_TICKET_PREVIEW_CARDS,
    SUPPORT_TICKETS_PREVIEW_DISCLAIMER,
} from "@/lib/helper-area-preview-copy"
import { useProjectSelection } from "@/contexts/project-context"
import { useTicketsWithDetails } from "@/hooks/useTicketsWithDetails"
import { useProjectPaymentSettings } from "@/hooks/useProject"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useTimeEntries } from "@/hooks/useTimeEntries"
import { useMyParticipatingTicketIds } from "@/hooks/useTicketParticipants"

function formatTimestamp(createdAt: string) {
  const d = new Date(createdAt)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${day}.${month}.${year}, ${hours}:${minutes}`
}

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes}min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export default function HelperSupportPage() {
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: ticketsData, isLoading: ticketsLoading } = useTicketsWithDetails(projectId)
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")
  const { data: helperId } = useCurrentHelper(projectId)
  const today = new Date().toISOString().slice(0, 10)
  const { data: timeEntries } = useTimeEntries({
    helperId: helperId ?? undefined,
    projectId: projectId ?? undefined,
    startDate: today,
    endDate: today,
  })
  const { data: participatingIds = new Set<string>() } = useMyParticipatingTicketIds(projectId)

  const todayMinutes = useMemo(() => {
    if (!timeEntries) return 0
    return timeEntries.reduce((sum, e) => sum + (e.time_milliseconds || 0), 0)
  }, [timeEntries])

  const { availableTickets, activeTickets } = useMemo(() => {
    if (!ticketsData) return { availableTickets: [], activeTickets: [] }
    const available = ticketsData.filter((t) => t.status === "available")
    const active = ticketsData.filter(
      (t) =>
        (t.status === "claimed" || t.status === "in-progress") &&
        participatingIds.has(t.id)
    )
    return { availableTickets: available, activeTickets: active }
  }, [ticketsData, participatingIds])

  const rates = useMemo(() => {
    if (!paymentSettings) return null
    const start = paymentSettings.ticket_start_price != null ? (paymentSettings.ticket_start_price / 100).toFixed(2) : "10.00"
    const first60 = paymentSettings.ticket_price_minute_first_60 != null ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) : "1.50"
    const after60 = paymentSettings.ticket_price_minute_after_60 != null ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2) : "1.00"
    return {
      startPrice: `USD ${start}`,
      first60: `USD ${first60}/min`,
      after60: `USD ${after60}/min`,
    }
  }, [paymentSettings])

  const formattedAvailable = useMemo(
    () =>
      availableTickets.map((t) => ({
        id: t.id,
        title: t.title,
        customer: t.user?.name ?? "Customer",
        avatar: (t.user?.name ?? "C")[0].toUpperCase(),
        description: t.description ?? "",
        topics: [
          ...(t.help_categories?.map((c) => c.value) ?? []),
          ...(t.keywords?.map((k) => k.value).filter(Boolean) ?? []),
        ],
        helpType: t.help_categories?.[0]?.type ?? "default",
        rates: rates ?? { startPrice: "USD 10.00", first60: "USD 1.50/min", after60: "USD 1.00/min" },
        timestamp: formatTimestamp(t.created_at),
      })),
    [availableTickets, rates]
  )

  const formattedActive = useMemo(
    () =>
      activeTickets.map((t) => ({
        id: t.id,
        title: t.title,
        customer: t.user?.name ?? "Customer",
        avatar: (t.user?.name ?? "C")[0].toUpperCase(),
        status: t.status === "in-progress" ? "In Progress" : "Waiting for response",
      })),
    [activeTickets]
  )

  const todayFormatted = formatDuration(todayMinutes)

  const showSupportTicketPreview =
    !!projectId &&
    !ticketsLoading &&
    availableTickets.length === 0 &&
    activeTickets.length === 0

  const previewRates = rates ?? {
    startPrice: "USD 10.00",
    first60: "USD 1.50/min",
    after60: "USD 1.00/min",
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Support Dashboard" />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl space-y-6">
            {!projectId ? (
              <p className="text-muted-foreground">Select a project to see tickets and stats.</p>
            ) : ticketsLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Today&apos;s logged time</p>
                          <p className="text-xl font-semibold text-foreground">{todayFormatted}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Active tickets</p>
                          <p className="text-xl font-semibold text-foreground">{formattedActive.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                          <Plus className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Available tickets</p>
                          <p className="text-xl font-semibold text-foreground">{formattedAvailable.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Available Tickets */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Available Tickets</h2>
                  {formattedAvailable.length === 0 && showSupportTicketPreview ? (
                    <div className="space-y-4">
                      <p
                        role="status"
                        className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3"
                      >
                        {SUPPORT_TICKETS_PREVIEW_DISCLAIMER}
                      </p>
                      {SUPPORT_TICKET_PREVIEW_CARDS.map((ticket) => (
                        <Card
                          key={ticket.id}
                          className="border border-dashed border-border opacity-95"
                          role="presentation"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-[#d9dce8] text-foreground">{ticket.avatar}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-4">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h3 className="font-medium text-foreground">{ticket.title}</h3>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                      Preview
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">• {ticket.timestamp}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">{ticket.description}</p>

                                  <div className="space-y-3">
                                    {ticket.topics.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium text-foreground mb-1">Other topics</p>
                                        <div className="flex gap-2 flex-wrap">
                                          {ticket.topics.map((topic) => (
                                            <Badge key={topic} variant="secondary" className="bg-muted text-muted-foreground">
                                              {topic}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div>
                                      <p className="text-sm font-medium text-foreground mb-1">Type of help</p>
                                      <Badge variant="secondary" className="bg-muted text-muted-foreground capitalize">
                                        {ticket.helpType}
                                      </Badge>
                                    </div>

                                    <div>
                                      <p className="text-sm font-medium text-foreground mb-2">Rates</p>
                                      <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <p className="text-muted-foreground">Start price</p>
                                          <p className="font-medium text-foreground">{previewRates.startPrice}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">First 60 min</p>
                                          <p className="font-medium text-foreground">{previewRates.first60}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">After 60 min</p>
                                          <p className="font-medium text-foreground">{previewRates.after60}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-3">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="cursor-default"
                                    onClick={() => toast.info("Preview only — this is not a real ticket.")}
                                  >
                                    Claim ticket
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-brand-primary text-brand-primary cursor-default"
                                    onClick={() => toast.info("Preview only — this is not a real ticket.")}
                                  >
                                    <Sparkles className="w-4 h-4" />
                                    Rephrase with AI
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : formattedAvailable.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available tickets right now.</p>
                  ) : (
                    formattedAvailable.map((ticket) => (
                      <Card key={ticket.id} className="border border-border">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-[#d9dce8] text-foreground">{ticket.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-medium text-foreground">{ticket.title}</h3>
                                  <span className="text-sm text-muted-foreground">• {ticket.timestamp}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">{ticket.description || "—"}</p>

                                <div className="space-y-3">
                                  {ticket.topics.length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium text-foreground mb-1">Other topics</p>
                                      <div className="flex gap-2 flex-wrap">
                                        {ticket.topics.map((topic) => (
                                          <Badge key={topic} variant="secondary" className="bg-muted text-muted-foreground">
                                            {topic}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <p className="text-sm font-medium text-foreground mb-1">Type of help</p>
                                    <Badge variant="secondary" className="bg-muted text-muted-foreground capitalize">
                                      {ticket.helpType}
                                    </Badge>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium text-foreground mb-2">Rates</p>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <p className="text-muted-foreground">Start price</p>
                                        <p className="font-medium text-foreground">{ticket.rates.startPrice}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">First 60 min</p>
                                        <p className="font-medium text-foreground">{ticket.rates.first60}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">After 60 min</p>
                                        <p className="font-medium text-foreground">{ticket.rates.after60}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                                  <Link href={`/helper/tickets/${ticket.id}`}>Claim ticket</Link>
                                </Button>
                                <Button
                                  asChild
                                  variant="outline"
                                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent cursor-pointer"
                                >
                                  <Link href={`/helper/tickets/${ticket.id}`}>
                                    <Sparkles className="w-4 h-4" />
                                    Rephrase with AI
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Active Tickets */}
                {formattedActive.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Active Tickets</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formattedActive.map((ticket) => (
                        <Card key={ticket.id} className="border border-border">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-[#d9dce8] text-foreground">{ticket.avatar}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground mb-1 truncate">{ticket.title}</h4>
                                <p className="text-sm text-muted-foreground mb-2">{ticket.customer}</p>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm text-muted-foreground shrink-0">—</span>
                                  <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary shrink-0">
                                    {ticket.status}
                                  </Badge>
                                </div>
                              </div>
                              <Button asChild variant="ghost" size="sm">
                                <Link href={`/helper/tickets/${ticket.id}`}>Open</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
