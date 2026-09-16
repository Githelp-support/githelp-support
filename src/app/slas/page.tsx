"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MoreHorizontal, Plus, Search, ChevronDown, ChevronsUpDown, ChevronUp, Copy } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { CreateSLADrawer } from "@/components/drawers/create-sla-drawer"
import { SLAConfirmationModal } from "@/components/modals/sla-confirmation-modal"
import { useDeleteSLA, useSLAs, useUpdateSLA } from "@/hooks/useSLAs"
import { useProjectSelection } from "@/contexts/project-context"
import { supabase } from "@/lib/supabase/client"
import { getAvatarColorHexForId } from "@/lib/constants"
import {
  SLA_STATUS_BADGE_CLASS,
  SLA_STATUS_LABELS,
  formatSlaAmount,
  formatSlaDate,
  formatSlaMinutes,
  frequencyPerLabel,
  isUnlimitedSla,
  slaStatusTab,
  type SlaRow,
  type SlaStatusTab,
} from "@/lib/sla"
import { SLAS_PREVIEW_DISCLAIMER, SLA_PREVIEW_ROWS } from "@/lib/sla-preview-copy"

type SortKey = "name" | "included" | "price" | "customer" | "status" | "created"
type SortConfig = { key: SortKey | null; direction: "asc" | "desc" | null }

const TABS: Array<{ value: SlaStatusTab; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Payment pending" },
  { value: "ended", label: "Ended" },
]

function SLASortIcon({ column, sortConfig }: { column: SortKey; sortConfig: SortConfig }) {
  if (sortConfig.key !== column) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  if (sortConfig.direction === "asc") {
    return <ChevronUp className="w-4 h-4 text-brand-primary" />
  }
  return <ChevronDown className="w-4 h-4 text-brand-primary" />
}

function SortHeader({
  label,
  column,
  className,
  sortConfig,
  onSort,
}: {
  label: string
  column: SortKey
  className: string
  sortConfig: SortConfig
  onSort: (column: SortKey) => void
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="flex items-center space-x-2 hover:text-brand-primary transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        <SLASortIcon column={column} sortConfig={sortConfig} />
      </button>
    </div>
  )
}

/** Organization names for the "Customer" column (organizations select is public). */
function useOrganizationNames(orgIds: string[]) {
  const key = [...orgIds].sort().join(",")
  return useQuery({
    queryKey: ["organization-names", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").in("id", orgIds)
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of (data ?? []) as Array<{ id: string; name: string }>) map.set(row.id, row.name)
      return map
    },
    enabled: orgIds.length > 0,
    staleTime: 300_000,
    retry: false,
  })
}

interface SlaListRow {
  id: string
  raw: SlaRow
  name: string
  contact: string
  includedLabel: string
  includedMinutes: number
  priceLabel: string
  priceRaw: number
  customerLabel: string
  customerLinked: boolean
  status: SlaRow["status"]
  accessCode: string
  createdLabel: string
  createdRaw: number
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error("Could not copy to the clipboard")
  }
}

