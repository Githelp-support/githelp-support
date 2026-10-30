"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useProject, useProjectBySlug, useProjectBranding } from "@/hooks/useProject"
import { useCreatePendingRequest } from "@/hooks/usePendingRequests"
import { useOnboardingStatus, useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { supabase } from "@/lib/supabase/client"
import { hasSignedInSession } from "@/lib/supabase/auth-state"
import { Loader2, CheckCircle, LogIn } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

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
    const { data: onboardingStatus } = useOnboardingStatus()
    const createRequest = useCreatePendingRequest()
    const completeOnboarding = useCompleteOnboarding()

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setIsAuthenticated(hasSignedInSession(session))
            setIsCheckingAuth(false)
        }
        checkAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(hasSignedInSession(session))
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
                            <div className="w-[82px] h-[82px] bg-card rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                                {projectLogo ? (
                                    <Image
                                        src={projectLogo}
                                        alt={`${projectName} logo`}
                                        width={82}
                                        height={82}
                                        className="object-cover"
                                    />
                                ) : (
                                    <Avatar className="w-[82px] h-[82px]">
                                        <AvatarFallback
                                            className={cn("text-brand-foreground text-[26px]", !branding?.primary_color && "bg-brand-primary")}
                                            style={branding?.primary_color ? { backgroundColor: branding.primary_color } : undefined}
                                        >
                                            {projectName?.[0]?.toUpperCase() || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-semibold text-foreground">{projectName}</h1>
                        </div>
                    </div>

                    {/* Request Helper Section */}
                    <div className="border-t border-border pt-6">
                        {hasRequested ? (
                            <div className="bg-muted/50 rounded-lg p-6 border border-border">
                                <div className="flex items-center gap-3 mb-2">
                                    <CheckCircle className="w-[19px] h-[19px] text-green-600" />
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
                                        variant="brand"
                                    >
                                        {createRequest.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fi fi-rr-user-add inline-flex items-center justify-center leading-none w-4 h-4" />
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
                                            <Button variant="brand">
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

                {/* Support Link */}
                <div className="bg-card rounded-lg shadow-sm border border-border p-8">
                    <h3 className="font-semibold text-lg text-foreground mb-4">Need support?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        If you&apos;re looking for help with this project, visit the support page.
                    </p>
                    <Link href={`/support?project=${projectId}`}>
                        <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-foreground">
                            Visit support page
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}

