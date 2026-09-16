"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Copy, Check, Pencil } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateSLADrawer } from "@/components/drawers/create-sla-drawer"
import { RequestPdfModal } from "@/components/modals/request-pdf-modal"
import {
  useRealtimeSla,
  useSLA,
  useSlaBillingPeriods,
  useSlaTickets,
  useSlaUsage,
  useUpdateSLA,
} from "@/hooks/useSLAs"
import { supabase } from "@/lib/supabase/client"
import { getAvatarColorHexForId } from "@/lib/constants"
import { getTicketStatusBadgeClass } from "@/lib/status-colors"
import {
  SLA_STATUS_BADGE_CLASS,
  SLA_STATUS_LABELS,
  computePeriodUsage,
  formatSlaAmount,
  formatSlaDate,
  formatSlaMinutes,
  frequencyLabel,
  frequencyPerLabel,
  isUnlimitedSla,
  periodLabel,
} from "@/lib/sla"

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-lg border-[#E1E1E1] py-0 shadow-none">
      <CardContent className="px-5 py-4">
        <div className="text-xl font-bold text-foreground mb-1">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground/70 mt-1">{hint}</div>}
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  )
}

function useOrganizationName(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["organization-name", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").eq("id", orgId as string).maybeSingle()
      if (error) throw error
      return (data as { id: string; name: string } | null)?.name ?? null
    },
    enabled: !!orgId,
    staleTime: 300_000,
    retry: false,
  })
}

function useProjectHelperNames(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["sla-helpers", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects_helpers")
        .select("helper_id, category, user:users_public(name)")
        .eq("project_id", projectId as string)
      if (error) throw error
      const map = new Map<string, { name: string; category: string | null }>()
      for (const row of (data ?? []) as Array<{ helper_id: string; category: string | null; user: { name: string } | { name: string }[] | null }>) {
        const user = Array.isArray(row.user) ? row.user[0] : row.user
        map.set(row.helper_id, { name: user?.name || "Helper", category: row.category })
      }
      return map
    },
    enabled: !!projectId,
    staleTime: 300_000,
    retry: false,
  })
}