export default function SLAsPage() {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState<SlaStatusTab>("active")
  const [searchTerm, setSearchTerm] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<SlaRow | null>(null)
  const [created, setCreated] = useState<SlaRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SlaRow | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null })

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: slasData, isLoading, isFetched } = useSLAs(projectId)
  const updateSla = useUpdateSLA()
  const deleteSla = useDeleteSLA()

  const orgIds = useMemo(
    () => Array.from(new Set((slasData ?? []).map((s) => s.organization_id).filter((id): id is string => !!id))),
    [slasData],
  )
  const { data: orgNames } = useOrganizationNames(orgIds)

  const allRows: SlaListRow[] = useMemo(() => {
    return (slasData ?? []).map((sla) => {
      const unlimited = isUnlimitedSla(sla)
      const per = frequencyPerLabel(sla.payment_frequency)
      return {
        id: sla.id,
        raw: sla,
        name: sla.name?.trim() || "Unnamed SLA",
        contact: sla.contact_email || sla.contact_name || "",
        includedLabel: unlimited ? "Unlimited" : `${formatSlaMinutes(sla.minutes_included)} ${per}`,
        includedMinutes: unlimited ? Number.MAX_SAFE_INTEGER : sla.minutes_included,
        priceLabel: `${formatSlaAmount(sla.subscription_amount_smallest_unit, sla.currency)} ${per}`,
        priceRaw: sla.subscription_amount_smallest_unit,
        customerLabel: sla.organization_id ? orgNames?.get(sla.organization_id) || "Linked" : "Awaiting customer",
        customerLinked: !!sla.organization_id,
        status: sla.status,
        accessCode: sla.access_code,
        createdLabel: formatSlaDate(sla.created_at),
        createdRaw: new Date(sla.created_at).getTime(),
      }
    })
  }, [slasData, orgNames])

  const tabCounts = useMemo(() => {
    const counts: Record<SlaStatusTab, number> = { active: 0, inactive: 0, ended: 0 }
    for (const row of allRows) counts[slaStatusTab(row.status)] += 1
    return counts
  }, [allRows])

  const handleSort = (key: SortKey) => {
    let direction: "asc" | "desc" | null = "asc"
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc"
      else if (sortConfig.direction === "desc") direction = null
    }
    setSortConfig({ key: direction ? key : null, direction })
  }

  const visibleRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const filtered = allRows.filter((row) => {
      if (slaStatusTab(row.status) !== currentTab) return false
      if (!term) return true
      return (
        row.name.toLowerCase().includes(term) ||
        row.contact.toLowerCase().includes(term) ||
        row.customerLabel.toLowerCase().includes(term) ||
        row.accessCode.toLowerCase().includes(term.replace(/\s/g, ""))
      )
    })
    if (!sortConfig.key || !sortConfig.direction) return filtered
    const dir = sortConfig.direction === "asc" ? 1 : -1
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortConfig.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir
        case "included":
          return (a.includedMinutes - b.includedMinutes) * dir
        case "price":
          return (a.priceRaw - b.priceRaw) * dir
        case "customer":
          return a.customerLabel.localeCompare(b.customerLabel) * dir
        case "status":
          return SLA_STATUS_LABELS[a.status].localeCompare(SLA_STATUS_LABELS[b.status]) * dir
        case "created":
          return (a.createdRaw - b.createdRaw) * dir
        default:
          return 0
      }
    })
    return sorted
  }, [allRows, currentTab, searchTerm, sortConfig])

  const hasAnySla = allRows.length > 0
  const showPreview = !!projectId && isFetched && !isLoading && !hasAnySla

  const openCreate = () => {
    setEditing(null)
    setDrawerOpen(true)
  }

  const openEdit = (sla: SlaRow) => {
    setEditing(sla)
    setDrawerOpen(true)
  }

  const setStatus = async (sla: SlaRow, status: SlaRow["status"]) => {
    try {
      await updateSla.mutateAsync({ id: sla.id, updates: { status } })
      toast.success(status === "active" ? "Agreement reactivated" : "Agreement cancelled")
    } catch (e) {
      console.error("Failed to update SLA status", e)
      toast.error(e instanceof Error ? e.message : "Could not update the agreement")
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteSla.mutateAsync({ id: pendingDelete.id })
      toast.success("Agreement deleted")
      setPendingDelete(null)
    } catch (e) {
      console.error("Failed to delete SLA", e)
      toast.error(e instanceof Error ? e.message : "Could not delete the agreement")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Your SLAs" subtitle="Manage your Service Level Agreements" />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Filter tabs */}
          <div className="mb-6">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCurrentTab(tab.value)}
                  className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                    currentTab === tab.value
                      ? "text-brand-primary border-brand-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {hasAnySla && (
                    <span className="ml-2 text-xs text-muted-foreground">{tabCounts[tab.value]}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="h-px bg-border -mx-6"></div>
          </div>

          {/* Search and Create button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact or code"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-border"
              />
            </div>
            <Button variant="lavender" onClick={openCreate} disabled={!projectId}>
              <Plus className="w-4 h-4" />
              Create new SLA
            </Button>
          </div>

          {!projectId && (
            <div className="mb-6 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
              Select a project to manage its SLAs.
            </div>
          )}

          {showPreview && (
            <div className="mb-6 rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-foreground">
              {SLAS_PREVIEW_DISCLAIMER}
            </div>
          )}

          {/* Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
              <div className="grid grid-cols-12 gap-4 items-center">
                <SortHeader label="Agreement" column="name" className="col-span-3" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Included" column="included" className="col-span-2" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Price" column="price" className="col-span-2" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Customer" column="customer" className="col-span-2" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Status" column="status" className="col-span-1" sortConfig={sortConfig} onSort={handleSort} />
                <div className="col-span-1">
                  <span className="text-sm font-medium text-foreground">Code</span>
                </div>
                <div className="col-span-1 text-right">
                  <span className="text-sm font-medium text-foreground">Created</span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="px-6 py-8 text-center text-muted-foreground">Loading SLAs...</div>
              ) : showPreview ? (
                SLA_PREVIEW_ROWS.map((row) => (
                  <div key={row.id} role="presentation" className="px-6 py-4 opacity-80">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 flex items-center space-x-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                          style={{ backgroundColor: getAvatarColorHexForId(row.id) }}
                        >
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Preview
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{row.contact}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">{row.includedTime}</div>
                      <div className="col-span-2 text-sm text-muted-foreground">{row.price}</div>
                      <div className="col-span-2 text-sm text-muted-foreground">{row.customer}</div>
                      <div className="col-span-1">
                        <Badge
                          variant="secondary"
                          className={row.status === "Active" ? SLA_STATUS_BADGE_CLASS.active : SLA_STATUS_BADGE_CLASS.inactive}
                        >
                          {row.status}
                        </Badge>
                      </div>
                      <div className="col-span-1 font-mono text-xs text-muted-foreground">{row.accessCode}</div>
                      <div className="col-span-1 text-right text-sm text-muted-foreground">{row.created}</div>
                    </div>
                  </div>
                ))
              ) : visibleRows.length > 0 ? (
                visibleRows.map((row) => (
                  <div
                    key={row.id}
                    className="px-6 py-4 hover:bg-[#f7f9ff] cursor-pointer"
                    onClick={() => router.push(`/slas/${row.id}`)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 flex items-center space-x-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                          style={{ backgroundColor: getAvatarColorHexForId(row.id) }}
                        >
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/slas/${row.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-medium text-foreground hover:text-brand-primary transition-colors block truncate"
                          >
                            {row.name}
                          </Link>
                          {row.contact && <div className="text-xs text-muted-foreground truncate">{row.contact}</div>}
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">{row.includedLabel}</div>
                      <div className="col-span-2 text-sm text-muted-foreground">{row.priceLabel}</div>
                      <div className="col-span-2 text-sm">
                        <span className={row.customerLinked ? "text-foreground" : "text-muted-foreground italic"}>
                          {row.customerLabel}
                        </span>
                      </div>
                      <div className="col-span-1">
                        <Badge variant="secondary" className={SLA_STATUS_BADGE_CLASS[row.status]}>
                          {SLA_STATUS_LABELS[row.status]}
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void copyText(row.accessCode, "Access code")
                          }}
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-brand-primary cursor-pointer"
                          title="Copy access code"
                        >
                          {row.accessCode}
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{row.createdLabel}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:bg-muted"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Agreement actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onSelect={() => router.push(`/slas/${row.id}`)}>See details</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(row.raw)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void copyText(row.accessCode, "Access code")}>
                              Copy access code
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {row.status === "active" ? (
                              <DropdownMenuItem onSelect={() => void setStatus(row.raw, "cancelled")}>
                                Mark cancelled
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => void setStatus(row.raw, "active")}>Reactivate</DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setPendingDelete(row.raw)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-muted-foreground text-[14px]">
                  {searchTerm.trim()
                    ? "No SLAs match your search"
                    : `No ${TABS.find((t) => t.value === currentTab)?.label.toLowerCase()} SLAs`}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <CreateSLADrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projectId={projectId}
        sla={editing}
        onSaved={(saved, mode) => {
          if (mode === "create") setCreated(saved)
        }}
      />

      <SLAConfirmationModal
        open={!!created}
        onOpenChange={(open) => {
          if (!open) setCreated(null)
        }}
        slaId={created?.id ?? null}
        accessCode={created?.access_code ?? null}
        slaName={created?.name ?? null}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this agreement?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name ? `"${pendingDelete.name}"` : "This SLA"} will be removed from your lists and no
              new tickets can use it. Existing tickets and reports keep their history.
              {pendingDelete?.stripe_subscription_id
                ? " The Stripe subscription is not cancelled automatically — cancel it in Stripe as well."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleteSla.isPending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleteSla.isPending}>
              {deleteSla.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
