"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useProjects } from "@/hooks/useProject"
import { cn } from "@/lib/utils"

interface NewTicketModalProps {
  isOpen: boolean
  onClose: () => void
}

const MIN_QUERY_LENGTH = 3
const MAX_SUGGESTIONS = 20

export function NewTicketModal({ isOpen, onClose }: NewTicketModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const { data: projects = [] } = useProjects({ enabled: isOpen })

  const suggestions = useMemo(() => {
    if (query.length < MIN_QUERY_LENGTH) return []
    const needle = query.toLowerCase()
    return projects
      .filter((project) => project.name?.toLowerCase().includes(needle))
      .slice(0, MAX_SUGGESTIONS)
  }, [projects, query])

  const selectedProject = useMemo(
    () => projects.find((project) => project.project_id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuery("")
      setSelectedProjectId(null)
      onClose()
    }
  }

  const handleClose = () => {
    setQuery("")
    setSelectedProjectId(null)
    onClose()
  }

  const handleGoToSupport = () => {
    if (!selectedProject) return
    router.push(`/support/${selectedProject.slug}`)
    handleClose()
  }

  const handleCreateTicketDirectly = () => {
    if (!selectedProject) return
    router.push(`/support/chat?project=${selectedProject.project_id}`)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <Input
            type="text"
            placeholder="Search for a project..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedProjectId(null)
            }}
            autoFocus
          />

          {selectedProject && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="lavender"
                className="flex-1"
                onClick={handleGoToSupport}
              >
                Go to the project&apos;s support page
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCreateTicketDirectly}
              >
                Create ticket directly
              </Button>
            </div>
          )}

          {query.length >= MIN_QUERY_LENGTH && (
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              {suggestions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No projects match your search.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {suggestions.map((project) => {
                    const isSelected = project.project_id === selectedProjectId
                    return (
                      <li key={project.project_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(project.project_id)}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-brand-primary/10 border-l-2 border-brand-primary text-brand-primary"
                              : "hover:bg-muted/50 text-foreground"
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                          {project.slug && (
                            <span
                              className={cn(
                                "ml-3 min-w-0 max-w-[45%] truncate text-xs",
                                isSelected ? "text-brand-primary/80" : "text-muted-foreground"
                              )}
                            >
                              {project.slug}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
