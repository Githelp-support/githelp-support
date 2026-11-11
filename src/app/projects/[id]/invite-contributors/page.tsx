"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    useProject,
    useListRepoContributors,
    useGetProjectRepo,
    useCreateProjectInvite,
} from "@/hooks/useProject"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useAddSelfAsHelper } from "@/hooks/useHelpers"
import { useUser } from "@/contexts/user-context"
import { supabase } from "@/lib/supabase/client"
import { getFunctionErrorMessage } from "@/lib/functions-error"
import { Loader2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import Link from "next/link"
import { ContributorsStep } from "./contributors-step"
import { InviteLinksStep } from "./invite-links-step"

const baseUrl =
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://app.githelp.app"

const STEP_PARAM = "step"
const LINKS_STEP = "links"

export default function InviteContributorsPage() {
    const params = useParams()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const repoFromQuery = searchParams.get("repo")

    // All invite state lives here (not in the step components) so that moving
    // between steps with the `step` search param keeps links, invited logins
    // and the current selection intact; the page stays mounted across pushes.
    const [githubToken, setGithubToken] = useState<string | null>(null)
    // The signed-in user's GitHub login, so their own row in the contributor
    // list can be added as a helper directly instead of producing an invite.
    const [selfLogin, setSelfLogin] = useState<string | null>(null)
    const [selectedContributors, setSelectedContributors] = useState<Set<string>>(new Set())
    const [invitedLogins, setInvitedLogins] = useState<Set<string>>(new Set())
    const [inviteLinks, setInviteLinks] = useState<Map<string, string>>(new Map())
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const [search, setSearch] = useState("")

    const { data: project, isLoading: projectLoading } = useProject(projectId)
    // Inviting helpers is an admin action (create-project-invite returns 403
    // otherwise), so gate the whole page on the caller's role in this project.
    const { data: projectRole, isLoading: roleLoading } = useProjectRole(projectId)
    const isProjectAdmin = projectRole === "admin"
    const { data: repoFullName } = useGetProjectRepo(repoFromQuery || !isProjectAdmin ? null : projectId)
    const fullName = repoFromQuery ?? repoFullName ?? null

    const { data: contributors = [], isLoading: contributorsLoading } = useListRepoContributors(
        isProjectAdmin ? githubToken : null,
        fullName
    )

    const createInvite = useCreateProjectInvite()
    const addSelfAsHelper = useAddSelfAsHelper()
    const { user } = useUser()
    const { data: currentHelperId } = useCurrentHelper(isProjectAdmin ? projectId : undefined)
    const selfIsHelper = !!currentHelperId

    const isSelfLogin = useCallback(
        (login: string) => !!selfLogin && login.toLowerCase() === selfLogin.toLowerCase(),
        [selfLogin]
    )

    // The links step is only meaningful once there is something to show; a
    // fresh load of `?step=links` (state is gone) falls back to step 1.
    const hasLinks = inviteLinks.size > 0
    const step = searchParams.get(STEP_PARAM) === LINKS_STEP && hasLinks ? "links" : "contributors"

    const goToStep = useCallback(
        (target: "contributors" | "links") => {
            const next = new URLSearchParams(searchParams.toString())
            if (target === "links") {
                next.set(STEP_PARAM, LINKS_STEP)
            } else {
                next.delete(STEP_PARAM)
            }
            const query = next.toString()
            router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
        },
        [pathname, router, searchParams]
    )

    useEffect(() => {
        const checkGithubSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            const providers = session?.user?.app_metadata?.providers as string[] | undefined
            const hasGithub = providers?.includes("github")
            const token = hasGithub && session?.provider_token ? session.provider_token : null
            setGithubToken(token)

            if (!session?.user || !hasGithub) {
                setSelfLogin(null)
                return
            }
            const githubIdentity = session.user.identities?.find(
                (identity) => identity.provider === "github"
            )
            const idData = githubIdentity?.identity_data as Record<string, unknown> | undefined
            const fromIdentity =
                (typeof idData?.user_name === "string" ? idData.user_name : undefined) ??
                (typeof idData?.preferred_username === "string" ? idData.preferred_username : undefined)
            setSelfLogin(
                fromIdentity ?? (session.user.user_metadata?.user_name as string | undefined) ?? null
            )
        }
        checkGithubSession()
    }, [])

    const toggleContributor = (login: string) => {
        setSelectedContributors((prev) => {
            const next = new Set(prev)
            if (next.has(login)) {
                next.delete(login)
            } else {
                next.add(login)
            }
            return next
        })
    }

    // Search filters the rendered list by login; "Select all" only acts on
    // what is visible so a narrowed list never selects hidden rows.
    const normalizedSearch = search.trim().toLowerCase()
    const visibleContributors = useMemo(
        () =>
            normalizedSearch
                ? contributors.filter((c) => c.login.toLowerCase().includes(normalizedSearch))
                : contributors,
        [contributors, normalizedSearch]
    )

    // Invited rows and the current user (once they already are a helper)
    // cannot be selected.
    const selectableVisible = useMemo(
        () =>
            visibleContributors.filter(
                (c) => !invitedLogins.has(c.login) && !(selfIsHelper && isSelfLogin(c.login))
            ),
        [visibleContributors, invitedLogins, selfIsHelper, isSelfLogin]
    )
    const allVisibleSelected =
        selectableVisible.length > 0 && selectableVisible.every((c) => selectedContributors.has(c.login))

    const selectAll = () => {
        setSelectedContributors((prev) => {
            const next = new Set(prev)
            for (const c of selectableVisible) {
                if (allVisibleSelected) {
                    next.delete(c.login)
                } else {
                    next.add(c.login)
                }
            }
            return next
        })
    }

    const handleInviteSelected = async () => {
        if (!projectId || selectedContributors.size === 0) return

        const toInvite = contributors.filter((c) => selectedContributors.has(c.login))
        const errors: string[] = []
        let lastErrorMessage: string | null = null
        let created = 0
        let addedSelf = false
        let invited = 0

        for (const contributor of toInvite) {
            const isSelf = isSelfLogin(contributor.login)
            try {
                if (isSelf) {
                    // Selecting yourself adds you as a helper directly (same as
                    // "Add myself as helper" on the Helpers page); no invite
                    // link is produced.
                    if (!user.id) throw new Error("You must be signed in to add yourself as a helper")
                    await addSelfAsHelper.mutateAsync({
                        project_id: projectId,
                        user_id: user.id,
                        category: "core",
                    })
                    addedSelf = true
                } else {
                    const result = await createInvite.mutateAsync({
                        project_id: projectId,
                        invite_type: "helper",
                        category: "core",
                        github_username: contributor.login,
                    })
                    const invite = result as { token: string; invite_url?: string }
                    const url = invite.invite_url ?? `${baseUrl}/invite/${invite.token}`
                    setInviteLinks((prev) => new Map(prev).set(contributor.login, url))
                    created++
                    invited++
                }
                setInvitedLogins((prev) => new Set([...prev, contributor.login]))
                setSelectedContributors((prev) => {
                    const next = new Set(prev)
                    next.delete(contributor.login)
                    return next
                })
            } catch (err) {
                errors.push(isSelf ? "you" : contributor.login)
                lastErrorMessage = await getFunctionErrorMessage(
                    err,
                    isSelf ? "Failed to add you as a helper" : "Failed to create invite"
                )
            }
        }

        if (errors.length > 0) {
            toast.error(`Failed to invite: ${errors.join(", ")}`, {
                description: lastErrorMessage ?? undefined,
            })
        } else if (addedSelf && invited === 0) {
            toast.success("You were added as a helper")
        } else if (addedSelf) {
            toast.success(`You were added as a helper and ${invited} contributor(s) invited as helpers`)
        } else {
            toast.success(`Invited ${invited} contributor(s) as helpers`)
        }

        // Show the links for whatever was created, even if some invites failed.
        if (created > 0) goToStep("links")
    }

    const copyInviteUrl = (url: string) => {
        navigator.clipboard.writeText(url)
        setCopiedUrl(url)
        toast.success("Invite link copied!")
        setTimeout(() => setCopiedUrl(null), 2000)
    }

    const hasInvited = invitedLogins.size > 0

    if (projectLoading || roleLoading) {
        return (
            <div className="h-full flex justify-center overflow-y-auto bg-muted/50 px-4 py-8">
                <Loader2 className="my-auto w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!project || !isProjectAdmin) {
        return (
            <div className="h-full flex justify-center overflow-y-auto bg-muted/50 px-4 py-8">
                <Card className="my-auto w-full max-w-md">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <Icon name="fi-rr-shield-exclamation" size={6} className="text-status-warning-text" />
                            <CardTitle>{project ? "Not authorized" : "Project not found"}</CardTitle>
                        </div>
                        <CardDescription>
                            {project
                                ? `Only admins of ${project.name} can invite contributors as helpers.`
                                : "This project does not exist or you do not have access to it."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-3">
                        {project && (
                            <Button variant="outline" asChild className="flex-1">
                                <Link href={`/projects/${projectId}`}>Back to project</Link>
                            </Button>
                        )}
                        <Button asChild className="flex-1">
                            <Link href="/">Go to dashboard</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-full flex justify-center overflow-y-auto bg-muted/50 px-4 py-8">
            <Card className="my-auto w-full max-w-2xl">
                {step === "links" ? (
                    <InviteLinksStep inviteLinks={inviteLinks} copiedUrl={copiedUrl} onCopy={copyInviteUrl} />
                ) : (
                    <ContributorsStep
                        fullName={fullName}
                        githubToken={githubToken}
                        contributors={contributors}
                        visibleContributors={visibleContributors}
                        search={search}
                        onSearchChange={setSearch}
                        allVisibleSelected={allVisibleSelected}
                        hasSelectableVisible={selectableVisible.length > 0}
                        contributorsLoading={contributorsLoading}
                        selectedContributors={selectedContributors}
                        invitedLogins={invitedLogins}
                        selfLogin={selfLogin}
                        selfIsHelper={selfIsHelper}
                        isInviting={createInvite.isPending || addSelfAsHelper.isPending}
                        onToggle={toggleContributor}
                        onSelectAll={selectAll}
                        onInvite={handleInviteSelected}
                    />
                )}

                <CardContent className="flex flex-wrap items-center gap-3 pt-2.5">
                    {step === "links" ? (
                        <>
                            <Button variant="outline" onClick={() => goToStep("contributors")}>
                                <Icon name="fi-rr-arrow-left" />
                                Back to list of contributors
                            </Button>
                            <Button variant="brand" asChild className="ml-auto">
                                <Link href="/">Go to project dashboard</Link>
                            </Button>
                        </>
                    ) : hasLinks ? (
                        <>
                            <Button variant="outline" asChild>
                                <Link href="/">Go to project dashboard</Link>
                            </Button>
                            <Button variant="brand" className="ml-auto" onClick={() => goToStep("links")}>
                                See invited helpers
                                <Icon name="fi-rr-arrow-right" />
                            </Button>
                        </>
                    ) : (
                        <Button variant="brand" asChild className="ml-auto">
                            <Link href="/">{hasInvited ? "Go to project dashboard" : "Add helpers later"}</Link>
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
