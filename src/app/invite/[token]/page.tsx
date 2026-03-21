"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase/client"
import { Loader2, CheckCircle, LogIn, XCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useOnboardingStatus, useCompleteOnboarding } from "@/hooks/useOnboardingStatus"
import { HelperInviteAcceptance } from "@/components/auth/helper-invite-acceptance"
import { useAcceptProjectInvite } from "@/hooks/useProject"

export default function InviteAcceptancePage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string
    
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [project, setProject] = useState<Record<string, unknown> | null>(null)
    const [inviteData, setInviteData] = useState<Record<string, unknown> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isMember, setIsMember] = useState(false)
    const [needsProfile, setNeedsProfile] = useState(false)
    const [userProfile, setUserProfile] = useState<{ name?: string; username?: string } | null>(null)
    
    const { data: onboardingStatus } = useOnboardingStatus()
    const completeOnboarding = useCompleteOnboarding()
    const acceptInvite = useAcceptProjectInvite()

    // Check authentication and find invite by token
    useEffect(() => {
        const checkAuthAndFindInvite = async () => {
            try {
                // Check authentication
                const { data: { session } } = await supabase.auth.getSession()
                setIsAuthenticated(!!session?.user)

                // Find invite by token
                const { data: invite, error: inviteError } = await supabase
                    .from("projects_invites")
                    .select("*, project:projects(*)")
                    .eq("token", token)
                    .eq("is_active", true)
                    .single()

                if (inviteError) {
                    if (inviteError.code === "PGRST116") {
                        setError("Invalid or expired invite link")
                    } else {
                        setError("Failed to load invite")
                    }
                    setIsLoading(false)
                    return
                }

                // Check if invite has expired
                if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                    setError("This invite link has expired")
                    setIsLoading(false)
                    return
                }

                // Check if invite has reached max uses
                if (invite.max_uses && invite.uses_count >= invite.max_uses) {
                    setError("This invite link has reached its maximum number of uses")
                    setIsLoading(false)
                    return
                }

                const projectData = invite.project as Record<string, unknown> | null
                setInviteData(invite)
                setProject(projectData)

                // If authenticated, check if user is already a member and profile status
                if (session?.user && projectData) {
                    const { data: memberData } = await supabase
                        .from("projects_members")
                        .select("user_id")
                        .eq("user_id", session.user.id)
                        .eq("project_id", projectData.project_id)
                        .is("deleted_at", null)
                        .maybeSingle()

                    setIsMember(!!memberData)

                    // If helper invite, check if user has profile info
                    // Note: The edge function will also check this, but we check here for better UX
                    if (invite.invite_type === "helper" && !memberData) {
                        const { data: profile } = await supabase
                            .from("users_public")
                            .select("name, username")
                            .eq("id", session.user.id)
                            .single()

                        setUserProfile(profile)
                        // Check if name is missing
                        if (!profile || !profile.name || profile.name.trim() === "") {
                            setNeedsProfile(true)
                        }
                    }
                }

                setIsLoading(false)
            } catch (err: unknown) {
                console.error("Error:", err)
                setError("An error occurred")
                setIsLoading(false)
            }
        }

        checkAuthAndFindInvite()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session?.user)
            if (session?.user && project) {
                // Re-check membership when auth state changes
                supabase
                    .from("projects_members")
                    .select("user_id")
                    .eq("user_id", session.user.id)
                    .eq("project_id", project.project_id)
                    .is("deleted_at", null)
                    .maybeSingle()
                    .then(({ data }) => setIsMember(!!data))
            }
        })

        return () => subscription.unsubscribe()
    }, [token, project])

    const handleProfileComplete = async () => {
        // Re-check profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from("users_public")
                .select("name, username")
                .eq("id", user.id)
                .single()
            
            setUserProfile(profile)
            // If name is now present, we can proceed
            if (profile && profile.name && profile.name.trim() !== "") {
                setNeedsProfile(false)
            }
        }
    }

    const handleAcceptInvite = async () => {
        if (!isAuthenticated) {
            // Redirect to sign in with return URL
            router.push(`/auth/signin?redirect=${encodeURIComponent(`/invite/${token}`)}`)
            return
        }

        if (!project || !inviteData) {
            toast.error("Project or invite not found")
            return
        }

        setIsProcessing(true)
        try {
            // Use edge function to accept invite (handles RLS)
            const result = await acceptInvite.mutateAsync(token)

            setIsMember(true)
            
            // If user hasn't completed onboarding, mark it as complete now
            if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
                await completeOnboarding.mutateAsync()
            }
            
            toast.success(result.message || "Successfully joined the project!")
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push("/")
            }, 1500)
        } catch (err: unknown) {
            console.error("Failed to accept invite:", err)
            const message = err instanceof Error ? err.message : ""
            const needsProfile =
                message.includes("Profile incomplete") ||
                (typeof err === "object" && err !== null && "response" in err &&
                 typeof (err as { response?: { data?: { needs_profile?: boolean } } }).response?.data?.needs_profile === "boolean")
            if (needsProfile) {
                setNeedsProfile(true)
                toast.error("Please complete your profile first")
            } else {
                toast.error(message || "Failed to accept invite. Please try again.")
            }
        } finally {
            setIsProcessing(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading invite...</p>
                </div>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <XCircle className="w-6 h-6 text-red-500" />
                            <CardTitle>Invalid invite link</CardTitle>
                        </div>
                        <CardDescription>
                            {error || "This invite link is invalid or has expired."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/">
                            <Button variant="outline" className="w-full">Go to homepage</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isMember) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <CardTitle>You&apos;re already a member</CardTitle>
                        </div>
                        <CardDescription>
                            You&apos;re already a member of {String(project?.name ?? "this project")}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/">
                            <Button className="w-full bg-[#554abf] hover:bg-[#4a3fa3] text-white">
                                Go to dashboard
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Show profile completion form if needed
    if (isAuthenticated && needsProfile && inviteData?.invite_type === "helper") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
                <HelperInviteAcceptance
                    projectName={String(project?.name ?? "the project")}
                    onComplete={handleProfileComplete}
                />
            </div>
        )
    }

    const inviteTypeLabel = inviteData?.invite_type === "helper" ? "as a helper" : "as a member"

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">You&apos;ve been invited!</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Join <span className="font-semibold">{String(project?.name ?? "this project")}</span> {inviteTypeLabel}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!isAuthenticated ? (
                        <>
                            <p className="text-sm text-muted-foreground text-center">
                                Sign in to accept this invitation and join the project.
                            </p>
                            <Link href={`/auth/signin?redirect=${encodeURIComponent(`/invite/${token}`)}`}>
                                <Button className="w-full bg-[#554abf] hover:bg-[#4a3fa3] text-white">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign in to continue
                                </Button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground text-center">
                                Click the button below to join this project {inviteTypeLabel}.
                            </p>
                            <Button
                                onClick={handleAcceptInvite}
                                disabled={isProcessing}
                                className="w-full bg-[#554abf] hover:bg-[#4a3fa3] text-white"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    "Accept invitation"
                                )}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
