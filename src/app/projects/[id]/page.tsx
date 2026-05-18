"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useProject, useProjectBySlug, useProjectBranding, useProjectResources } from "@/hooks/useProject"
import { useCreatePendingRequest } from "@/hooks/usePendingRequests"
import { useOnboardingStatus, useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { supabase } from "@/lib/supabase/client"
import { Loader2, CheckCircle, LogIn, Users } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ProjectLandingPage() {
    const params = useParams()
    const router = useRouter()
    const param = params.id as string
    const isUuid = UUID_REGEX.test(param)

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isCheckingAuth, setIsCheckingAuth] = useState(true)
    const [hasRequested, setHasRequested] = useState(false)

    const { data: projectById, isLoading: loadingById } = useProject(isUuid ? param : "")
    const { data: projectBySlug, isLoading: loadingBySlug } = useProjectBySlug(!isUuid ? param : "")
    const project = projectById ?? projectBySlug
    const projectId = project?.project_id ?? ""
    const projectLoading = isUuid ? loadingById : loadingBySlug

    const { data: branding } = useProjectBranding(projectId)
    const { data: resources } = useProjectResources(projectId)
    const { data: onboardingStatus } = useOnboardingStatus()
    const createRequest = useCreatePendingRequest()
    const completeOnboarding = useCompleteOnboarding()

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setIsAuthenticated(!!session?.user)
            setIsCheckingAuth(false)
        }
        checkAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session?.user)
        })

        return () => subscription.unsubscribe()
    }, [])

    // Check if user has already requested
    useEffect(() => {
        if (!isAuthenticated || !projectId) return

        const checkExistingRequest = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from("pending_user_requests")
                .select("status")
                .eq("user_id", user.id)
                .eq("project_id", projectId)
                .maybeSingle()

            if (data) {
                setHasRequested(true)
            }
        }

        checkExistingRequest()
    }, [isAuthenticated, projectId])

    const handleRequestHelper = async () => {
        if (!isAuthenticated) {
            // Redirect to sign in with return URL
            router.push(`/auth/signin?redirect=${encodeURIComponent(`/projects/${projectId}`)}`)
            return
        }

        if (!projectId) {
            toast.error("Project ID is required")
            return
        }

        try {
            await createRequest.mutateAsync({ projectId })
            
            // If user hasn't completed onboarding, mark it as complete now
            if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
                await completeOnboarding.mutateAsync()
            }
            
            setHasRequested(true)
            toast.success("Request submitted! The project admin will review your request.")
        } catch (error: unknown) {
            console.error("Failed to create request:", error)
            toast.error(error instanceof Error ? error.message : "Failed to submit request. Please try again.")
        }
    }

    if (isCheckingAuth || projectLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Project not found</CardTitle>
                        <CardDescription>
                            The project you&apos;re looking for doesn&apos;t exist or has been deleted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/">
                            <Button variant="outline">Go to homepage</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const projectLogo = branding?.logo_url || null
    const projectName = project.name

    return (
        <div className="min-h-screen bg-muted/50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Project Header */}
                <div className="bg-card rounded-lg shadow-sm border border-border p-8 mb-8">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 bg-card rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                                {projectLogo ? (
                                    <Image
                                        src={projectLogo}
                                        alt={`${projectName} logo`}
                                        width={96}
                                        height={96}
                                        className="object-cover"
                                    />
                                ) : (
                                    <Avatar className="w-24 h-24">
                                        <AvatarFallback className="bg-[#3c2ec5] text-white text-3xl">
                                            {projectName?.[0]?.toUpperCase() || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </div>
                        <div className="flex-1">
                            <h1 className="text-3xl font-semibold text-foreground mb-2">{projectName}</h1>
                            <p className="text-muted-foreground">
                                Request to become a helper for this project
                            </p>
                        </div>
                    </div>

                    {/* Request Helper Section */}
                    <div className="border-t border-border pt-6">
                        {hasRequested ? (
                            <div className="bg-muted/50 rounded-lg p-6 border border-border">
                                <div className="flex items-center gap-3 mb-2">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                    <h3 className="font-semibold text-lg text-foreground">Request submitted</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Your request to become a helper has been submitted. The project admin will review your request and notify you once a decision has been made.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-semibold text-lg text-foreground mb-4">Become a helper</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Request to become a helper for {projectName}. Once approved by a project admin, you&apos;ll be able to help with support tickets.
                                </p>
                                {isAuthenticated ? (
                                    <Button
                                        onClick={handleRequestHelper}
                                        disabled={createRequest.isPending}
                                        className="bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                                    >
                                        {createRequest.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Users className="w-4 h-4" />
                                                Request to become a helper
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            You need to sign in to request helper status.
                                        </p>
                                        <Link href={`/auth/signin?redirect=${encodeURIComponent(`/projects/${projectId}`)}`}>
                                            <Button className="bg-[#554abf] hover:bg-[#4a3fa3] text-white">
                                                <LogIn className="w-4 h-4" />
                                                Sign in to continue
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resources Section */}
                {resources && resources.length > 0 && (
                    <div className="bg-card rounded-lg shadow-sm border border-border p-8 mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Project resources</h2>
                        <div className="flex flex-wrap gap-3">
                            {resources.map((resource) => (
                                <a
                                    key={resource.id}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-3 bg-gradient-to-r from-[#c5b0ef] to-[#b8a0e8] text-[#2d2a49] rounded-full font-medium hover:from-[#b8a0e8] hover:to-[#ab90e0] transition-all cursor-pointer shadow-sm hover:shadow-md"
                                >
                                    {resource.name}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Support Link */}
                <div className="bg-card rounded-lg shadow-sm border border-border p-8">
                    <h2 className="text-xl font-semibold text-foreground mb-4">Need support?</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        If you&apos;re looking for help with this project, visit the support page.
                    </p>
                    <Link href={`/support?project=${projectId}`}>
                        <Button variant="outline" className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white">
                            Visit support page
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}

