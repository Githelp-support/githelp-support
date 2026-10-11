"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    useCreateProject,
    useListUserGithubRepos,
    useCreateProjectFromGitHub,
    useCreateSandboxProject,
    useHasSandbox,
    useSearchProjects,
    PROJECT_SEARCH_MIN_LENGTH,
    type ProjectSearchResult,
} from "@/hooks/useProject"
import { useCompleteOnboarding, useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { useEnterProject } from "@/hooks/useEnterProject"
import { useUser } from "@/contexts/user-context"
import { homeRouteForRole } from "@/lib/roles"
import {
    Loader2,
    Plus,
    Users,
    Github,
    ArrowLeft,
    Check,
    Search,
    FlaskConical,
    Mail,
} from "lucide-react"
import { RoleOptionCards } from "@/components/auth/role-option-cards"
import type { UserRole } from "@/contexts/user-context"
import { supabase } from "@/lib/supabase/client"
import { signInWithGitHub } from "@/lib/supabase/auth"
import { toast } from "sonner"

/**
 * Onboarding wizard.
 *
 * First-time flow ("/onboarding"):
 *   role → (User: dashboard)
 *        → (Admin / Helper: project name search)
 *             → match found:  Admin → "already on Githelp, ask to be invited"
 *                             Helper → project landing page (request to join)
 *             → no match:     Admin → confirm, then create (scratch / GitHub / sandbox)
 *                             Helper → "not on Githelp yet, reach out to the owners"
 *
 * Existing members land here via the top bar ("+ Add new" / "+ New role")
 * with `?new=1`. The flow is the same except the User option is not offered:
 * everyone already has their private user context.
 */
type OnboardingStep =
    | "role"
    | "project-name"
    | "admin-exists"
    | "admin-create-confirm"
    | "helper-no-match"
    | "create"
    | "create-manual"
    | "create-github"

type OnboardingRole = "admin" | "helper"

function ProjectLogo({
    logoUrl,
    projectName,
    size = "w-8 h-8",
}: {
    logoUrl: string | null | undefined
    projectName: string
    size?: string
}) {
    const hasLogo = typeof logoUrl === "string" && logoUrl.length > 0
    return (
        <Avatar key={`${logoUrl ?? ""}|${projectName}`} className={`${size} rounded-[11px] shrink-0`}>
            {hasLogo ? <AvatarImage src={logoUrl as string} alt={projectName} /> : null}
            <AvatarFallback className="bg-brand-primary text-white text-xs rounded-[11px]">
                {projectName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
        </Avatar>
    )
}

export default function OnboardingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<OnboardingStep>("role")
    const [onboardingRole, setOnboardingRole] = useState<OnboardingRole | null>(null)
    const [projectName, setProjectName] = useState("")
    const [selectedMatch, setSelectedMatch] = useState<ProjectSearchResult | null>(null)
    const [showShortAlternatives, setShowShortAlternatives] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [githubToken, setGithubToken] = useState<string | null>(null)
    const [repoSearch, setRepoSearch] = useState("")

    const queryClient = useQueryClient()
    const { user, switchRole } = useUser()
    const createProject = useCreateProject()
    const createFromGitHub = useCreateProjectFromGitHub()
    const createSandbox = useCreateSandboxProject()
    const { data: hasSandbox } = useHasSandbox()
    const completeOnboarding = useCompleteOnboarding()
    const enterProject = useEnterProject()
    const { data: onboardingStatus, isLoading: onboardingStatusLoading } = useOnboardingStatus()

    const { data: githubRepos = [], isLoading: isLoadingRepos } = useListUserGithubRepos(githubToken)

    const filteredRepos = repoSearch.trim()
        ? githubRepos.filter(
              (r) =>
                  r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
                  (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
          )
        : githubRepos

    // Project-name search. Suggestions appear once the name is long enough;
    // a shorter name only searches after the user pressed Next, so we can
    // show them some potential alternatives before moving on.
    const trimmedName = projectName.trim()
    const nameIsLongEnough = trimmedName.length >= PROJECT_SEARCH_MIN_LENGTH
    const searchEnabled =
        step === "project-name" && trimmedName.length > 0 && (nameIsLongEnough || showShortAlternatives)
    const { data: projectMatches = [], isFetching: isSearchingProjects } = useSearchProjects(projectName, {
        enabled: searchEnabled,
    })

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

    // Entry params: `import=github` jumps to the GitHub importer, and
    // `role=admin|helper` (from the "I am acting as" chooser) skips the role
    // step and goes straight to the project-name search for that role.
    const importParam = searchParams.get("import")
    const roleParam = searchParams.get("role")
    const [syncedEntryParams, setSyncedEntryParams] = useState<string | null>(null)
    const entryParams = `${importParam ?? ""}|${roleParam ?? ""}`
    if (entryParams !== syncedEntryParams) {
        setSyncedEntryParams(entryParams)
        if (importParam === "github") {
            setOnboardingRole("admin")
            setStep("create-github")
        } else if (roleParam === "admin" || roleParam === "helper") {
            setOnboardingRole(roleParam)
            setStep("project-name")
        }
    }

    // Existing members come back here on purpose to add another project or
    // role (top-bar "Add new" / "New role", sandbox "Exit sandbox", GitHub
    // import). Those entry points pass an explicit intent param so the
    // redirect below is skipped and the "User" option is not offered.
    const isAddingRole =
        searchParams.get("new") === "1" || searchParams.get("import") === "github"

    // CRM / admin-seeded users already have a project; this route is public so
    // AuthGuard does not redirect them away — send them to the app instead of
    // showing the wizard again.
    //
    // Do not use `!needsOnboarding` alone: when logged out, useOnboardingStatus
    // returns needsOnboarding: false (no user), which would wrongly redirect.
    const hasFinishedOnboardingWizard =
        !isAddingRole &&
        !isCreating &&
        !!onboardingStatus &&
        (onboardingStatus.isMember || onboardingStatus.onboardingCompleted)

    useEffect(() => {
        if (onboardingStatusLoading || !onboardingStatus) return
        if (isAddingRole) return
        // Creating a project makes the user a member right away; the create
        // handlers navigate themselves once the new project is selected and
        // the role is switched. Redirecting here first would race them and
        // land on "/" before any project is selected.
        if (isCreating) return
        const done =
            onboardingStatus.isMember || onboardingStatus.onboardingCompleted
        if (done) {
            router.replace("/")
        }
    }, [onboardingStatus, onboardingStatusLoading, router, isAddingRole, isCreating])

    const roleOptions: UserRole[] = isAddingRole ? ["admin", "helper"] : ["admin", "helper", "user"]

    /**
     * Leave the wizard without a project: first-time users are marked as
     * onboarded and land in their private user context; existing members
     * simply go back to the app.
     */
    const finishWithoutProject = async () => {
        if (isAddingRole) {
            router.push("/")
            return
        }
        setIsCreating(true)
        try {
            if (!onboardingStatus?.onboardingCompleted) {
                await completeOnboarding.mutateAsync()
            }
            await queryClient.refetchQueries({ queryKey: ["onboarding-status"] })
            switchRole("user")
            router.push(homeRouteForRole("user"))
        } catch (error: unknown) {
            console.error("Failed to finish onboarding:", error)
            toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.")
            setIsCreating(false)
        }
    }

    const handleChooseRole = (role: UserRole) => {
        if (role === "user") {
            void finishWithoutProject()
            return
        }
        setOnboardingRole(role)
        setSelectedMatch(null)
        setShowShortAlternatives(false)
        setStep("project-name")
    }

    const handleProjectNameChange = (value: string) => {
        setProjectName(value)
        setSelectedMatch(null)
        setShowShortAlternatives(false)
    }

    const handleSelectMatch = (match: ProjectSearchResult) => {
        setSelectedMatch((current) => (current?.project_id === match.project_id ? null : match))
    }

    const handleProjectNameNext = () => {
        if (!trimmedName || !onboardingRole) return

        if (selectedMatch) {
            if (onboardingRole === "admin") {
                setStep("admin-exists")
            } else {
                // The project landing page carries the "request to become a
                // helper" form and marks onboarding complete on submit.
                router.push(`/projects/${selectedMatch.slug || selectedMatch.project_id}`)
            }
            return
        }

        // Short names haven't been searched yet — show potential alternatives
        // once before letting the user continue without a match.
        if (!nameIsLongEnough && !showShortAlternatives) {
            setShowShortAlternatives(true)
            return
        }

        setStep(onboardingRole === "admin" ? "admin-create-confirm" : "helper-no-match")
    }

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
            await queryClient.refetchQueries({ queryKey: ["onboarding-status"] })

            // The creator is the project's admin — land them there as admin
            // even if their last active role (e.g. helper) was something else.
            const role = await enterProject(project.project_id, "admin")
            toast.success("Project created successfully!")
            router.push(homeRouteForRole(role))
        } catch (error: unknown) {
            console.error("Failed to create project:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create project. Please try again.")
            // Only reset on failure — on success we navigate away, and
            // clearing it would re-arm the member redirect above.
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
            await queryClient.refetchQueries({ queryKey: ["onboarding-status"] })

            await enterProject(result.project.project_id, "admin")
            toast.success("Project imported from GitHub successfully!")
            router.push(`/projects/${result.project.project_id}/invite-contributors?repo=${encodeURIComponent(repo.full_name)}`)
        } catch (error: unknown) {
            console.error("Failed to import project:", error)
            toast.error(error instanceof Error ? error.message : "Failed to import project. Please try again.")
            // Only reset on failure — on success we navigate away, and
            // clearing it would re-arm the member redirect above.
            setIsCreating(false)
        }
    }

    const handleCreateSandbox = async () => {
        setIsCreating(true)
        try {
            // The edge function provisions the demo data and marks onboarding
            // complete server-side, so we only refetch to pick up the changes.
            const result = await createSandbox.mutateAsync()

            await queryClient.refetchQueries({ queryKey: ["onboarding-status"] })

            const role = await enterProject(result.project.project_id, "admin")
            toast.success("Sandbox ready! Explore your demo project.")
            router.push(homeRouteForRole(role))
        } catch (error: unknown) {
            console.error("Failed to create sandbox:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create sandbox. Please try again.")
            // Only reset on failure — on success we navigate away, and
            // clearing it would re-arm the member redirect above.
            setIsCreating(false)
        }
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

    if (step === "role") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">
                            {isAddingRole ? "Add a new role" : "Welcome to Githelp! How will you use it?"}
                        </CardTitle>
                        <CardDescription className="text-sm mt-2">
                            {isAddingRole
                                ? "Choose what you want to do next. You can hold several roles across different projects."
                                : "Pick the role that fits you best. You can always add another role later."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RoleOptionCards
                            roles={roleOptions}
                            onSelect={handleChooseRole}
                            disabled={isCreating}
                            busyRole={isCreating ? "user" : null}
                            showIcons={!isAddingRole}
                        />
                        {isAddingRole && (
                            <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
                                <ArrowLeft className="w-4 h-4" />
                                Back to Githelp
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "project-name") {
        const showSuggestions = searchEnabled
        const noMatches = showSuggestions && !isSearchingProjects && projectMatches.length === 0
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("role")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">What is the name of the project?</CardTitle>
                        <CardDescription>
                            {onboardingRole === "admin"
                                ? "We'll check whether the project is already on Githelp before you create it."
                                : "We'll look for the project on Githelp so you can request to become a helper for it."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="onboarding-project-name">Project name</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="onboarding-project-name"
                                    type="text"
                                    placeholder="e.g. Supabase, Tailwind CSS, My Awesome Project"
                                    value={projectName}
                                    onChange={(e) => handleProjectNameChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && trimmedName) {
                                            handleProjectNameNext()
                                        }
                                    }}
                                    autoFocus
                                    className="pl-9"
                                />
                            </div>
                            {!nameIsLongEnough && !showShortAlternatives && (
                                <p className="text-xs text-muted-foreground">
                                    Type at least {PROJECT_SEARCH_MIN_LENGTH} characters to see projects already on Githelp.
                                </p>
                            )}
                        </div>

                        {showSuggestions && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">
                                    {showShortAlternatives && !nameIsLongEnough
                                        ? "Did you mean one of these?"
                                        : "Already on Githelp"}
                                </p>
                                {isSearchingProjects && projectMatches.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Searching…
                                    </div>
                                ) : noMatches ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                        No projects on Githelp match &quot;{trimmedName}&quot;.
                                        {onboardingRole === "admin"
                                            ? " Press Next to create it."
                                            : " Press Next to continue."}
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {projectMatches.map((match) => {
                                            const isSelected = selectedMatch?.project_id === match.project_id
                                            return (
                                                <button
                                                    key={match.project_id}
                                                    type="button"
                                                    onClick={() => handleSelectMatch(match)}
                                                    aria-pressed={isSelected}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                                                        isSelected
                                                            ? "border-brand-primary bg-brand-primary/5"
                                                            : "border-border hover:bg-muted/50 hover:border-brand-primary/50"
                                                    }`}
                                                >
                                                    <ProjectLogo
                                                        logoUrl={match.logo_url}
                                                        projectName={match.name}
                                                        size="w-8 h-8"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-foreground truncate">{match.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            /projects/{match.slug}
                                                        </div>
                                                    </div>
                                                    {isSelected && <Check className="w-5 h-5 text-brand-primary shrink-0" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {onboardingRole === "helper" && (
                            <p className="text-xs text-muted-foreground">
                                Not sure of the name?{" "}
                                <Link href="/onboarding/join" className="underline hover:text-foreground">
                                    Find projects you&apos;ve contributed to on GitHub
                                </Link>
                            </p>
                        )}

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep("role")}
                                variant="outline"
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleProjectNameNext}
                                disabled={!trimmedName || (showShortAlternatives && isSearchingProjects)}
                                className="flex-1 bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                {selectedMatch
                                    ? onboardingRole === "admin"
                                        ? "Continue with this project"
                                        : "Request to become a helper"
                                    : showShortAlternatives && !nameIsLongEnough
                                      ? "None of these, continue"
                                      : "Next"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "admin-exists" && selectedMatch) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("project-name")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <div className="flex items-center gap-3 mb-2">
                            <ProjectLogo
                                logoUrl={selectedMatch.logo_url}
                                projectName={selectedMatch.name}
                                size="w-10 h-10"
                            />
                            <CardTitle className="text-2xl font-bold">{selectedMatch.name} is already on Githelp</CardTitle>
                        </div>
                        <CardDescription>
                            Projects have a single team of admins. To manage this project you need an invite from one of its
                            existing admins.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <Mail className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-foreground space-y-2">
                                    <p className="font-medium">How to get invited</p>
                                    <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                                        <li>
                                            Reach out to someone who already administers {selectedMatch.name} on Githelp and
                                            ask them to add you as an admin.
                                        </li>
                                        <li>
                                            They can do that from <span className="text-foreground">Settings → Project → Admins</span>{" "}
                                            by sending an invite to{" "}
                                            <span className="text-foreground">{user.email ?? "your email address"}</span>.
                                        </li>
                                        <li>
                                            Open the invite link you receive and you&apos;ll be added to the project right away.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Want to help out instead?{" "}
                            <Link
                                href={`/projects/${selectedMatch.slug || selectedMatch.project_id}`}
                                className="underline hover:text-foreground"
                            >
                                Request to become a helper for {selectedMatch.name}
                            </Link>
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep("project-name")}
                                variant="outline"
                                disabled={isCreating}
                                className="flex-1"
                            >
                                Try another name
                            </Button>
                            <Button
                                onClick={finishWithoutProject}
                                disabled={isCreating}
                                className="flex-1 bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {isAddingRole ? "Back to Githelp" : "Continue to Githelp"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "admin-create-confirm") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("project-name")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">&quot;{trimmedName}&quot; isn&apos;t on Githelp yet</CardTitle>
                        <CardDescription>
                            Do you want to create it? You&apos;ll become the project&apos;s first admin and can invite helpers
                            and other admins afterwards.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep("project-name")}
                                variant="outline"
                                className="flex-1"
                            >
                                No, go back
                            </Button>
                            <Button
                                onClick={() => setStep("create")}
                                className="flex-1 bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                <Plus className="w-4 h-4" />
                                Yes, create the project
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (step === "helper-no-match") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit -ml-2 mb-2"
                            onClick={() => setStep("project-name")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">&quot;{trimmedName}&quot; isn&apos;t on Githelp yet</CardTitle>
                        <CardDescription>
                            Only the project&apos;s owners can add it to Githelp. Once it&apos;s here, you can request to become
                            one of its helpers.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start gap-3">
                                <Users className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p className="font-medium text-foreground">Help bring {trimmedName} to Githelp</p>
                                    <p>
                                        Reach out to the maintainers of {trimmedName} and let them know you&apos;d like to
                                        become a helper for the project on Githelp. Once they have created the project,
                                        come back here and request to join it.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Know the project under a different name?{" "}
                            <Link href="/onboarding/join" className="underline hover:text-foreground">
                                Find projects you&apos;ve contributed to on GitHub
                            </Link>
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep("project-name")}
                                variant="outline"
                                disabled={isCreating}
                                className="flex-1"
                            >
                                Try another name
                            </Button>
                            <Button
                                onClick={finishWithoutProject}
                                disabled={isCreating}
                                className="flex-1 bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {isAddingRole ? "Back to Githelp" : "Continue to Githelp"}
                            </Button>
                        </div>
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
                            onClick={() => setStep(trimmedName ? "admin-create-confirm" : "project-name")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <CardTitle className="text-2xl font-bold">
                            {trimmedName ? `Create ${trimmedName}` : "Create a new project"}
                        </CardTitle>
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
                            <div className="flex items-start gap-3">
                                <Plus className="w-6 h-6 shrink-0 mt-0.5 text-brand-primary" />
                                <div>
                                    <div className="font-semibold text-lg text-foreground">Create from scratch</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        {trimmedName ? `Start with the name "${trimmedName}"` : "Start with a project name"}
                                    </div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => setStep("create-github")}
                            className="w-full h-auto py-6 flex flex-col items-start gap-2 bg-white hover:bg-gray-50 text-left border-2 border-border hover:border-brand-primary"
                            variant="outline"
                        >
                            <div className="flex items-start gap-3">
                                <Github className="w-6 h-6 shrink-0 mt-0.5 text-brand-primary" />
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
                                <div className="flex items-start gap-3 w-full">
                                    <FlaskConical className="w-6 h-6 mt-0.5 text-brand-primary flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg text-foreground">Try a sandbox</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Explore a demo project pre-filled with helpers, tickets, and reports
                                        </div>
                                    </div>
                                    {isCreating && (
                                        <Loader2 className="w-5 h-5 mt-1 animate-spin text-muted-foreground flex-shrink-0" />
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
                                                    <div className="font-medium text-foreground truncate">{repo.full_name}</div>
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
