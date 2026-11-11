"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import type { RepoContributor } from "@/hooks/useProject"

interface InviteLinksStepProps {
    /** login → invite URL, in invite order. */
    inviteLinks: Map<string, string>
    /** Repo contributors, used to show each invited login's avatar. */
    contributors: RepoContributor[]
    copiedUrl: string | null
    onCopy: (url: string) => void
}

/**
 * Step 2 of the invite flow: the invite link for each contributor, with a copy
 * button. Presentational only; the page owns `inviteLinks`.
 */
export function InviteLinksStep({ inviteLinks, contributors, copiedUrl, onCopy }: InviteLinksStepProps) {
    const avatarByLogin = new Map(contributors.map((c) => [c.login, c.avatar_url]))

    return (
        <>
            <CardHeader>
                <CardTitle className="text-2xl font-medium">Invite links</CardTitle>
                <CardDescription className="mt-1">
                    Share each link with the contributor. Or they can sign in with GitHub to be matched
                    with the project automatically. Links are unique per person.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center">
                    <span className="ml-auto text-sm text-muted-foreground">
                        {inviteLinks.size} invited
                    </span>
                </div>
                <div className="space-y-2">
                    {Array.from(inviteLinks.entries()).map(([login, url]) => {
                        const avatarUrl = avatarByLogin.get(login)
                        return (
                            <div
                                key={login}
                                className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                            >
                                {avatarUrl && (
                                    <Image
                                        src={avatarUrl}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="rounded-full flex-shrink-0"
                                    />
                                )}
                                <span className="font-medium w-24 truncate">{login}</span>
                                <span className="flex-1 truncate text-muted-foreground">{url}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onCopy(url)}
                                    aria-label={`Copy invite link for ${login}`}
                                >
                                    {copiedUrl === url ? (
                                        <Icon name="fi-rr-check" />
                                    ) : (
                                        <Icon name="fi-rr-copy" />
                                    )}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </>
    )
}
