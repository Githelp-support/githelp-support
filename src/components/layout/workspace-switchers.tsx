"use client"

import { useState, type ReactElement } from "react"
import { Icon } from "@/components/ui/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProjectBranding } from "@/hooks/useProject"
import { useWorkspaceSwitcher } from "@/hooks/useWorkspaceSwitcher"
import type { Database } from "@/types/database"
import { SQUIRCLE_RADIUS, squircleRadiusClass } from "@/lib/constants"

type Project = Database["public"]["Tables"]["projects"]["Row"]

// Corner radius per size class, from the shared squircle map (about 34% of the size).
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": SQUIRCLE_RADIUS[20],
  "w-[22px] h-[22px]": SQUIRCLE_RADIUS[22],
  "w-7 h-7": SQUIRCLE_RADIUS[28],
  "w-6 h-6": SQUIRCLE_RADIUS[24],
  "w-8 h-8": SQUIRCLE_RADIUS[32],
}

// Project Logo Component with Avatar Placeholder.
// See sidebar.tsx for the full rationale on keying the Radix Avatar Root.
const ProjectLogo = ({
  logoUrl,
  projectName,
  size = "w-6 h-6",
  primaryColor,
}: {
  logoUrl: string | null | undefined
  projectName: string
  size?: string
  primaryColor?: string | null
}) => {
  const firstLetter = projectName?.[0]?.toUpperCase() || "?"
  const radius = sizeRadiusMap[size] || squircleRadiusClass(0)
  const hasLogo = typeof logoUrl === "string" && logoUrl.length > 0

  return (
    <Avatar key={`${logoUrl ?? ""}|${projectName}`} className={`${size} ${radius}`}>
      {hasLogo ? <AvatarImage src={logoUrl as string} alt={projectName} /> : null}
      <AvatarFallback
        className={`${primaryColor ? "" : "bg-brand-primary"} text-brand-foreground text-xs ${radius} font-[family-name:var(--font-outfit)]`}
        style={primaryColor ? { backgroundColor: primaryColor } : undefined}
      >
        {firstLetter}
      </AvatarFallback>
    </Avatar>
  )
}

// Avatar-sized stand-in for the private user context in the project control.
const PrivateContextIcon = ({ size }: { size: string }) => (
  <span
    className={`${size} ${sizeRadiusMap[size] || squircleRadiusClass(0)} shrink-0 flex items-center justify-center bg-muted text-muted-foreground`}
  >
    <Icon name="fi-rr-lock" size={3.5} />
  </span>
)

type SwitcherVariant = "control" | "row"

// Sidebar (`row`) menu rows: a 28px image and the name, with a checkmark on the
// current one. 28px + py-1.5 makes each row 40px high.
const ROW_MENU_ITEM_CLASS = "gap-2.5 py-1.5"
const ROW_MENU_LABEL_CLASS = "min-w-0 truncate font-sans text-sm text-foreground"

const SelectedCheck = () => (
  <Icon name="fi-rr-check" className="ml-auto shrink-0 text-muted-foreground" />
)

