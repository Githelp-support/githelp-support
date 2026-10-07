"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Shield, Wrench, LifeBuoy } from "lucide-react"
import type { UserRole } from "@/contexts/user-context"

/**
 * The three ways to use Githelp, with the explanation shown wherever the
 * user is asked to pick one: first-time onboarding, "Add a new role" and the
 * per-login "I am acting as" chooser.
 */
export const ROLE_OPTIONS: {
    role: UserRole
    title: string
    description: string
    icon: typeof Shield
}[] = [
    {
        role: "admin",
        title: "Admin",
        description:
            "I own or maintain a project and want to offer support for it on Githelp. Admins create the project, invite helpers, set prices and manage tickets.",
        icon: Shield,
    },
    {
        role: "helper",
        title: "Helper",
        description:
            "I know a project well and want to help its users and get paid for it. Helpers join an existing project and pick up support tickets.",
        icon: Wrench,
    },
    {
        role: "user",
        title: "User",
        description:
            "I need help with a project. Users browse projects on Githelp and open support tickets that the project's helpers answer.",
        icon: LifeBuoy,
    },
]

export function RoleOptionCards({
    roles,
    onSelect,
    disabled = false,
    busyRole = null,
    showIcons = false,
    hint,
}: {
    /** Which roles to offer, in display order. */
    roles: UserRole[]
    onSelect: (role: UserRole) => void
    disabled?: boolean
    /** Role whose card shows a spinner (an async selection in progress). */
    busyRole?: UserRole | null
    showIcons?: boolean
    /** Optional extra line under a card's description. */
    hint?: (role: UserRole) => ReactNode
}) {
    return (
        <>
            {ROLE_OPTIONS.filter((option) => roles.includes(option.role)).map((option) => {
                const Icon = option.icon
                const extra = hint?.(option.role)
                return (
                    <Button
                        key={option.role}
                        onClick={() => onSelect(option.role)}
                        disabled={disabled}
                        className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary whitespace-normal disabled:opacity-50"
                        variant="outline"
                    >
                        <div className="flex items-start gap-3 w-full">
                            {showIcons && <Icon className="w-6 h-6 shrink-0 mt-0.5 text-brand-primary" />}
                            <div className="flex-1">
                                <div className="font-semibold text-lg text-foreground">{option.title}</div>
                                <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
                                {extra ? <div className="text-xs text-muted-foreground mt-2">{extra}</div> : null}
                            </div>
                            {busyRole === option.role && (
                                <Loader2 className="w-5 h-5 mt-1 animate-spin text-muted-foreground shrink-0" />
                            )}
                        </div>
                    </Button>
                )
            })}
        </>
    )
}
