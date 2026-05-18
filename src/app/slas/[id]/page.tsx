"use client"

import { useState, use, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Info, Copy, Edit, ExternalLink, Download } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useSLA } from "@/hooks/useSLAs"
import { supabase } from "@/lib/supabase/client"
import { getAvatarColorHexForId } from "@/lib/constants"

// ---- Helpers ----------------------------------------------------------------

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function formatMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function centsToDisplay(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—"
  const amount = cents / 100
  return `${currency} ${amount.toFixed(2)}`
}

function getInitial(name: string | null | undefined): string {
  return name ? name.charAt(0).toUpperCase() : "?"
}

// Shared avatar palette hashed by stable identity, so a helper has the
// same color on this page as on /helpers, /tickets, /reports etc.
const avatarColor = (str: string | null | undefined): string => getAvatarColorHexForId(str)

// ---- Derived-data types -----------------------------------------------------

interface TicketRow {
  id: string
  created_at: string
  status: string
  sla_id: string | null
  tickets_time_entries: { time_milliseconds: number; helper_id: string }[]
  tickets_participants: { participant_id: string; claimed: boolean }[]
}

interface HelperPublic {
  helper_id: string
  user: { name: string } | null
}

// ---- Page -------------------------------------------------------------------

export default function SLADetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [timePeriod, setTimePeriod] = useState("current-month")
  const [helpersView, setHelpersView] = useState("view-all")
  const { id } = use(params)

  // SLA record
  const { data: sla, isLoading: slaLoading, error: slaError } = useSLA(id)

  // Tickets for this SLA (with time entries + participants)
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["sla-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, tickets_time_entries(*), tickets_participants(*)")
        .eq("sla_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as TicketRow[]
    },
    enabled: !!id,
    staleTime: 1800000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Helpers for this project (to resolve participant_id → name)
  const { data: projectHelpers = [] } = useQuery<HelperPublic[]>({
    queryKey: ["sla-helpers", sla?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects_helpers")
        .select("helper_id, user:users_public(name)")
        .eq("project_id", sla!.project_id)
      if (error) throw error
      // Supabase returns user as array when using foreign tables
      return ((data ?? []) as any[]).map((h) => ({
        helper_id: h.helper_id,
        user: Array.isArray(h.user) ? (h.user[0] ?? null) : (h.user ?? null),
      })) as HelperPublic[]
    },
    enabled: !!sla?.project_id,
    staleTime: 1800000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // ---- Filter tickets by period -------------------------------------------
  const filteredTickets = useMemo(() => {
    if (!tickets.length) return tickets
    if (timePeriod === "all-time") return tickets
    const now = new Date()
    if (timePeriod === "current-month") {
      return tickets.filter((t) => {
        const d = new Date(t.created_at)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
    }
    // month selector values like "april-2025"
    const parts = timePeriod.split("-")
    if (parts.length === 2) {
      const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"]
      const monthIdx = monthNames.indexOf(parts[0].toLowerCase())
      const year = parseInt(parts[1], 10)
      if (monthIdx >= 0 && !isNaN(year)) {
        return tickets.filter((t) => {
          const d = new Date(t.created_at)
          return d.getFullYear() === year && d.getMonth() === monthIdx
        })
      }
    }
    return tickets
  }, [tickets, timePeriod])

  // ---- Build helper lookup map --------------------------------------------
  const helperMap = useMemo(() => {
    const map = new Map<string, string>()
    projectHelpers.forEach((h) => {
      if (h.user?.name) map.set(h.helper_id, h.user.name)
    })
    return map
  }, [projectHelpers])

  // ---- Compute stats ------------------------------------------------------
  const stats = useMemo(() => {
    const solved = filteredTickets.filter((t) => t.status === "completed" || t.status === "cancelled").length
    const totalMs = filteredTickets.flatMap((t) => t.tickets_time_entries).reduce((sum, e) => sum + (e.time_milliseconds ?? 0), 0)
    const includedMs = (sla?.minutes_included ?? 0) * 60 * 1000
    const remainingMs = Math.max(0, includedMs - totalMs)
    const pct = filteredTickets.length > 0 ? Math.round((solved / filteredTickets.length) * 100) : 0
    return { solved, totalMs, remainingMs, pct }
  }, [filteredTickets, sla?.minutes_included])

  // ---- Build helpers summary table ----------------------------------------
  const helpersSummary = useMemo(() => {
    const map = new Map<string, { name: string; tickets: Set<string>; totalMs: number }>()
    filteredTickets.forEach((ticket) => {
      ticket.tickets_time_entries.forEach((entry) => {
        const hid = entry.helper_id
        if (!map.has(hid)) {
          map.set(hid, { name: helperMap.get(hid) ?? hid, tickets: new Set(), totalMs: 0 })
        }
        const rec = map.get(hid)!
        rec.tickets.add(ticket.id)
        rec.totalMs += entry.time_milliseconds ?? 0
      })
    })
    return Array.from(map.entries()).map(([hid, rec]) => ({
      id: hid,
      name: rec.name,
      tickets: rec.tickets.size,
      totalMs: rec.totalMs,
    }))
  }, [filteredTickets, helperMap])

  // ---- Loading / error states ---------------------------------------------
  if (slaLoading || ticketsLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-muted">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="SLA Details" subtitle="View and manage SLA configuration" />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <span className="text-muted-foreground">Loading…</span>
          </main>
        </div>
      </div>
    )
  }

  if (slaError || !sla) {
    return (
      <div className="flex h-screen overflow-hidden bg-muted">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="SLA Details" subtitle="View and manage SLA configuration" />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <span className="text-muted-foreground">SLA not found.</span>
          </main>
        </div>
      </div>
    )
  }

  // ---- Derived display values ---------------------------------------------
  const slaName = sla.name ?? "Unnamed SLA"
  const spaceId = sla.space_id ?? "—"
  const currency = sla.currency ?? "USD"

  const copySpaceId = () => {
    if (sla.space_id) navigator.clipboard.writeText(sla.space_id)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="SLA Details" subtitle="View and manage SLA configuration" />

        <main className="flex-1 overflow-auto p-6">
          {/* Back navigation */}
          <div className="mb-6">
            <Link
              href="/slas"
              className="inline-flex items-center text-brand-primary hover:text-brand-primary/80 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to list of SLAs
            </Link>
          </div>

          {/* SLA header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold"
              style={{ backgroundColor: avatarColor(slaName) }}
            >
              {getInitial(slaName)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">{slaName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Space ID:</span>
                <span className="font-mono">{spaceId}</span>
                <Button variant="ghost" size="sm" onClick={copySpaceId} className="h-auto p-1 hover:bg-brand-primary/10">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Agreement details */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Agreement details</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted bg-transparent">
                <Edit className="w-4 h-4" />
                Edit agreement
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rates beyond support included */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Rates beyond support included</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket start price</span>
                      <span className="text-sm font-medium">
                        {centsToDisplay(sla.ticket_start_price, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Price/minute - first 60 minutes</span>
                      <span className="text-sm font-medium">
                        {centsToDisplay(sla.ticket_price_minute_first_60, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Price/minute - after 60 minutes</span>
                      <span className="text-sm font-medium">
                        {centsToDisplay(sla.ticket_price_minute_after_60, currency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Included support */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Included support</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total time in SLA/month</span>
                      <span className="text-sm font-medium">
                        {formatMinutes(sla.minutes_included)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rollover time</span>
                      <span className="text-sm font-medium">{sla.minutes_rollover ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rollover time from last month</span>
                      <span className="text-sm font-medium">—</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Response times */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Response times</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Maximum response time</span>
                      <span className="text-sm font-medium">
                        {formatMinutes(sla.max_response_time_minutes)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Maximum down time</span>
                      <span className="text-sm font-medium">{formatMinutes(sla.max_downtime)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Time period filters */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={timePeriod === "current-month" ? "default" : "outline"}
              onClick={() => setTimePeriod("current-month")}
              className={
                timePeriod === "current-month"
                  ? "bg-brand-primary hover:bg-brand-primary/90"
                  : "border-border text-muted-foreground hover:bg-muted"
              }
            >
              Current month
            </Button>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[140px] border-border">
                <SelectValue placeholder="Choose month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="april-2025">April 2025</SelectItem>
                <SelectItem value="march-2025">March 2025</SelectItem>
                <SelectItem value="february-2025">February 2025</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={timePeriod === "all-time" ? "default" : "outline"}
              onClick={() => setTimePeriod("all-time")}
              className={
                timePeriod === "all-time"
                  ? "bg-brand-primary hover:bg-brand-primary/90"
                  : "border-border text-muted-foreground hover:bg-muted"
              }
            >
              All time
            </Button>
          </div>

          {/* Key stats */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Key stats</h2>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{stats.solved}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{formatMs(stats.totalMs)}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Support time remaining</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{formatMs(stats.remainingMs)}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{stats.pct}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Helpers and Issue types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Helpers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Helpers ({helpersSummary.length})</h2>
              </div>

              {/* Helper filter tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={helpersView === "view-all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHelpersView("view-all")}
                  className={
                    helpersView === "view-all"
                      ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }
                >
                  View all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Core team
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Extended team
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Community
                </Button>
              </div>

              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-brand-primary/10">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">No of tickets</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total time</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {helpersSummary.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground text-[14px]">No helpers yet</td>
                          </tr>
                        ) : (
                          helpersSummary.map((helper) => (
                            <tr key={helper.id} className="border-b border-border hover:bg-muted">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                    style={{ backgroundColor: avatarColor(helper.name) }}
                                  >
                                    {getInitial(helper.name)}
                                  </div>
                                  <span className="text-foreground font-medium">{helper.name}</span>
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground">{helper.tickets}</td>
                              <td className="p-4 text-muted-foreground">{formatMs(helper.totalMs)}</td>
                              <td className="p-4">
                                <Button variant="ghost" size="sm" className="text-brand-primary hover:bg-brand-primary/10">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issue types — not yet available in DB schema; show placeholder */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Issue types</h2>
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-brand-primary/10">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">No of tickets</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total time</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-muted-foreground text-[14px]">No issue types recorded</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">All tickets ({filteredTickets.length})</h2>
            <Card className="border-border py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-brand-primary/10">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          <input type="checkbox" className="mr-3" />
                          Ticket ID
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Helper</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-muted-foreground text-[14px]">No tickets yet</td>
                        </tr>
                      ) : (
                        filteredTickets.map((ticket) => {
                          // Primary helper = participant who claimed the ticket
                          const claimedParticipant = ticket.tickets_participants.find((p) => p.claimed)
                          const primaryHelperId = claimedParticipant?.participant_id
                          const primaryHelperName = primaryHelperId ? (helperMap.get(primaryHelperId) ?? "Unknown") : "—"

                          const ticketMs = ticket.tickets_time_entries.reduce(
                            (sum, e) => sum + (e.time_milliseconds ?? 0), 0
                          )
                          const isCompleted = ticket.status === "completed"
                          const isCancelled = ticket.status === "cancelled"

                          return (
                            <tr key={ticket.id} className="border-b border-border hover:bg-muted">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" />
                                  <span className="text-foreground font-medium">{ticket.id.slice(0, 8)}</span>
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground">
                                {new Date(ticket.created_at).toLocaleDateString("en-GB")}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                                    style={{ backgroundColor: avatarColor(primaryHelperName) }}
                                  >
                                    {getInitial(primaryHelperName)}
                                  </div>
                                  <span className="text-muted-foreground">{primaryHelperName}</span>
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground">
                                {ticketMs > 0 ? formatMs(ticketMs) : `${currency} 0.00`}
                              </td>
                              <td className="p-4">
                                {(isCompleted || isCancelled) ? (
                                  <Badge variant="secondary" className="bg-status-success-bg text-status-success-text border-0">
                                    ✓ {isCompleted ? "Completed" : "Cancelled"}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="border-0 capitalize">
                                    {ticket.status}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                                  >
                                    Open
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download PDF
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
