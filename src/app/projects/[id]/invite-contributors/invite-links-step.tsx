"use client"

import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"

interface InviteLinksStepProps {
    /** login → invite URL, in invite order. */
    inviteLinks: Map<string, string>
    copiedUrl: string | null
    onCopy: (url: string) => void
}

/**
 * Step 2 of the invite flow: the invite link for each contributor, with a copy
 * button. Presentational only; the page owns `inviteLinks`.
 */
export function InviteLinksStep({ inviteLinks, copiedUrl, onCopy }: InviteLinksStepProps) {
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
                <div className="space-y-2">
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
                    ))}
                </div>
            </CardContent>
        </>
    )
}
