"use client"

import { ArrowLeft, Info } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { useProjectSelection } from "@/contexts/project-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backButtonText?: string
  backButtonHref?: string
  info?: string
  inlineRightContent?: ReactNode
  leadingIcon?: ReactNode
  className?: string
  /** Optional CSS background color to apply to the header container. Overrides the default `bg-background`. */
  backgroundColor?: string
  /** Optional classes merged onto the title <h1>. */
  titleClassName?: string
  /** Rendered above the title, e.g. a back link to the list the page was opened from. */
  aboveTitle?: ReactNode
  /** Page-level actions (e.g. the primary button), rendered right-aligned. */
  actions?: ReactNode
}

/**
 * The standard page header: title, optional subtitle and right-aligned actions,
 * sticky under the TopBar with a hairline below. Pages render it themselves
 * because it carries page-specific props; the Sidebar comes from AppShell.
 */
export function Header({ title, subtitle, showBackButton = false, backButtonText, backButtonHref, info, inlineRightContent, leadingIcon, className, backgroundColor, titleClassName, aboveTitle, actions }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const titleRowRef = useRef<HTMLDivElement>(null)
  const inlineRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { selectedProjectId } = useProjectSelection()
  const { data: projectRoleFromProject } = useProjectRole(selectedProjectId ?? undefined)
  const { setProjectRole } = useUser()
  const router = useRouter()
  const { confirmNavigation } = useUnsavedChanges()

  // Sync project role from selected project when on project-scoped pages (not support).
  // Support pages set their own projectRole from the support project.
  useEffect(() => {
    if (pathname?.startsWith("/support")) return
    if (selectedProjectId && projectRoleFromProject) {
      setProjectRole(projectRoleFromProject)
    } else if (!selectedProjectId) {
      setProjectRole(null)
    }
  }, [pathname, selectedProjectId, projectRoleFromProject, setProjectRole])

  // Routed through the unsaved-changes guard so the back button is intercepted
  // like link clicks are.
  const handleBackClick = () => {
    confirmNavigation(() => {
      if (backButtonHref) {
        router.push(backButtonHref)
      } else {
        router.back()
      }
    })
  }

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-30 shrink-0 border-b border-border-subtle px-8 py-5",
        !backgroundColor && "bg-background",
        className,
      )}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="flex items-center justify-between gap-8">
        <div className="flex min-w-0 items-start gap-4">
          {showBackButton && (
            <button
              onClick={handleBackClick}
              className="mt-1 flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors duration-fast ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              {backButtonText && (
                <span className="text-sm font-medium text-muted-foreground hover:text-foreground">{backButtonText}</span>
              )}
            </button>
          )}
          {leadingIcon && <div className="shrink-0 self-center">{leadingIcon}</div>}
          <div className="min-w-0">
            {aboveTitle && <div className="mb-2">{aboveTitle}</div>}
            <div ref={titleRowRef} className="flex items-center gap-3">
              <h1 className={cn("truncate text-title font-semibold text-foreground", titleClassName)}>{title}</h1>
              {info && (
                <div className="group relative">
                  <Info className="h-5 w-5 cursor-help text-muted-foreground" />
                  <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-64 rounded-md bg-foreground p-2 text-xs text-background shadow-popover group-hover:block">
                    {info}
                    <div className="absolute bottom-full left-4 h-0 w-0 border-b-4 border-l-4 border-r-4 border-transparent border-b-foreground" />
                  </div>
                </div>
              )}
              {inlineRightContent && (
                <div ref={inlineRef} className="flex items-center">
                  {inlineRightContent}
                </div>
              )}
            </div>
            {subtitle && (
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-ui font-normal text-muted-foreground">{subtitle}</p>
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
