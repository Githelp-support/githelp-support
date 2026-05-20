"use client"

import { Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useProjectSelection } from "@/contexts/project-context"
import { useProject, useUserProjects } from "@/hooks/useProject"

export function SandboxBanner() {
  const router = useRouter()
  const { selectedProjectId } = useProjectSelection()
  const { data: project } = useProject(selectedProjectId ?? "")
  const { data: userProjects } = useUserProjects()
  const bannerRef = useRef<HTMLDivElement | null>(null)

  const shouldRender = !!project?.sandbox

  useEffect(() => {
    if (!shouldRender) {
      document.documentElement.style.setProperty("--banner-height", "0px")
      return
    }

    const node = bannerRef.current
    if (!node) return

    const updateHeight = (height: number) => {
      document.documentElement.style.setProperty(
        "--banner-height",
        `${height}px`,
      )
    }

    // Measure the banner's full border-box height (padding + border included)
    // so the sidebar's `100vh - var(--banner-height)` keeps an identical
    // top/bottom spacing whether or not the banner is shown. ResizeObserver's
    // `contentRect` excludes padding/border, so re-measure with
    // getBoundingClientRect on every resize to stay consistent.
    updateHeight(node.getBoundingClientRect().height)

    const observer = new ResizeObserver(() => {
      updateHeight(node.getBoundingClientRect().height)
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty("--banner-height", "0px")
    }
  }, [shouldRender])

  if (!shouldRender) return null

  const activeProjects = (userProjects ?? []).filter((p) => !p.deleted_at)
  const hasOnlySandbox = activeProjects.length <= 1

  return (
    <div
      ref={bannerRef}
      className="w-full bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-6 py-2 flex items-center justify-between gap-4 text-sm text-amber-900 dark:text-amber-100"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Info className="w-4 h-4 shrink-0" />
        <span className="truncate">
          You are exploring a sandbox project. Data here is for demo purposes only.
        </span>
      </div>
      {hasOnlySandbox && (
        <Button
          variant="default"
          size="sm"
          className="bg-amber-900 hover:bg-amber-800 text-amber-50"
          onClick={() => router.push("/onboarding")}
        >
          Exit sandbox
        </Button>
      )}
    </div>
  )
}