export default function SLADetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [editOpen, setEditOpen] = useState(false)
  const [requestPdfOpen, setRequestPdfOpen] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("current")
  const [copied, setCopied] = useState(false)

  const { data: sla, isLoading: slaLoading, error: slaError } = useSLA(id)
  const { data: usage, isLoading: usageLoading, error: usageError } = useSlaUsage(id)
  const { data: periods } = useSlaBillingPeriods(id)
  const { data: tickets, isLoading: ticketsLoading } = useSlaTickets(id)
  const { data: orgName } = useOrganizationName(sla?.organization_id)
  const { data: helperNames } = useProjectHelperNames(sla?.project_id)
  const updateSla = useUpdateSLA()
  useRealtimeSla(id)

  const selectedPeriod = useMemo(() => {
    if (selectedPeriodId === "current") return null
    return (periods ?? []).find((p) => p.id === selectedPeriodId) ?? null
  }, [periods, selectedPeriodId])

  // Numbers for the stats: the chosen historical period, otherwise the live
  // current period from the edge function.
  const shownUsage = useMemo(() => {
    if (selectedPeriod) return computePeriodUsage(selectedPeriod)
    if (usage) {
      return computePeriodUsage({
        minutes_included: usage.period.minutesIncluded,
        minutes_consumed: usage.period.minutesConsumed,
        minutes_rolled_over: usage.period.minutesRolledOver,
      })
    }
    return null
  }, [selectedPeriod, usage])

  const shownPeriodLabel = selectedPeriod
    ? periodLabel(selectedPeriod, sla?.payment_frequency)
    : usage
      ? periodLabel({ period_start: usage.period.periodStart, period_end: usage.period.periodEnd }, sla?.payment_frequency)
      : "Current period"

  const ticketRows = useMemo(() => {
    return (tickets ?? []).map((t) => {
      const minutes = Math.round((t.time_entries ?? []).reduce((s, e) => s + (e.time_milliseconds || 0), 0) / 60000)
      const type = t.categories?.find((c) => c.help_category?.value)?.help_category?.value
      return {
        id: t.id,
        title: t.title?.trim() || "Untitled ticket",
        type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Support",
        created: formatSlaDate(t.created_at),
        createdRaw: t.created_at,
        minutes,
        recorded: t.sla_usage_recorded_at,
        status: t.status,
      }
    })
  }, [tickets])

  const helperRows = useMemo(() => {
    const totals = new Map<string, { minutes: number; tickets: Set<string> }>()
    for (const t of tickets ?? []) {
      for (const e of t.time_entries ?? []) {
        const cur = totals.get(e.helper_id) ?? { minutes: 0, tickets: new Set<string>() }
        cur.minutes += Math.round((e.time_milliseconds || 0) / 60000)
        cur.tickets.add(t.id)
        totals.set(e.helper_id, cur)
      }
    }
    return Array.from(totals.entries())
      .map(([helperId, v]) => ({
        helperId,
        name: helperNames?.get(helperId)?.name ?? "Helper",
        category: helperNames?.get(helperId)?.category ?? null,
        minutes: v.minutes,
        tickets: v.tickets.size,
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [tickets, helperNames])

  const copyCode = async () => {
    if (!sla?.access_code) return
    try {
      await navigator.clipboard.writeText(sla.access_code)
      setCopied(true)
      toast.success("Access code copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy to the clipboard")
    }
  }

  const setStatus = async (status: "active" | "cancelled") => {
    if (!sla) return
    try {
      await updateSla.mutateAsync({ id: sla.id, updates: { status } })
      toast.success(status === "active" ? "Agreement reactivated" : "Agreement cancelled")
    } catch (e) {
      console.error("Failed to update SLA status", e)
      toast.error(e instanceof Error ? e.message : "Could not update the agreement")
    }
  }

  const unlimited = sla ? isUnlimitedSla(sla) : false
  const perLabel = frequencyPerLabel(sla?.payment_frequency)
  const overageCost =
    sla && shownUsage && shownUsage.overageMinutes > 0
      ? shownUsage.overageMinutes * sla.ticket_price_minute_first_60
      : 0

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={sla?.name?.trim() || (slaLoading ? "Loading..." : "SLA")}
          subtitle="Service Level Agreement details"
          showBackButton
          backButtonText="All SLAs"
          backButtonHref="/slas"
        />

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {slaError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load this SLA. You may not have access to it.
            </div>
          )}

          {sla && (
            <>
              {/* Summary header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold text-foreground"
                    style={{ backgroundColor: getAvatarColorHexForId(sla.id) }}
                  >
                    {(sla.name?.trim() || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-foreground">{sla.name?.trim() || "Unnamed SLA"}</h2>
                      <Badge variant="secondary" className={SLA_STATUS_BADGE_CLASS[sla.status]}>
                        {SLA_STATUS_LABELS[sla.status]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sla.organization_id ? (
                        <>Customer: <span className="text-foreground">{orgName ?? "Linked organization"}</span></>
                      ) : (
                        <span className="italic">Awaiting customer — share the access code below</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sla.stripe_subscription_id
                        ? "Subscription active in Stripe"
                        : "No subscription yet — the customer activates it from their SLA page"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm tracking-widest text-foreground hover:bg-muted cursor-pointer"
                    title="Copy access code"
                  >
                    {sla.access_code}
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit agreement
                  </Button>
                  {sla.status === "active" ? (
                    <Button variant="outline" size="sm" onClick={() => void setStatus("cancelled")} disabled={updateSla.isPending}>
                      Cancel agreement
                    </Button>
                  ) : (
                    <Button variant="lavender" size="sm" onClick={() => void setStatus("active")} disabled={updateSla.isPending}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>

              {/* Agreement details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-lg border-[#E1E1E1] py-0 shadow-none">
                  <CardContent className="px-5 py-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Subscription</h3>
                    <DetailRow label="Price" value={`${formatSlaAmount(sla.subscription_amount_smallest_unit, sla.currency)} ${perLabel}`} />
                    <DetailRow label="Billed" value={frequencyLabel(sla.payment_frequency)} />
                    <DetailRow label="Start" value={formatSlaDate(sla.start_date)} />
                    <DetailRow label="End" value={sla.end_date ? formatSlaDate(sla.end_date) : "Open-ended"} />
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-[#E1E1E1] py-0 shadow-none">
                  <CardContent className="px-5 py-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Included support</h3>
                    <DetailRow label="Time included" value={unlimited ? "Unlimited" : `${formatSlaMinutes(sla.minutes_included)} ${perLabel}`} />
                    <DetailRow label="Rollover" value={unlimited ? "—" : sla.minutes_rollover ? "Unused time carries over" : "No rollover"} />
                    <DetailRow
                      label="Overage"
                      value={
                        unlimited || sla.ticket_price_minute_first_60 === 0
                          ? "Not billed"
                          : `${formatSlaAmount(sla.ticket_price_minute_first_60, sla.currency)} per minute`
                      }
                    />
                    <DetailRow label="Contact" value={sla.contact_email || sla.contact_name || "—"} />
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-[#E1E1E1] py-0 shadow-none">
                  <CardContent className="px-5 py-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Guarantees</h3>
                    <DetailRow
                      label="Max response time"
                      value={sla.max_response_time_minutes != null ? formatSlaMinutes(sla.max_response_time_minutes) : "Not set"}
                    />
                    <DetailRow label="Max downtime" value={sla.max_downtime != null ? `${sla.max_downtime}h` : "Not set"} />
                    <DetailRow label="Created" value={formatSlaDate(sla.created_at)} />
                  </CardContent>
                </Card>
              </div>

              {/* Usage */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Usage</h3>
                  <p className="text-xs text-muted-foreground">{shownPeriodLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                    <SelectTrigger className="w-[220px] h-9 text-muted-foreground">
                      <SelectValue placeholder="Choose period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current period</SelectItem>
                      {(periods ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {periodLabel(p, sla.payment_frequency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                    onClick={() => setRequestPdfOpen(true)}
                  >
                    Request PDF
                  </Button>
                </div>
              </div>

              {usageError && !selectedPeriod && (
                <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                  Live usage is unavailable right now ({usageError.message}). Historical periods can still be selected above.
                </div>
              )}

              {unlimited ? (
                <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
                  This agreement has no time limit. Logged time is tracked per ticket below but never billed as overage.
                </div>
              ) : shownUsage ? (
                <>
                  <div className="grid grid-cols-2 gap-4 min-[1200px]:grid-cols-4">
                    <StatCard label="Included this period" value={formatSlaMinutes(shownUsage.minutesIncluded)} />
                    <StatCard label="Rolled over from last period" value={formatSlaMinutes(shownUsage.minutesRolledOver)} />
                    <StatCard label="Used" value={formatSlaMinutes(shownUsage.minutesConsumed)} hint={`${shownUsage.percentUsed}% of available`} />
                    <StatCard
                      label={shownUsage.overageMinutes > 0 ? "Overage" : "Remaining"}
                      value={shownUsage.overageMinutes > 0 ? formatSlaMinutes(shownUsage.overageMinutes) : formatSlaMinutes(shownUsage.minutesRemaining)}
                      hint={overageCost > 0 ? `≈ ${formatSlaAmount(overageCost, sla.currency)} on the next invoice` : undefined}
                    />
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={shownUsage.overageMinutes > 0 ? "h-full bg-red-400" : "h-full bg-brand-primary"}
                      style={{ width: `${shownUsage.percentUsed}%` }}
                    />
                  </div>
                </>
              ) : usageLoading ? (
                <div className="text-sm text-muted-foreground">Loading usage...</div>
              ) : null}

              {/* Helpers */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Helpers on this agreement</h3>
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                      <div className="col-span-6">Helper</div>
                      <div className="col-span-3">Tickets</div>
                      <div className="col-span-3">Time logged</div>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {helperRows.length === 0 ? (
                      <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No time logged on this agreement yet</div>
                    ) : (
                      helperRows.map((h) => (
                        <div key={h.helperId} className="px-6 py-4 hover:bg-[#f7f9ff]">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-6 flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground"
                                style={{ backgroundColor: getAvatarColorHexForId(h.helperId) }}
                              >
                                {h.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{h.name}</div>
                                {h.category && <div className="text-xs text-muted-foreground capitalize">{h.category} helper</div>}
                              </div>
                            </div>
                            <div className="col-span-3 text-sm text-foreground">{h.tickets}</div>
                            <div className="col-span-3 text-sm text-foreground">{formatSlaMinutes(h.minutes)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Tickets */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Tickets under this agreement</h3>
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                      <div className="col-span-4">Ticket</div>
                      <div className="col-span-1">Type</div>
                      <div className="col-span-2">Created</div>
                      <div className="col-span-1">Logged</div>
                      <div className="col-span-2">Usage recorded</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {ticketsLoading ? (
                      <div className="px-6 py-8 text-center text-muted-foreground">Loading tickets...</div>
                    ) : ticketRows.length === 0 ? (
                      <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">No tickets have used this agreement yet</div>
                    ) : (
                      ticketRows.map((t) => (
                        <div key={t.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-4 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate" title={t.title}>{t.title}</div>
                              <div className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 7)}</div>
                            </div>
                            <div className="col-span-1">
                              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">{t.type}</Badge>
                            </div>
                            <div className="col-span-2 text-sm text-muted-foreground">{t.created}</div>
                            <div className="col-span-1 text-sm text-foreground">{formatSlaMinutes(t.minutes)}</div>
                            <div className="col-span-2 text-sm text-muted-foreground">
                              {t.recorded ? formatSlaDate(t.recorded) : t.status === "completed" ? "Pending" : "—"}
                            </div>
                            <div className="col-span-1">
                              <Badge variant="secondary" className={`${getTicketStatusBadgeClass(t.status)} border-0 capitalize`}>
                                {t.status.replace("-", " ")}
                              </Badge>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button asChild variant="outline" size="sm" className="text-muted-foreground border-border hover:bg-muted bg-transparent">
                                <Link href={`/helper/tickets/${t.id}`}>Open</Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <CreateSLADrawer isOpen={editOpen} onClose={() => setEditOpen(false)} sla={sla ?? null} />
      <RequestPdfModal open={requestPdfOpen} onOpenChange={setRequestPdfOpen} />
    </div>
  )
}
