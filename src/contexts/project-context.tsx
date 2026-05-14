"use client"

import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react"
import { useUserProjects } from "@/hooks/useProject"

interface ProjectContextValue {
  selectedProjectId: string | null
  setSelectedProjectId: (projectId: string | null) => void
  /** True once we've loaded user projects and applied a default selection if needed */
  isReady: boolean
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

// sessionStorage keeps each browser tab independent; localStorage is only used
// as a fallback default for *fresh* tabs (so reopening the app lands you on
// your last project). Live tabs do NOT sync to each other — that previously
// caused flicker when changing project in one tab while another was open.
const STORAGE_KEY = "selectedProjectId"

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjects()
  const hasInitialized = useRef(false)

  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    if (selectedProjectId) {
      sessionStorage.setItem(STORAGE_KEY, selectedProjectId)
      localStorage.setItem(STORAGE_KEY, selectedProjectId)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedProjectId])

  // Sync selected project when project list loads or changes (e.g. user removed from project)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (projectsLoading) return
    if (hasInitialized.current) {
      if (userProjects.length === 0) {
        setSelectedProjectIdState(null)
        return
      }
      const exists = selectedProjectId && userProjects.some((p) => p.project_id === selectedProjectId)
      if (!exists && selectedProjectId) {
        setSelectedProjectIdState(null)
      }
      return
    }

    hasInitialized.current = true

    if (userProjects.length === 0) {
      setSelectedProjectIdState(null)
      return
    }

    const exists = selectedProjectId && userProjects.some((p) => p.project_id === selectedProjectId)
    if (!exists) {
      setSelectedProjectIdState(userProjects[0].project_id)
    }
  }, [projectsLoading, userProjects, selectedProjectId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const value = useMemo<ProjectContextValue>(
    () => ({
      selectedProjectId,
      setSelectedProjectId: setSelectedProjectIdState,
      isReady: !projectsLoading,
    }),
    [selectedProjectId, projectsLoading]
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectSelection() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjectSelection must be used within a ProjectProvider")
  return ctx
}
