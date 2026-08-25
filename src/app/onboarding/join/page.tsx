"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Github, Loader2, Users, CheckCircle, ArrowLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { signInWithGitHub } from "@/lib/supabase/auth"
import { useListContributedProjects, useSearchProjects, PROJECT_SEARCH_MIN_CHARS } from "@/hooks/useProject"
import { useCreatePendingRequest } from "@/hooks/usePendingRequests"
import { useOnboardingStatus, useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { toast } from "sonner"

export default function JoinProjectPage() {
    const router = useRouter()
    const [searchInput, setSearchInput] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [githubToken, setGithubToken] = useState<string | null>(null)
    const [requestedProjectIds, setRequestedProjectIds] = useState<Set<string>>(new Set())
    const [requestingProjectId, setRequestingProjectId] = useState<string | null>(null)

    const { data: contributedProjects = [], isLoading: loadingContributed } = useListContributedProjects(githubToken)
    const searchTerm = debouncedSearch.trim()
    const canSearch = searchTerm.length >= PROJECT_SEARCH_MIN_CHARS
    const { data: searchResults = [], isFetching: searching, isError: searchFailed } = useSearchProjects(debouncedSearch)
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
        const handle = setTimeout(() => setDebouncedSearch(searchInput), 250)
        return () => clearTimeout(handle)
    }, [searchInput])

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

    const handleGoToProject = (project: { project_id: string; slug: string | null }) => {
        router.push(`/projects/${project.slug || project.project_id}`)
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
            <Card className="w-full max-w-lg py-7 gap-6">
                <CardHeader className="px-7">
                    <CardTitle className="text-2xl font-bold">Join an existing project</CardTitle>
                    <CardDescription>
                        Search for a project by name, or connect with GitHub to find projects you&apos;ve contributed to that are registered in the system.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-7 space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="project-search" className="text-[13px] font-semibold">Search projects</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                id="project-search"
                                type="search"
                                autoComplete="off"
                                placeholder="Search by project name"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && canSearch && searchResults.length === 1) {
                                        handleGoToProject(searchResults[0])
                                    }
                                }}
                                className="pl-9"
                                aria-controls="project-search-results"
                            />
                        </div>
                        <div id="project-search-results" aria-live="polite">
                            {!canSearch ? (
                                <p className="text-xs text-muted-foreground">
                                    {searchInput.trim().length > 0
                                        ? `Type at least ${PROJECT_SEARCH_MIN_CHARS} characters to search`
                                        : "Or ask a project admin for the project landing page URL"}
                                </p>
                            ) : searchFailed ? (
                                <p className="text-xs text-destructive">Search failed. Please try again.</p>
                            ) : searching && searchResults.length === 0 ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Searching…
                                </div>
                            ) : searchResults.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                    No projects found matching &quot;{searchTerm}&quot;
                                </p>
                            ) : (
                                <ul className="space-y-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1">
                                    {searchResults.map((project) => (
                                        <li key={project.project_id}>
                                            <button
                                                type="button"
                                                onClick={() => handleGoToProject(project)}
                                                className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-muted focus-visible:bg-muted outline-none transition-colors"
                                            >
                                                {project.logo_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={project.logo_url}
                                                        alt=""
                                                        className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                                                        {project.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{project.name}</div>
                                                    {project.slug && (
                                                        <div className="text-xs text-muted-foreground truncate">{project.slug}</div>
                                                    )}
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-foreground mb-1">Find projects you&apos;ve contributed to</h3>
                            <p className="text-sm text-muted-foreground mb-[18px]">
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
                                    No projects found that match repositories you&apos;ve contributed to. You can still find a project using the search above.
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

                    <div className="!mt-3">
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
