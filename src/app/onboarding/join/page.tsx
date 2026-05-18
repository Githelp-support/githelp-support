"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Github, Loader2, Users, CheckCircle, ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { signInWithGitHub } from "@/lib/supabase/auth"
import { useListContributedProjects } from "@/hooks/useProject"
import { useCreatePendingRequest } from "@/hooks/usePendingRequests"
import { useOnboardingStatus, useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { toast } from "sonner"

export default function JoinProjectPage() {
    const router = useRouter()
    const [projectId, setProjectId] = useState("")
    const [githubToken, setGithubToken] = useState<string | null>(null)
    const [requestedProjectIds, setRequestedProjectIds] = useState<Set<string>>(new Set())
    const [requestingProjectId, setRequestingProjectId] = useState<string | null>(null)

    const { data: contributedProjects = [], isLoading: loadingContributed } = useListContributedProjects(githubToken)
    const createRequest = useCreatePendingRequest()
    const { data: onboardingStatus } = useOnboardingStatus()
    const completeOnboarding = useCompleteOnboarding()

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

    useEffect(() => {
        if (!githubToken || contributedProjects.length === 0) return

        const checkExistingRequests = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const ids = contributedProjects.map((p) => p.project_id)
            const { data } = await supabase
                .from("pending_user_requests")
                .select("project_id")
                .eq("user_id", user.id)
                .in("project_id", ids)

            if (data) {
                setRequestedProjectIds(new Set(data.map((r) => r.project_id)))
            }
        }

        checkExistingRequests()
    }, [githubToken, contributedProjects])

    const handleGoToProject = () => {
        if (projectId.trim()) {
            router.push(`/projects/${projectId.trim()}`)
        }
    }

    const handleConnectGitHub = () => {
        signInWithGitHub("/onboarding/join")
    }

    const handleRequestHelper = async (projectIdToRequest: string) => {
        setRequestingProjectId(projectIdToRequest)
        try {
            await createRequest.mutateAsync({ projectId: projectIdToRequest })

            if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
                await completeOnboarding.mutateAsync()
            }

            setRequestedProjectIds((prev) => new Set([...prev, projectIdToRequest]))
            toast.success("Request submitted! The project admin will review your request.")
        } catch (error: unknown) {
            console.error("Failed to create request:", error)
            toast.error(error instanceof Error ? error.message : "Failed to submit request. Please try again.")
        } finally {
            setRequestingProjectId(null)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Join an existing project</CardTitle>
                    <CardDescription>
                        Enter a project ID, or connect with GitHub to find projects you&apos;ve contributed to that are registered in the system.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="project-id">Project ID or Slug</Label>
                        <div className="flex gap-2">
                            <Input
                                id="project-id"
                                type="text"
                                placeholder="Enter project ID or slug"
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && projectId.trim()) {
                                        handleGoToProject()
                                    }
                                }}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleGoToProject}
                                disabled={!projectId.trim()}
                                variant="lavender"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Or ask a project admin for the project landing page URL
                        </p>
                    </div>

                    <div className="border-t pt-6 space-y-4">
                        <div>
                            <h3 className="font-medium text-foreground mb-1">Find projects you&apos;ve contributed to</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                See which of your GitHub contributions are registered as projects. Request to become a helper and the project admin can approve.
                            </p>
                            {!githubToken ? (
                                <Button
                                    onClick={handleConnectGitHub}
                                    variant="outline"
                                    className="w-full bg-[#24292e] hover:bg-[#1b1f23] text-white border-[#24292e]"
                                >
                                    <Github className="w-4 h-4" />
                                    Connect with GitHub
                                </Button>
                            ) : loadingContributed ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : contributedProjects.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4">
                                    No projects found that match repositories you&apos;ve contributed to. You can still join by entering a project ID above.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {contributedProjects.map((project) => {
                                        const hasRequested = requestedProjectIds.has(project.project_id)
                                        return (
                                            <div
                                                key={project.project_id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{project.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {project.repo_full_name}
                                                    </div>
                                                </div>
                                                {hasRequested ? (
                                                    <div className="flex items-center gap-2 text-sm text-green-600 flex-shrink-0">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Requested
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleRequestHelper(project.project_id)}
                                                        disabled={requestingProjectId === project.project_id}
                                                        className="flex-shrink-0"
                                                    >
                                                        {requestingProjectId === project.project_id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Users className="w-4 h-4" />
                                                                Request
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Button
                            onClick={() => router.push("/onboarding")}
                            variant="outline"
                            className="w-full"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
