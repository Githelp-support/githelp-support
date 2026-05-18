"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    useProject,
    useListRepoContributors,
    useGetProjectRepo,
    useCreateProjectInvite,
    type RepoContributor,
} from "@/hooks/useProject"
import { supabase } from "@/lib/supabase/client"
import { Loader2, Check, Copy, Users, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"

const baseUrl =
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://app.githelp.app"

export default function InviteContributorsPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const repoFromQuery = searchParams.get("repo")

    const [githubToken, setGithubToken] = useState<string | null>(null)
    const [selectedContributors, setSelectedContributors] = useState<Set<string>>(new Set())
    const [invitedLogins, setInvitedLogins] = useState<Set<string>>(new Set())
    const [inviteLinks, setInviteLinks] = useState<Map<string, string>>(new Map())
    const [copiedToken, setCopiedToken] = useState<string | null>(null)

    const { data: project, isLoading: projectLoading } = useProject(projectId)
    const { data: repoFullName } = useGetProjectRepo(repoFromQuery ? null : projectId)
    const fullName = repoFromQuery ?? repoFullName ?? null

    const { data: contributors = [], isLoading: contributorsLoading } = useListRepoContributors(
        githubToken,
        fullName
    )

    const createInvite = useCreateProjectInvite()

    useEffect(() => {
        const checkGithubSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            const providers = session?.user?.app_metadata?.providers as string[] | undefined
            const hasGithub = providers?.includes("github")
            const token = hasGithub && session?.provider_token ? session.provider_token : null
            setGithubToken(token)
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

    const selectAll = () => {
        if (selectedContributors.size === contributors.length) {
            setSelectedContributors(new Set())
        } else {
            setSelectedContributors(new Set(contributors.map((c) => c.login)))
        }
    }

    const handleInviteSelected = async () => {
        if (!projectId || selectedContributors.size === 0) return

        const toInvite = contributors.filter((c) => selectedContributors.has(c.login))
        const errors: string[] = []

        for (const contributor of toInvite) {
            try {
                const result = await createInvite.mutateAsync({
                    project_id: projectId,
                    invite_type: "helper",
                    category: "core",
                    github_username: contributor.login,
                })
                const invite = result as { token: string; invite_url?: string }
                const url = invite.invite_url ?? `${baseUrl}/invite/${invite.token}`
                setInviteLinks((prev) => new Map(prev).set(contributor.login, url))
                setInvitedLogins((prev) => new Set([...prev, contributor.login]))
                setSelectedContributors((prev) => {
                    const next = new Set(prev)
                    next.delete(contributor.login)
                    return next
                })
            } catch (err) {
                errors.push(contributor.login)
            }
        }

        if (errors.length > 0) {
            toast.error(`Failed to invite: ${errors.join(", ")}`)
        } else {
            toast.success(`Invited ${toInvite.length} contributor(s) as helpers!`)
        }
    }

    const copyInviteUrl = (url: string) => {
        navigator.clipboard.writeText(url)
        setCopiedToken(url)
        toast.success("Invite link copied!")
        setTimeout(() => setCopiedToken(null), 2000)
    }

    const hasInvited = invitedLogins.size > 0

    if (projectLoading || !project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold">
                                Invite contributors as helpers
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Select top contributors from {fullName || "your repository"} to invite as helpers.
                                They&apos;ll receive a unique link. If they sign in with GitHub, we&apos;ll match them automatically.
                            </CardDescription>
                        </div>
                        <Button variant="outline" asChild>
                            <Link href={`/projects/${projectId}`}>
                                <ArrowRight className="w-4 h-4 rotate-180" />
                                Back to project
                            </Link>
                        </Button>
                    </div>
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
                            <div className="flex items-center justify-between">
                                <Button variant="outline" size="sm" onClick={selectAll}>
                                    {selectedContributors.size === contributors.length
                                        ? "Deselect all"
                                        : "Select all"}
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {selectedContributors.size} selected
                                </span>
                            </div>

                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {contributors.map((c) => (
                                    <div
                                        key={c.login}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                            selectedContributors.has(c.login)
                                                ? "border-brand-primary bg-brand-primary/5"
                                                : "border-border hover:bg-muted/50"
                                        } ${invitedLogins.has(c.login) ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => !invitedLogins.has(c.login) && toggleContributor(c.login)}
                                                disabled={invitedLogins.has(c.login)}
                                                className="flex items-center gap-3 flex-1 text-left"
                                            >
                                                <Image
                                                    src={c.avatar_url}
                                                    alt={c.login}
                                                    width={40}
                                                    height={40}
                                                    className="rounded-full"
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{c.login}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {c.contributions} contributions
                                                    </div>
                                                </div>
                                            </button>
                                            {invitedLogins.has(c.login) && (
                                                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                                            )}
                                            {selectedContributors.has(c.login) && !invitedLogins.has(c.login) && (
                                                <div className="w-5 h-5 rounded border-2 border-brand-primary bg-brand-primary flex-shrink-0 flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={handleInviteSelected}
                                disabled={selectedContributors.size === 0 || createInvite.isPending}
                                className="w-full"
                            >
                                {createInvite.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Inviting...
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-4 h-4" />
                                        Invite {selectedContributors.size} as helpers
                                    </>
                                )}
                            </Button>

                            {hasInvited && inviteLinks.size > 0 && (
                                <div className="pt-4 border-t space-y-2">
                                    <p className="text-sm font-medium">Invite links (share with each contributor)</p>
                                    {Array.from(inviteLinks.entries()).map(([login, url]) => (
                                        <div
                                            key={login}
                                            className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                                        >
                                            <span className="font-medium w-24 truncate">{login}</span>
                                            <span className="flex-1 truncate text-muted-foreground">{url}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyInviteUrl(url)}
                                            >
                                                {copiedToken === url ? (
                                                    <Check className="w-4 h-4" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                    <p className="text-sm text-muted-foreground">
                                        Or they can sign in with GitHub to be matched automatically.
                                    </p>
                                    <Button variant="outline" asChild className="mt-2">
                                        <Link href="/helpers">Go to Helpers</Link>
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-4 border-t">
                        <Button asChild className="w-full">
                            <Link href="/">Continue to dashboard</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
