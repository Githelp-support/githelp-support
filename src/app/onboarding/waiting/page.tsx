"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCreateProject } from "@/hooks/useProject"
import { useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { Loader2, Plus, Users, Mail, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function WaitingPage() {
    const router = useRouter()
    const [projectName, setProjectName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    
    const createProject = useCreateProject()
    const completeOnboarding = useCompleteOnboarding()

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

            toast.success("Project created successfully!")
            
            // Redirect to dashboard
            router.push("/")
        } catch (error: unknown) {
            console.error("Failed to create project:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create project. Please try again.")
        } finally {
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
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                                <h3 className="font-semibold text-lg text-foreground mb-2">Wait for an invite</h3>
                                <p className="text-sm text-muted-foreground">
                                    A project admin can invite you to join their project. You&apos;ll receive an email notification when you&apos;re invited.
                                </p>
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
                                        <ArrowRight className="w-4 h-4 ml-2" />
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

