"use client"

import { useState, type ReactElement } from "react"
import { Icon, type IconProps } from "@/components/ui/icon"
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
import type { UserRole } from "@/contexts/user-context"
import type { Database } from "@/types/database"
import { SQUIRCLE_RADIUS, squircleRadiusClass } from "@/lib/constants"

type Project = Database["public"]["Tables"]["projects"]["Row"]

// Corner radius per size class, from the shared squircle map (about 34% of the size).
const sizeRadiusMap: Record<string, string> = {
  "w-5 h-5": SQUIRCLE_RADIUS[20],
  "w-[22px] h-[22px]": SQUIRCLE_RADIUS[22],
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
    <Icon name="fi-rr-lock" size={3} />
  </span>
)

// Component to render project logo with branding in dropdown
function ProjectLogoWithBranding({
  project,
  isSelected,
  onSelect,
}: {
  project: Project
  isSelected: boolean
  onSelect: (project: Project) => void
}) {
  const { data: branding } = useProjectBranding(project.project_id)
  const logoUrl = branding?.logo_url ?? null

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

type SwitcherVariant = "control" | "row"

// Sidebar switcher rows share the nav item geometry: 32px high, 10px from the
// edge to the icon slot (9px padding inside the 1px stroke), a 16px icon slot
// and a 12px gap, so the role tile, the project avatar and the nav icons sit on
// one vertical axis and every label starts at the same x. The tile and avatar
// are wider than the slot and overflow it evenly on both sides, which keeps
// them centred on that axis. The row is a container with a subtle stroke,
// filled with the sidebar surface around it.
const ROW_TRIGGER_CLASS =
  "flex h-8 w-full min-w-0 items-center gap-3 rounded-md border border-border-subtle bg-sidebar px-2.25 cursor-pointer transition-colors duration-fast ease-out hover:bg-surface-hover data-[state=open]:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
const ROW_SLOT_CLASS = "flex h-4 w-4 shrink-0 items-center justify-center"
const ROW_LABEL_CLASS =
  "min-w-0 flex-1 truncate text-left font-sans text-ui font-medium text-sidebar-foreground"

const SelectorIcon = () => (
  <Icon name="fi-rr-angle-small-down" className="shrink-0 text-text-tertiary" />
)

// Same icons as the role cards in onboarding (`RoleOptionCards`).
const ROLE_ICONS: Record<UserRole, IconProps["name"]> = {
  admin: "fi-rr-shield",
  helper: "fi-rr-wrench-simple",
  user: "fi-rr-life-ring",
}

// Role tile: the project avatar's squircle container, white with a dark glyph.
// The hairline keeps the white tile readable on the near-white sidebar.
const RoleIcon = ({ role, size = "w-[22px] h-[22px]" }: { role: UserRole; size?: string }) => (
  <span
    data-slot="role-icon"
    className={`${size} ${sizeRadiusMap[size] || squircleRadiusClass(0)} shrink-0 flex items-center justify-center border border-border-avatar bg-card text-foreground`}
  >
    <Icon name={ROLE_ICONS[role] ?? "fi-rr-user"} size={3} />
  </span>
)

export function RoleSwitcher({
  variant = "control",
}: {
  /** `row` is the outlined sidebar row with a role tile; `control` is the compact TopBar trigger. */
  variant?: SwitcherVariant
}) {
  const { user, visibleRoles, isPrivateContext, getRoleDisplayName, handleSwitchRole, goToAddRole } =
    useWorkspaceSwitcher()

  return (
    <DropdownMenu>
      {variant === "row" ? (
        <DropdownMenuTrigger className={ROW_TRIGGER_CLASS}>
          <span className={ROW_SLOT_CLASS}>
            <RoleIcon role={user.role} />
          </span>
          <span className={ROW_LABEL_CLASS}>{getRoleDisplayName(user.role)}</span>
          <SelectorIcon />
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
                  className="cursor-pointer text-ui flex items-center justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {variant === "row" && <RoleIcon role={role} size="w-5 h-5" />}
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

// Collapsed sidebar: logo only — no name, chevron, border or background.
const COLLAPSED_TRIGGER_CLASS =
  "mx-auto flex shrink-0 items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

const COLLAPSED_SIZE = "w-6 h-6"

/**
 * Dropdown trigger for the project/context control. Expanded it is the bordered
 * pill with logo, name and chevron (`control`, TopBar) or the outlined
 * sidebar row with a single down arrow (`row`); collapsed it is just the logo,
 * with the name in the shared Tooltip. Must be rendered inside a `DropdownMenu`.
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
              {logo(COLLAPSED_SIZE)}
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
        <button type="button" className={cn(ROW_TRIGGER_CLASS, className)}>
          <span className={ROW_SLOT_CLASS}>{logo("w-[22px] h-[22px]")}</span>
          <span className={ROW_LABEL_CLASS}>{name}</span>
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
  /** `row` is the outlined sidebar row; `control` is the bordered TopBar pill. */
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
          className="w-56 font-sans"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem className="group gap-2 bg-brand-primary/10 text-brand-primary focus:bg-brand-primary/15 focus:text-brand-primary">
            <PrivateContextIcon size="w-5 h-5" />
            <span className="font-sans truncate text-ui font-book">Private</span>
          </DropdownMenuItem>
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
      return <Skeleton className={cn("mx-auto", COLLAPSED_SIZE, sizeRadiusMap[COLLAPSED_SIZE], className)} />
    }
    return (
      <div
        className={cn(
          variant === "row"
            ? "flex h-8 items-center rounded-md border border-border-subtle bg-sidebar px-2.25"
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
        className="w-56 font-sans"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Scrollable project list — capped at three rows (3 × 32px) so the
            separator and "Add new" below always stay visible. */}
        <div className={cn("max-h-24 overflow-y-auto")}>
          {userProjects.map((project) => {
            const isSelected = selectedProject?.project_id === project.project_id
            return (
              <ProjectLogoWithBranding
                key={project.project_id}
                project={project}
                isSelected={isSelected}
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
