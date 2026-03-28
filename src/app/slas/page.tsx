"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MoreHorizontal, Plus, Search, ChevronDown, Info, ChevronsUpDown, ChevronUp } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { CreateSLADrawer } from "@/components/drawers/create-sla-drawer"
import { useSLAs } from "@/hooks/useSLAs"
import { useProjectSelection } from "@/contexts/project-context"

const slaColors = ["#cbbcf6", "#d0f6bc", "#f6e6bc", "#bcedf6"]

type SortConfig = { key: string | null; direction: "asc" | "desc" | null }

function SLASortIcon({ column, sortConfig }: { column: string; sortConfig: SortConfig }) {
  if (sortConfig.key !== column) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  if (sortConfig.direction === "asc") {
    return <ChevronUp className="w-4 h-4 text-brand-primary" />
  }
  return <ChevronDown className="w-4 h-4 text-brand-primary" />
}

// Helper function to format date
const formatSlaDate = (dateString: string | null) => {
  if (!dateString) return ""
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export default function SLAsPage() {
  const [currentFilter, setCurrentFilter] = useState<"active" | "deactivated" | "archived">("active")
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateSLADrawerOpen, setIsCreateSLADrawerOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: "asc" | "desc" | null
  }>({
    key: null,
    direction: null,
  })

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  // Fetch SLAs
  const { data: slasData, isLoading } = useSLAs(projectId)

  // Transform SLAs to UI format
  const slaData = useMemo(() => {
    if (!slasData) return []
    return slasData
      .filter((sla) => sla.status === currentFilter)
      .map((sla, index) => ({
        id: sla.id,
        name: sla.name || "Unnamed SLA",
        initial: (sla.name || "U")[0].toUpperCase(),
        created: formatSlaDate(sla.created_at),
        agreementCategory: sla.time_period ? "Hours per month" : "By the ticket",
        color: slaColors[index % slaColors.length],
        status: sla.status,
      }))
  }, [slasData, currentFilter])

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc"

    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc"
      } else if (sortConfig.direction === "desc") {
        direction = null
      }
    }

    setSortConfig({ key: direction ? key : null, direction })
  }

  const filteredAndSortedSLAs = (() => {
    const filtered = slaData.filter((sla) => {
      const matchesSearch = sla.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })

    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: string | number | Date = a[sortConfig.key as keyof typeof a] as string | number
        let bValue: string | number | Date = b[sortConfig.key as keyof typeof b] as string | number

        if (sortConfig.key === "created") {
          aValue = new Date(String(aValue).split("/").reverse().join("-"))
          bValue = new Date(String(bValue).split("/").reverse().join("-"))
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1
        }
        return 0
      })
    }

    return filtered
  })()

  const handleCreateSLA = (_slaData: import("@/components/drawers/create-sla-drawer").SLAPayload) => {
    setIsCreateSLADrawerOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Your SLAs" subtitle="Manage your Service Level Agreements" />

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Filter tabs */}
          <div className="mb-6">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentFilter("active")}
                className={`px-6 py-2 text-[13px] font-medium transition-colors border-b-2 cursor-pointer ${
                  currentFilter === "active"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setCurrentFilter("deactivated")}
                className={`px-6 py-2 text-[13px] font-medium transition-colors border-b-2 cursor-pointer ${
                  currentFilter === "deactivated"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Deactivated
              </button>
              <button
                type="button"
                onClick={() => setCurrentFilter("archived")}
                className={`px-6 py-2 text-[13px] font-medium transition-colors border-b-2 cursor-pointer ${
                  currentFilter === "archived"
                    ? "text-brand-primary border-brand-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Archived
              </button>
            </div>
            {/* Full-width line below tabs */}
            <div className="h-px bg-border -mx-6"></div>
          </div>

          {/* Search and Create button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-border focus-visible:border-ring"
              />
            </div>
            <Button
              variant="lavender"
              onClick={() => setIsCreateSLADrawerOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create new SLA
            </Button>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border border-border/60 shadow-none overflow-hidden">
            {/* Table Header */}
            <div className="bg-brand-primary/10 px-6 py-3 border-b border-border/60">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-1">
                  <input type="checkbox" className="rounded border-border" />
                </div>
                <div className="col-span-4 flex items-center space-x-2">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center space-x-2 hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-medium text-foreground">Entity</span>
                    <SLASortIcon column="name" sortConfig={sortConfig} />
                  </button>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <button
                    onClick={() => handleSort("created")}
                    className="flex items-center space-x-2 hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-medium text-foreground">Created</span>
                    <SLASortIcon column="created" sortConfig={sortConfig} />
                  </button>
                </div>
                <div className="col-span-3">
                  <button
                    onClick={() => handleSort("agreementCategory")}
                    className="flex items-center space-x-2 hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-medium text-foreground">Agreement category</span>
                    <SLASortIcon column="agreementCategory" sortConfig={sortConfig} />
                  </button>
                </div>
                <div className="col-span-2"></div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border/60">
              {isLoading ? (
                <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">Loading SLAs...</div>
              ) : filteredAndSortedSLAs.length > 0 ? (
                filteredAndSortedSLAs.map((sla, index) => (
                <div key={index} className="px-6 py-4 hover:bg-[#f7f9ff]">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <input type="checkbox" className="rounded border-border" />
                    </div>
                    <div className="col-span-4 flex items-center space-x-3">
                      <Avatar className="size-8 rounded-[calc(var(--radius)*1/2.55)]">
                        <AvatarFallback
                          className="rounded-[calc(var(--radius)*1/2.55)] text-[13px] font-medium text-foreground font-['Outfit']"
                          style={{ backgroundColor: sla.color }}
                        >
                          {sla.initial}
                        </AvatarFallback>
                      </Avatar>
                      <Link
                        href={`/slas/${sla.id}`}
                        className="text-[13px] font-medium text-foreground hover:text-brand-primary transition-colors cursor-pointer"
                      >
                        {sla.name}
                      </Link>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[13px] text-muted-foreground">{sla.created}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-[13px] text-muted-foreground">{sla.agreementCategory}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end space-x-2">
                      <Link href={`/slas/${sla.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-muted-foreground border-border/60 hover:bg-muted bg-transparent"
                        >
                          See details
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-muted">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">No SLAs found</div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* CreateSLADrawer component */}
      <CreateSLADrawer
        isOpen={isCreateSLADrawerOpen}
        onClose={() => setIsCreateSLADrawerOpen(false)}
        onSubmit={handleCreateSLA}
      />
    </div>
  )
}
