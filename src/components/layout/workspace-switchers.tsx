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
import type { UserRole } from "@/contexts/user-context"
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

// Icon tile of the sidebar picker rows (`variant="row"`): 24px, white, with the
// row's own subtle stroke and the control radius instead of the squircle. Shared
// by the role tile and the private-context tile so both pickers look identical;
// the project logo in the row takes the same size and radius.
const ROW_TILE_SIZE = "w-6 h-6"
const ROW_TILE_RADIUS = "rounded-md"
const ROW_TILE_CLASS = `${ROW_TILE_SIZE} ${ROW_TILE_RADIUS} shrink-0 flex items-center justify-center border border-border-subtle bg-card text-foreground`

// Project Logo Component with Avatar Placeholder.
// See sidebar.tsx for the full rationale on keying the Radix Avatar Root.
const ProjectLogo = ({
  logoUrl,
  projectName,
  size = "w-6 h-6",
  primaryColor,
  row = false,
}: {
  logoUrl: string | null | undefined
  projectName: string
  size?: string
  primaryColor?: string | null
  /** Sidebar picker row: the control radius instead of the squircle. */
  row?: boolean
}) => {
  const firstLetter = projectName?.[0]?.toUpperCase() || "?"
  const radius = row ? ROW_TILE_RADIUS : sizeRadiusMap[size] || squircleRadiusClass(0)
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
// In the sidebar picker row it is the shared white bordered tile.
const PrivateContextIcon = ({ size, row = false }: { size: string; row?: boolean }) => (
  <span
    data-slot="private-context-icon"
    className={
      row
        ? ROW_TILE_CLASS
        : `${size} ${sizeRadiusMap[size] || squircleRadiusClass(0)} shrink-0 flex items-center justify-center bg-muted text-muted-foreground`
    }
  >
    <Icon name="fi-rr-lock" size={3.5} />
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

// Sidebar switcher rows: a 40px-high white container with the subtle stroke and
// the card radius (8px), 8px of padding inside the stroke, a 24px icon tile and
// a 10px gap to the 14px label; the chevron is right-aligned. The slot is the
// tile's own size, so nothing overflows it. The tile is no longer centred on the
// 16px nav icon axis (it starts 9px from the row's edge and is 24px wide); that
// offset from the logo and the nav icons is intended.
const ROW_TRIGGER_CLASS =
  "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg border border-border-subtle bg-card px-2 cursor-pointer transition-colors duration-fast ease-out hover:bg-surface-hover data-[state=open]:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
const ROW_SLOT_CLASS = "flex h-6 w-6 shrink-0 items-center justify-center"
const ROW_LABEL_CLASS =
  "min-w-0 flex-1 truncate text-left font-sans text-sm font-medium text-foreground"

const SelectorIcon = () => (
  <Icon name="fi-rr-angle-small-down" className="shrink-0 text-text-tertiary" />
)

// Githelp role glyphs (githelp-role-maintainer.svg, githelp-role-helper.svg,
// githelp-role-support-user.svg), inlined so they take the tile's text colour.
const ROLE_GLYPHS: Record<UserRole, ReactElement> = {
  admin: (
    <>
      <circle cx="19.5" cy="5.5" r="3.5" />
      <circle cx="4" cy="4" r="2.75" />
      <circle cx="4" cy="20.5" r="2" />
      <path d="M4 6.75v11.75" />
      <path d="M19.5 9v.5c0 4-2.5 5.5-7 5.5H8.5C6 15 4 16 4 17" />
    </>
  ),
  helper: (
    <>
      <circle cx="12" cy="12" r="11" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M15.2 8.8l4.6-4.6M8.8 8.8 4.2 4.2M15.2 15.2l4.6 4.6M8.8 15.2l-4.6 4.6" />
    </>
  ),
  user: (
    <>
      <path d="M10 5c.8 5.2 3.8 8.2 9 9-5.2.8-8.2 3.8-9 9-.8-5.2-3.8-8.2-9-9 5.2-.8 8.2-3.8 9-9z" />
      <path d="M19.5 1c.3 2.3 1.2 3.2 3.5 3.5-2.3.3-3.2 1.2-3.5 3.5-.3-2.3-1.2-3.2-3.5-3.5 2.3-.3 3.2-1.2 3.5-3.5z" />
    </>
  ),
}

// Glyph size per tile size: a little under two thirds of the tile.
const ROLE_GLYPH_SIZE: Record<string, string> = {
  "w-5 h-5": "size-3.25",
  "w-[22px] h-[22px]": "size-3.5",
  "w-6 h-6": "size-4",
  "w-7 h-7": "size-4.5",
}

// Role tile: the project avatar's squircle container, white with a dark glyph.
// The hairline keeps the white tile readable on the near-white sidebar. In the
// sidebar picker row it is the shared white bordered tile instead.
const RoleIcon = ({
  role,
  size = "w-[22px] h-[22px]",
  row = false,
}: {
  role: UserRole
  size?: string
  row?: boolean
}) => (
  <span
    data-slot="role-icon"
    className={
      row
        ? ROW_TILE_CLASS
        : `${size} ${sizeRadiusMap[size] || squircleRadiusClass(0)} shrink-0 flex items-center justify-center border border-border-avatar bg-card text-foreground`
    }
  >
    {ROLE_GLYPHS[role] ? (
      <svg
        aria-hidden="true"
        data-role-glyph={role}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("shrink-0", ROLE_GLYPH_SIZE[size] ?? "size-3.5")}
      >
        {ROLE_GLYPHS[role]}
      </svg>
    ) : (
      <Icon name="fi-rr-user" size={3.5} />
    )}
  </span>
)

// Collapsed sidebar: logo only — no name, chevron, border or background.
const COLLAPSED_TRIGGER_CLASS =
  "mx-auto flex shrink-0 items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

const COLLAPSED_SIZE = "w-6 h-6"

export function RoleSwitcher({
  variant = "control",
  collapsed = false,
}: {
  /** `row` is the outlined sidebar row with a role tile; `control` is the compact TopBar trigger. */
  variant?: SwitcherVariant
  /** Role-tile-only trigger for the collapsed sidebar; the menu opens to the right. */
  collapsed?: boolean
}) {
  const { user, visibleRoles, isPrivateContext, getRoleDisplayName, handleSwitchRole, goToAddRole } =
    useWorkspaceSwitcher()

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={getRoleDisplayName(user.role)}
                className={COLLAPSED_TRIGGER_CLASS}
              >
                <RoleIcon role={user.role} size={COLLAPSED_SIZE} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {getRoleDisplayName(user.role)}
          </TooltipContent>
        </Tooltip>
      ) : variant === "row" ? (
        <DropdownMenuTrigger className={ROW_TRIGGER_CLASS}>
          <span className={ROW_SLOT_CLASS}>
            <RoleIcon role={user.role} size={ROW_TILE_SIZE} row />
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
      <DropdownMenuContent
        align="start"
        {...(collapsed ? ({ side: "right", sideOffset: 8 } as const) : {})}
        // The sidebar row menu is as wide as its trigger row.
        className={variant === "row" && !collapsed ? "w-(--radix-dropdown-menu-trigger-width)" : "w-40"}
      >
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
  /** `row` is true for the sidebar picker row, which uses the shared row tile. */
  logo: (size: string, row?: boolean) => ReactElement
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
          <span className={ROW_SLOT_CLASS}>{logo(ROW_TILE_SIZE, true)}</span>
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
          logo={(size, row) => <PrivateContextIcon size={size} row={row} />}
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
            ? "flex h-10 items-center rounded-lg border border-border-subtle bg-card px-2"
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
        logo={(size, row) => (
          <ProjectLogo
            logoUrl={selectedProject ? (selectedProjectBranding?.logo_url ?? null) : null}
            projectName={selectedProject?.name || ""}
            size={size}
            primaryColor={selectedProjectBranding?.primary_color}
            row={row}
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
