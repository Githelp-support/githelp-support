"use client"

import { ArrowLeft, Info } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { useProjectSelection } from "@/contexts/project-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backButtonText?: string
  backButtonHref?: string
  info?: string
  inlineRightContent?: ReactNode
  className?: string
}

export function Header({ title, subtitle, showBackButton = false, backButtonText, backButtonHref, info, inlineRightContent, className }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const titleRowRef = useRef<HTMLDivElement>(null)
  const inlineRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { selectedProjectId } = useProjectSelection()
  const { data: projectRoleFromProject } = useProjectRole(selectedProjectId ?? undefined)
  const { setProjectRole } = useUser()
  const router = useRouter()

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

  const handleBackClick = () => {
    if (backButtonHref) {
      router.push(backButtonHref)
    } else {
      router.back()
    }
  }

  return (
    <header ref={headerRef} className={cn("sticky top-0 z-30 bg-background px-8 pt-5 pb-5", className)}>
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-start gap-4">
          {showBackButton && (
            <button
              onClick={handleBackClick}
              className="mt-1 p-1 hover:bg-muted rounded-md transition-colors cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              {backButtonText && (
                <span className="text-sm text-muted-foreground hover:text-foreground font-medium">{backButtonText}</span>
              )}
            </button>
          )}
          <div>
            <div ref={titleRowRef} className="flex items-center gap-[13px]">
              <h1 className="text-2xl font-semibold tracking-[0.005em] text-foreground">{title}</h1>
              {info && (
                <div className="relative group">
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-2 bg-foreground text-background text-sm rounded-md shadow-lg pointer-events-none">
                    {info}
                    <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-foreground" />
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
                <p className="text-[13px] font-normal text-muted-foreground/80">{subtitle}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
