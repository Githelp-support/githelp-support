"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCreateProject } from "@/hooks/useProject"
import { useEnterProject } from "@/hooks/useEnterProject"
import { useOnboardingStatus, type OnboardingStatus } from "@/hooks/useOnboardingStatus"
import { homeRouteForRole } from "@/lib/roles"
import { Loader2, Plus, Users, Mail, ArrowRight, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function WaitingPage() {
    const router = useRouter()
    const [projectName, setProjectName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)

    const queryClient = useQueryClient()
    const createProject = useCreateProject()
    const enterProject = useEnterProject()
    // Public route, so AuthGuard does not watch status here. Read it
    // ourselves (short staleTime + focus refetch) so a helper whose request
    // was approved in another browser is routed on instead of parked.
    const { data: onboardingStatus } = useOnboardingStatus()

    useEffect(() => {
        if (!onboardingStatus || isCreating) return
        // Still waiting (or still needs the wizard, which AuthGuard handles
        // on the next protected route) — stay here.
        if (onboardingStatus.needsWaiting || onboardingStatus.needsOnboarding) return
        // Approved / joined / nothing left to wait for: into the app.
        router.replace("/")
    }, [onboardingStatus, isCreating, router])

    const handleCheckAgain = async () => {
        setIsChecking(true)
        try {
            await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] })
            await queryClient.invalidateQueries({ queryKey: ["user-projects"] })
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["onboarding-status"] }),
                queryClient.refetchQueries({ queryKey: ["user-projects"] }),
                queryClient.refetchQueries({ queryKey: ["user-roles"] }),
                queryClient.refetchQueries({ queryKey: ["account-roles"] }),
            ])
            const fresh = queryClient.getQueryData<OnboardingStatus>(["onboarding-status"])
            if (fresh && !fresh.needsWaiting && !fresh.needsOnboarding) {
                router.push("/")
                return
            }
            toast.info("Your request is still waiting for an admin to approve it.")
        } catch (error: unknown) {
            console.error("Failed to refresh status:", error)
            toast.error("Couldn't check your status. Please try again.")
        } finally {
            setIsChecking(false)
        }
    }

    const handleCreateProject = async () => {
        if (!projectName.trim()) {
            toast.error("Please enter a project name")
            return
        }

        setIsCreating(true)
        try {
            // Generate a slug from the project name
            const slug = projectName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")

            // Create project
            const project = await createProject.mutateAsync({
                name: projectName.trim(),
                slug: slug || `project-${Date.now()}`,
                type: "repo",
                open_for_new_helpers: true,
            })

            // AuthGuard sends completed-but-not-a-member users back here, so
            // refresh the cached status before leaving or "/" bounces us back.
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
            // clearing it would race the status redirect above.
            setIsCreating(false)
            setShowCreateForm(false)
            setProjectName("")
        }
    }

    if (showCreateForm) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
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
                                onClick={() => setShowCreateForm(false)}
                                variant="outline"
                                disabled={isCreating}
                                className="flex-1"
                            >
                                Cancel
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">You&apos;re all set up!</CardTitle>
                    <CardDescription className="text-base mt-2">
                        You&apos;ve completed onboarding, but you&apos;re not a member of any project yet. Here are your options:
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-6 border border-border">
                        <div className="flex items-start gap-4">
                            <Mail className="w-6 h-6 text-[#554abf] mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-foreground mb-2">
                                    {onboardingStatus?.hasPendingRequest ? "Waiting for approval" : "Wait for an invite"}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {onboardingStatus?.hasPendingRequest
                                        ? "A project admin needs to approve your request to become a helper. You'll be notified once that happens — or check again now."
                                        : "A project admin can invite you to join their project. You'll receive an email notification when you're invited."}
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={handleCheckAgain}
                                    disabled={isChecking}
                                    className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white"
                                >
                                    {isChecking ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    Check again
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-6 border border-border">
                        <div className="flex items-start gap-4">
                            <Users className="w-6 h-6 text-[#554abf] mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-foreground mb-2">Request to become a member</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Visit a project&apos;s landing page and request to become a helper. You&apos;ll need the project ID or landing page URL from a project admin.
                                </p>
                                <Link href="/onboarding/join">
                                    <Button variant="outline" className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white">
                                        Find a project
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-6 border border-border">
                        <div className="flex items-start gap-4">
                            <Plus className="w-6 h-6 text-[#554abf] mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-foreground mb-2">Create a new project</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Start your own project and invite helpers to join you.
                                </p>
                                <Button
                                    onClick={() => setShowCreateForm(true)}
                                    className="bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                                >
                                    Create project
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

