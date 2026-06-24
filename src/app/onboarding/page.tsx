"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCreateProject, useListUserGithubRepos, useCreateProjectFromGitHub, useCreateSandboxProject, useHasSandbox } from "@/hooks/useProject"
import { useCompleteOnboarding, useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { useProjectSelection } from "@/contexts/project-context"
import { Loader2, Plus, Users, Github, ArrowLeft, Check, Search, FlaskConical } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { signInWithGitHub } from "@/lib/supabase/auth"
import { toast } from "sonner"

type OnboardingStep = "choose" | "create" | "create-manual" | "create-github" | "join"

export default function OnboardingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<OnboardingStep>("choose")
    const [projectName, setProjectName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [githubToken, setGithubToken] = useState<string | null>(null)
    const [repoSearch, setRepoSearch] = useState("")

    const queryClient = useQueryClient()
    const createProject = useCreateProject()
    const createFromGitHub = useCreateProjectFromGitHub()
    const createSandbox = useCreateSandboxProject()
    const { data: hasSandbox } = useHasSandbox()
    const completeOnboarding = useCompleteOnboarding()
    const { setSelectedProjectId } = useProjectSelection()
    const { data: onboardingStatus, isLoading: onboardingStatusLoading } = useOnboardingStatus()

    const { data: githubRepos = [], isLoading: isLoadingRepos } = useListUserGithubRepos(githubToken)

    const filteredRepos = repoSearch.trim()
        ? githubRepos.filter(
              (r) =>
                  r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
                  (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
          )
        : githubRepos

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
        if (searchParams.get("import") === "github") {
            setStep("create-github")
        }
    }, [searchParams])

    // CRM / admin-seeded users already have a project; this route is public so
    // AuthGuard does not redirect them away — send them to the app instead of
    // showing "Create or join" again.
    //
    // Do not use `!needsOnboarding` alone: when logged out, useOnboardingStatus
    // returns needsOnboarding: false (no user), which would wrongly redirect.
    const hasFinishedOnboardingWizard =
        onboardingStatus &&
        (onboardingStatus.isMember || onboardingStatus.onboardingCompleted)

    useEffect(() => {
        if (onboardingStatusLoading || !onboardingStatus) return
        const done =
            onboardingStatus.isMember || onboardingStatus.onboardingCompleted
        if (done) {
            router.replace("/")
        }
    }, [onboardingStatus, onboardingStatusLoading, router])

    const handleCreateProject = async () => {
        if (!projectName.trim()) {
            toast.error("Please enter a project name")
            return
        }

        setIsCreating(true)
        try {
            const slug = projectName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")

            const project = await createProject.mutateAsync({
                name: projectName.trim(),
                slug: slug || `project-${Date.now()}`,
                type: "repo",
                open_for_new_helpers: true,
            })

            await completeOnboarding.mutateAsync()
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["onboarding-status"] }),
                queryClient.refetchQueries({ queryKey: ["user-projects"] }),
            ])

            setSelectedProjectId(project.project_id)
            toast.success("Project created successfully!")
            router.push("/")
        } catch (error: unknown) {
            console.error("Failed to create project:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create project. Please try again.")
        } finally {
            setIsCreating(false)
        }
    }

    const handleConnectGitHub = () => {
        signInWithGitHub("/onboarding?import=github")
    }

    const handleReauthorizeGitHub = () => {
        signInWithGitHub("/onboarding?import=github", { skipCache: true })
    }

    const handleImportFromGitHub = async (repo: { id: number; full_name: string; html_url: string; owner: string; name: string }) => {
        setIsCreating(true)
        try {
            const result = await createFromGitHub.mutateAsync({
                github_repo_id: repo.id,
                repo: {
                    id: repo.id,
                    name: repo.name,
                    full_name: repo.full_name,
                    html_url: repo.html_url,
                    owner: { login: repo.owner, type: "User" },
                },
            })

            await completeOnboarding.mutateAsync()
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["onboarding-status"] }),
                queryClient.refetchQueries({ queryKey: ["user-projects"] }),
            ])

            setSelectedProjectId(result.project.project_id)
            toast.success("Project imported from GitHub successfully!")
            router.push(`/projects/${result.project.project_id}/invite-contributors?repo=${encodeURIComponent(repo.full_name)}`)
        } catch (error: unknown) {
            console.error("Failed to import project:", error)
            toast.error(error instanceof Error ? error.message : "Failed to import project. Please try again.")
        } finally {
            setIsCreating(false)
        }
    }

    const handleCreateSandbox = async () => {
        setIsCreating(true)
        try {
            // The edge function provisions the demo data and marks onboarding
            // complete server-side, so we only refetch to pick up the changes.
            const result = await createSandbox.mutateAsync()

            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["onboarding-status"] }),
                queryClient.refetchQueries({ queryKey: ["user-projects"] }),
            ])

            setSelectedProjectId(result.project.project_id)
            toast.success("Sandbox ready! Explore your demo project.")
            router.push("/")
        } catch (error: unknown) {
            console.error("Failed to create sandbox:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create sandbox. Please try again.")
        } finally {
            setIsCreating(false)
        }
    }

    const handleJoinProject = () => {
        router.push("/onboarding/join")
    }

    if (onboardingStatusLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        )
    }

    if (hasFinishedOnboardingWizard) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted/50 p-4">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                <p className="text-sm text-muted-foreground">Taking you to your workspace…</p>
            </div>
        )
    }

    if (step === "choose") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Welcome! Let&apos;s get you started</CardTitle>
                        <CardDescription className="text-sm mt-2">
                            Choose how you&apos;d like to get started with Githelp
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={() => setStep("create")}
                            className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <Plus className="w-6 h-6 text-brand-primary" />
                                <div>
                                    <div className="font-semibold text-lg text-foreground">Create a new project</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Start your own project and invite helpers
                                    </div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={handleJoinProject}
                            className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <Users className="w-6 h-6 text-brand-primary" />
                                <div>
                                    <div className="font-semibold text-lg text-foreground">Join an existing project</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Request to become a helper for an existing project
                                    </div>
                                </div>
                            </div>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "create") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("choose")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">Create a new project</CardTitle>
                        <CardDescription>
                            Create from scratch or import from your GitHub repositories
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={() => setStep("create-manual")}
                            className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <Plus className="w-6 h-6 text-brand-primary" />
                                <div>
                                    <div className="font-semibold text-lg text-foreground">Create from scratch</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Start with a project name
                                    </div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => setStep("create-github")}
                            className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <Github className="w-6 h-6 text-brand-primary" />
                                <div>
                                    <div className="font-semibold text-lg text-foreground">Import from GitHub</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Connect GitHub and select a repository
                                    </div>
                                </div>
                            </div>
                        </Button>

                        {!hasSandbox && (
                            <Button
                                onClick={handleCreateSandbox}
                                disabled={isCreating}
                                className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary disabled:opacity-50"
                                variant="outline"
                            >
                                <div className="flex items-center gap-3 w-full">
                                    <FlaskConical className="w-6 h-6 text-brand-primary flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg text-foreground">Try a sandbox</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Explore a demo project pre-filled with helpers, tickets, and reports
                                        </div>
                                    </div>
                                    {isCreating && (
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground flex-shrink-0" />
                                    )}
                                </div>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "create-github") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("create")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">Import from GitHub</CardTitle>
                        <CardDescription>
                            Select a repository to create a project. If the repo belongs to an organization, we&apos;ll create or match that organization.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!githubToken ? (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Connect with GitHub to import your repositories. We need access to your repos and organizations.
                                </p>
                                <Button
                                    onClick={handleConnectGitHub}
                                    className="w-full bg-[#24292e] hover:bg-[#1b1f23] text-white"
                                >
                                    <Github className="w-5 h-5" />
                                    Connect with GitHub
                                </Button>
                            </div>
                        ) : isLoadingRepos ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : githubRepos.length === 0 ? (
                            <div className="space-y-4 py-4">
                                <p className="text-sm text-muted-foreground">
                                    No repositories found. Make sure you have access to at least one repository on GitHub.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={handleReauthorizeGitHub}
                                    className="w-full"
                                >
                                    <Github className="w-4 h-4" />
                                    Re-authorize with GitHub to grant more permissions
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search repositories..."
                                        value={repoSearch}
                                        onChange={(e) => setRepoSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                {filteredRepos.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4">
                                        No repositories match &quot;{repoSearch}&quot;
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {filteredRepos.map((repo) => (
                                            <button
                                                key={repo.id}
                                                type="button"
                                                onClick={() => handleImportFromGitHub(repo)}
                                                disabled={isCreating}
                                                className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-brand-primary/50 text-left transition-colors disabled:opacity-50"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-foreground truncate text-sm">{repo.full_name}</div>
                                                    {repo.description && (
                                                        <div className="text-sm text-muted-foreground truncate mt-0.5">
                                                            {repo.description}
                                                        </div>
                                                    )}
                                                </div>
                                                {isCreating ? (
                                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground flex-shrink-0" />
                                                ) : (
                                                    <Check className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {filteredRepos.length > 0 && (
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-xs text-muted-foreground">
                                            {filteredRepos.length} of {githubRepos.length} repositories
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleReauthorizeGitHub}
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                        >
                                            Re-authorize to see more
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "create-manual") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("create")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">Create a new project</CardTitle>
                        <CardDescription>
                            Give your project a name to get started
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project name</Label>
                            <Input
                                id="project-name"
                                type="text"
                                placeholder="My Awesome Project"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && projectName.trim()) {
                                        handleCreateProject()
                                    }
                                }}
                                disabled={isCreating}
                                className="w-full"
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep("create")}
                                variant="outline"
                                disabled={isCreating}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleCreateProject}
                                disabled={!projectName.trim() || isCreating}
                                className="flex-1 bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create project"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return null
}