// Component to render project logo with branding in dropdown
function ProjectLogoWithBranding({
  project,
  isSelected,
  onSelect,
  variant = "control",
}: {
  project: Project
  isSelected: boolean
  onSelect: (project: Project) => void
  /** `row` is the sidebar menu (28px logo, checkmark); `control` is the TopBar's (20px logo, brand tint). */
  variant?: SwitcherVariant
}) {
  const { data: branding } = useProjectBranding(project.project_id)
  const logoUrl = branding?.logo_url ?? null

  if (variant === "row") {
    return (
      <DropdownMenuItem onClick={() => onSelect(project)} className={ROW_MENU_ITEM_CLASS}>
        <ProjectLogo
          logoUrl={logoUrl}
          projectName={project.name}
          size="w-7 h-7"
          primaryColor={branding?.primary_color}
        />
        <span className={ROW_MENU_LABEL_CLASS}>{project.name}</span>
        {isSelected && <SelectedCheck />}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      onClick={() => onSelect(project)}
      className={`group gap-2 ${isSelected ? "bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary" : ""}`}
    >
      <ProjectLogo
        logoUrl={logoUrl}
        projectName={project.name}
        size="w-5 h-5"
        primaryColor={branding?.primary_color}
      />
      <span
        className={`font-sans truncate text-ui ${
          isSelected
            ? "font-book"
            : "font-book text-text-muted group-focus:text-sidebar-foreground"
        }`}
      >
        {project.name}
      </span>
    </DropdownMenuItem>
  )
}

// Sidebar switchers are flat: no border and no fill at rest, with the same
// grey fill on hover and while the menu is open.
const ROW_INTERACTION_CLASS =
  "cursor-pointer transition-colors duration-fast ease-out hover:bg-sidebar-control-hover data-[state=open]:bg-sidebar-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

// Role button: content-width, 32px high, 8px padding; the role name and a 14px chevron.
const ROLE_ROW_TRIGGER_CLASS = cn(
  "inline-flex h-8 w-auto shrink-0 items-center gap-1 rounded-md px-2",
  ROW_INTERACTION_CLASS,
)

// Project button: full width, 40px high, 6px padding, so the 28px image sits
// 6px from the left, top and bottom edges, 10px from the name.
const PROJECT_ROW_TRIGGER_CLASS = cn(
  "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5",
  ROW_INTERACTION_CLASS,
)
const PROJECT_ROW_LABEL_CLASS =
  "min-w-0 flex-1 truncate text-left font-sans text-sm font-medium text-foreground"

const SelectorIcon = () => (
  <Icon name="fi-rr-angle-small-down" className="shrink-0 text-text-tertiary" />
)

// Collapsed sidebar: logo only — no name, chevron, border or background.
const COLLAPSED_TRIGGER_CLASS =
  "mx-auto flex shrink-0 items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

const COLLAPSED_SIZE = "w-6 h-6"
// The collapsed sidebar shows the project image at the expanded row's 28px.
const ROW_COLLAPSED_SIZE = "w-7 h-7"

export function RoleSwitcher({
  variant = "control",
}: {
  /** `row` is the flat, content-width sidebar button; `control` is the compact TopBar trigger. */
  variant?: SwitcherVariant
}) {
  const { user, visibleRoles, isPrivateContext, getRoleDisplayName, handleSwitchRole, goToAddRole } =
    useWorkspaceSwitcher()
  const isRow = variant === "row"

  return (
    <DropdownMenu>
      {isRow ? (
        <DropdownMenuTrigger
          aria-label={`Switch role, current: ${getRoleDisplayName(user.role)}`}
          className={ROLE_ROW_TRIGGER_CLASS}
        >
          <span className="font-sans text-sm font-medium text-foreground">
            {getRoleDisplayName(user.role)}
          </span>
          <Icon name="fi-rr-angle-small-down" size={3.5} className="shrink-0 text-text-tertiary" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex items-center gap-1 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer font-sans">
          <span className="font-sans text-ui text-muted-foreground">{getRoleDisplayName(user.role)}</span>
          <Icon name="fi-rr-angle-small-down" className="text-muted-foreground" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-40">
        {visibleRoles.length > 0 ? (
          <>
            {visibleRoles.map((role) => {
              const isCurrent = role === user.role
              return (
                <DropdownMenuItem
                  key={role}
                  onClick={() => handleSwitchRole(role)}
                  className={cn(
                    "cursor-pointer flex items-center justify-between",
                    isRow ? "min-h-8.5 font-sans text-sm text-foreground" : "text-ui",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{getRoleDisplayName(role)}</span>
                  </span>
                  {isCurrent && <Icon name="fi-rr-check" className="text-muted-foreground" />}
                </DropdownMenuItem>
              )
            })}
          </>
        ) : null}
        {isPrivateContext && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer font-sans text-ui text-brand-primary"
              onClick={goToAddRole}
            >
              <Icon name="fi-rr-plus" />
              New role
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const TRIGGER_CLASS =
  "flex min-w-0 max-w-full items-center justify-between gap-2 px-3 h-9 bg-bg-subtle border border-border-subtle hover:border-brand-primary/30 hover:bg-muted rounded-lg transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

/**
 * Dropdown trigger for the project/context control. Expanded it is the bordered
 * pill with logo, name and chevron (`control`, TopBar) or the flat, borderless
 * sidebar row with a 28px image and a single down arrow (`row`); collapsed it
 * is just the logo (28px in the sidebar), with the name in the shared Tooltip. Must be rendered inside a `DropdownMenu`.
 */
function SwitcherTrigger({
  collapsed,
  variant,
  className,
  name,
  logo,
}: {
  collapsed: boolean
  variant: SwitcherVariant
  className?: string
  name: string
  logo: (size: string) => ReactElement
}) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={name} className={cn(COLLAPSED_TRIGGER_CLASS, className)}>
              {logo(variant === "row" ? ROW_COLLAPSED_SIZE : COLLAPSED_SIZE)}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {name}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (variant === "row") {
    return (
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(PROJECT_ROW_TRIGGER_CLASS, className)}>
          {logo("w-7 h-7")}
          <span className={PROJECT_ROW_LABEL_CLASS}>{name}</span>
          <SelectorIcon />
        </button>
      </DropdownMenuTrigger>
    )
  }

  // The name is capped so the TopBar control stays compact; a caller that asks
  // for a full-width trigger lets the name use all of it.
  const fullWidth = /(^|\s)w-full(\s|$)/.test(className ?? "")

  return (
    <DropdownMenuTrigger asChild>
      <button type="button" className={cn(TRIGGER_CLASS, className)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {logo("w-[22px] h-[22px]")}
          <span
            className={cn(
              "font-sans text-ui font-medium text-sidebar-foreground truncate",
              !fullWidth && "max-w-[32vw] md:max-w-[16rem]",
            )}
          >
            {name}
          </span>
        </div>
        <Icon name="fi-rr-angle-small-down" className="text-muted-foreground flex-shrink-0" />
      </button>
    </DropdownMenuTrigger>
  )
}

export function ProjectSwitcher({
  collapsed = false,
  variant = "control",
  className,
}: {
  /** Logo-only trigger for the collapsed sidebar; the menu opens to the right. */
  collapsed?: boolean
  /** `row` is the flat sidebar row (and its 28px collapsed logo); `control` is the bordered TopBar pill. */
  variant?: SwitcherVariant
  className?: string
}) {
  const {
    userProjects,
    projectsLoading,
    selectedProject,
    selectedProjectBranding,
    isPrivateContext,
    handleProjectSelect,
    goToAddRole,
  } = useWorkspaceSwitcher()
  const [employerTipOpen, setEmployerTipOpen] = useState(false)

  const contentPosition = collapsed
    ? ({ side: "right", align: "start", sideOffset: 8 } as const)
    : ({ align: "start" } as const)
  const isRow = variant === "row"
  // The expanded sidebar menu is as wide as its trigger row.
  const contentClass = cn(isRow && !collapsed ? "w-(--radix-dropdown-menu-trigger-width)" : "w-56", "font-sans")

  // User context dropdown (User role) — styled like the project dropdown.
  // "Private" is the only context today; in time the user will be able to
  // switch to an employer they are verified to operate under ("Add employer"
  // is a placeholder that explains this on hover/tap). No projects and no
  // "Add new" here: projects belong to the admin/helper roles.
  if (isPrivateContext) {
    return (
      <DropdownMenu onOpenChange={(open) => !open && setEmployerTipOpen(false)}>
        <SwitcherTrigger
          collapsed={collapsed}
          variant={variant}
          className={className}
          name="Private"
          logo={(size) => <PrivateContextIcon size={size} />}
        />
        <DropdownMenuContent
          {...contentPosition}
          className={contentClass}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {isRow ? (
            <DropdownMenuItem className={ROW_MENU_ITEM_CLASS}>
              <PrivateContextIcon size="w-7 h-7" />
              <span className={ROW_MENU_LABEL_CLASS}>Private</span>
              <SelectedCheck />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="group gap-2 bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary">
              <PrivateContextIcon size="w-5 h-5" />
              <span className="font-sans truncate text-ui font-book">Private</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <Tooltip open={employerTipOpen} onOpenChange={setEmployerTipOpen}>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                className="font-sans text-ui text-brand-primary"
                // Keep the menu open and show the explanation on tap as
                // well as on hover.
                onSelect={(e) => {
                  e.preventDefault()
                  setEmployerTipOpen(true)
                }}
              >
                <Icon name="fi-rr-plus" />
                Add employer
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              We do not support the possibility to connect your account to an employer at the moment.
              This functionality will be released in the coming months.
            </TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (projectsLoading) {
    if (collapsed) {
      const size = isRow ? ROW_COLLAPSED_SIZE : COLLAPSED_SIZE
      return <Skeleton className={cn("mx-auto", size, sizeRadiusMap[size], className)} />
    }
    return (
      <div
        className={cn(
          isRow
            ? "flex h-10 items-center rounded-lg px-1.5"
            : "flex items-center justify-center px-3 h-9 bg-bg-subtle border border-border-subtle rounded-lg",
          className,
        )}
      >
        <div className="font-sans text-ui text-muted-foreground">Loading projects...</div>
      </div>
    )
  }

  if (userProjects.length === 0) return null

  return (
    <DropdownMenu>
      <SwitcherTrigger
        collapsed={collapsed}
        variant={variant}
        className={className}
        name={selectedProject?.name || "Select Project"}
        logo={(size) => (
          <ProjectLogo
            logoUrl={selectedProject ? (selectedProjectBranding?.logo_url ?? null) : null}
            projectName={selectedProject?.name || ""}
            size={size}
            primaryColor={selectedProjectBranding?.primary_color}
          />
        )}
      />
      <DropdownMenuContent
        {...contentPosition}
        className={contentClass}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Scrollable project list — capped at three rows (3 × 32px in the
            TopBar, 3 × 40px in the sidebar) so the separator and "Add new"
            below always stay visible. */}
        <div className={cn("overflow-y-auto", isRow ? "max-h-30" : "max-h-24")}>
          {userProjects.map((project) => {
            const isSelected = selectedProject?.project_id === project.project_id
            return (
              <ProjectLogoWithBranding
                key={project.project_id}
                project={project}
                isSelected={isSelected}
                variant={variant}
                onSelect={handleProjectSelect}
              />
            )
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="font-sans text-ui text-brand-primary" onClick={goToAddRole}>
          <Icon name="fi-rr-plus" />
          Add new
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
