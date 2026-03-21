"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

interface HelperInviteAcceptanceProps {
    onComplete: () => void
    projectName: string
}

export function HelperInviteAcceptance({ onComplete, projectName }: HelperInviteAcceptanceProps) {
    const [name, setName] = useState("")
    const [githubUsername, setGithubUsername] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error("User not authenticated")
            }

            // Update users_public with name and optional GitHub username
            const { error: updateError } = await supabase
                .from("users_public")
                .update({
                    name: name.trim(),
                    username: githubUsername.trim() || null,
                })
                .eq("id", user.id)

            if (updateError) {
                throw updateError
            }

            onComplete()
        } catch (err: unknown) {
            console.error("Error updating profile:", err)
            setError(err instanceof Error ? err.message : "Failed to update profile")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Complete your profile</CardTitle>
                <CardDescription>
                    To join {projectName} as a helper, we need some information about you.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">
                            Full name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            required
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="github" className="text-sm font-medium">
                            GitHub username <span className="text-gray-400">(optional)</span>
                        </label>
                        <Input
                            id="github"
                            type="text"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            placeholder="johndoe"
                            className="w-full"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isSubmitting || !name.trim()}
                        className="w-full bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Continue"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
