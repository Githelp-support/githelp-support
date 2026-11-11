"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { RepoContributor } from "@/hooks/useProject"

interface ContributorsStepProps {
    fullName: string | null
    githubToken: string | null
    contributors: RepoContributor[]
    /** `contributors` narrowed by the search field; this is what gets rendered. */
    visibleContributors: RepoContributor[]
    search: string
    onSearchChange: (value: string) => void
    /** Every visible, still-selectable contributor is selected ("Deselect all"). */
    allVisibleSelected: boolean
    /** At least one visible row can still be selected. */
    hasSelectableVisible: boolean
    contributorsLoading: boolean
    selectedContributors: Set<string>
    invitedLogins: Set<string>
    /** GitHub login of the signed-in user, if known (matched case-insensitively). */
    selfLogin: string | null
    /** Whether the signed-in user already is a helper on this project. */
    selfIsHelper: boolean
    isInviting: boolean
    onToggle: (login: string) => void
    onSelectAll: () => void
    onInvite: () => void
}

/**
 * Step 1 of the invite flow: pick contributors and create their invites.
 * Presentational only; all state lives in the page so it survives navigating
 * between steps.
 */
export function ContributorsStep({
    fullName,
    githubToken,
    contributors,
    visibleContributors,
    search,
    onSearchChange,
    allVisibleSelected,
    hasSelectableVisible,
    contributorsLoading,
    selectedContributors,
    invitedLogins,
    selfLogin,
    selfIsHelper,
    isInviting,
    onToggle,
    onSelectAll,
    onInvite,
}: ContributorsStepProps) {
    const isSelf = (login: string) =>
        !!selfLogin && login.toLowerCase() === selfLogin.toLowerCase()
    const selectedSelfOnly =
        selectedContributors.size === 1 && isSelf([...selectedContributors][0])

    return (
        <>
            <CardHeader>
                <CardTitle className="text-2xl font-medium">
                    Invite contributors as helpers
                </CardTitle>
                <CardDescription className="mt-1">
                    Select top contributors from {fullName || "your repository"} to invite as helpers.
                    They&apos;ll receive a unique link. If they sign in with GitHub, we&apos;ll match them automatically.
                </CardDescription>
                <p className="text-ui text-text-muted">
                    From the Helpers page you can also invite helpers using email or invite link.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {!githubToken ? (
                    <p className="text-sm text-muted-foreground">
                        Connect with GitHub to see contributors.{" "}
                        <Link href="/" className="text-brand-primary hover:underline">
                            Go to dashboard
                        </Link>
                    </p>
                ) : !fullName ? (
                    <p className="text-sm text-muted-foreground">
                        This project is not linked to a GitHub repository. Contributors can only be invited from imported repos.
                    </p>
                ) : contributorsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : contributors.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                        No contributors found for this repository.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-56 max-sm:w-full">
                                <Icon
                                    name="fi-rr-search"
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                                />
                                <Input
                                    type="search"
                                    placeholder="Search contributors"
                                    aria-label="Search contributors"
                                    value={search}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="pl-8 placeholder:text-text-tertiary"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSelectAll}
                                disabled={!hasSelectableVisible}
                            >
                                {allVisibleSelected ? "Deselect all" : "Select all"}
                            </Button>
                            <span className="ml-auto text-sm text-muted-foreground">
                                {selectedContributors.size} selected
                            </span>
                        </div>

                        {visibleContributors.length === 0 ? (
                            <p className="text-ui text-text-muted py-4">
                                No contributors match &ldquo;{search.trim()}&rdquo;
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {visibleContributors.map((c) => {
                                    const self = isSelf(c.login)
                                    const alreadyHelper = self && selfIsHelper
                                    // A helper row is "done" like an invited one: disabled with a check.
                                    const invited = invitedLogins.has(c.login) || alreadyHelper
                                    const selected = selectedContributors.has(c.login)
                                    return (
                                        <div
                                            key={c.login}
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                                selected
                                                    ? "border-brand-primary bg-brand-primary/5"
                                                    : "border-border-subtle hover:bg-muted/50",
                                                invited && "opacity-60"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => !invited && onToggle(c.login)}
                                                    disabled={invited}
                                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                                >
                                                    <Image
                                                        src={c.avatar_url}
                                                        alt={c.login}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-full"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-sm font-medium truncate">{c.login}</span>
                                                            {self && <Badge variant="secondary">You</Badge>}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {c.contributions} contributions
                                                        </div>
                                                        {self && (
                                                            <div className="text-xs text-text-muted">
                                                                {alreadyHelper
                                                                    ? "Already a helper"
                                                                    : "Selecting yourself adds you as a helper directly"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                                {invited && (
                                                    <Icon name="fi-rr-check" size={5} className="text-status-success-text flex-shrink-0" />
                                                )}
                                                {selected && !invited && (
                                                    <div className="w-5 h-5 rounded border-2 border-brand-primary bg-brand-primary flex-shrink-0 flex items-center justify-center">
                                                        <Icon name="fi-rr-check" size={3} className="text-brand-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <Button
                            onClick={onInvite}
                            disabled={selectedContributors.size === 0}
                            loading={isInviting}
                            className="w-full"
                        >
                            <Icon name="fi-rr-user-add" />
                            {selectedSelfOnly
                                ? "Add myself as helper"
                                : `Invite ${selectedContributors.size} as helpers`}
                        </Button>
                    </>
                )}
            </CardContent>
        </>
    )
}
