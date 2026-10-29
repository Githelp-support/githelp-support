"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { useEnterProject } from "@/hooks/useEnterProject"
import { homeRouteForRole } from "@/lib/roles"
import { EdgeFunctionError, toEdgeFunctionError } from "@/lib/functions-error"

/**
 * Shape returned by the `get_project_invite_by_token(p_token)` RPC. The
 * `projects_invites` table itself is no longer readable through PostgREST
 * (tokens must not be enumerable); the RPC returns the single matching
 * active invite, or null when the token is unknown, revoked or expired.
 */
interface InviteLookup {
    id: string
    project_id: string
    invite_type: "admin" | "helper" | "member"
    category: "core" | "extended" | "community" | null
    email: string | null
    github_username: string | null
    invitee_identifier: string | null
    expires_at: string | null
    max_uses: number | null
    uses_count: number
    is_active: boolean
    created_by: string | null
    project: {
        project_id: string
        name: string
        slug: string | null
        logo_url: string | null
    } | null
}

type InviteProject = NonNullable<InviteLookup["project"]>

const inviteRoleLabel = (type: InviteLookup["invite_type"] | undefined) => {
    if (type === "helper") return "as a helper"
    if (type === "admin") return "as an admin"
    return "as a member"
}

export default function InviteAcceptancePage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [project, setProject] = useState<InviteProject | null>(null)
    const [inviteData, setInviteData] = useState<InviteLookup | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isMember, setIsMember] = useState(false)
    const [justJoined, setJustJoined] = useState(false)
    const [needsProfile, setNeedsProfile] = useState(false)

    const { data: onboardingStatus } = useOnboardingStatus()
    const completeOnboarding = useCompleteOnboarding()
    const acceptInvite = useAcceptProjectInvite()

    const selectJoinedProject = useEnterProject()

    // The signed-in user id the invite was last loaded for. The auth listener
    // only reloads when this changes (SIGNED_IN fires again on tab focus and
    // TOKEN_REFRESHED periodically; neither should hit the database again).
    const loadedForUserId = useRef<string | null | undefined>(undefined)

    const loadInvite = useCallback(async (signal: { cancelled: boolean }) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (signal.cancelled) return
            // State updates only after the first await: `isLoading` already
            // starts out true, and this keeps the effect body free of
            // synchronous setState calls (react-hooks/set-state-in-effect).
            setIsLoading(true)
            setError(null)
            const userId = session?.user?.id ?? null
            loadedForUserId.current = userId
            setIsAuthenticated(!!userId)

            // Token-scoped lookup (SECURITY DEFINER RPC) — returns null for an
            // unknown, revoked or expired token.
            const { data, error: rpcError } = await supabase.rpc("get_project_invite_by_token", {
                p_token: token,
            })
            if (signal.cancelled) return

            if (rpcError) {
                console.error("Failed to load invite:", rpcError)
                setError("Failed to load invite")
                return
            }

            const invite = (data ?? null) as InviteLookup | null
            if (!invite || !invite.is_active) {
                setError("Invalid or expired invite link")
                return
            }

            // Check if invite has expired
            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                setError("This invite link has expired")
                return
            }

            // Check if invite has reached max uses
            if (invite.max_uses && invite.uses_count >= invite.max_uses) {
                setError("This invite link has reached its maximum number of uses")
                return
            }

            const projectData = invite.project
            setInviteData(invite)
            setProject(projectData)

            // If authenticated, check if user is already a member and profile status
            if (session?.user && projectData) {
                const { data: memberData } = await supabase
                    .from("projects_members")
                    .select("user_id, role")
                    .eq("user_id", session.user.id)
                    .eq("project_id", projectData.project_id)
                    .is("deleted_at", null)
                    .maybeSingle()
                if (signal.cancelled) return

                // An admin invite can still be redeemed by an existing non-admin
                // member (accept-project-invite upgrades the role).
                const upgradesRole =
                    invite.invite_type === "admin" && !!memberData && memberData.role !== "admin"
                setIsMember(!!memberData && !upgradesRole)

                // If helper invite, check if user has profile info
                // Note: The edge function will also check this, but we check here for better UX
                if (invite.invite_type === "helper" && !memberData) {
                    const { data: profile } = await supabase
                        .from("users_public")
                        .select("name, username")
                        .eq("id", session.user.id)
                        .maybeSingle()
                    if (signal.cancelled) return

                    // Check if name is missing
                    setNeedsProfile(!profile || !profile.name || profile.name.trim() === "")
                }
            } else {
                setIsMember(false)
                setNeedsProfile(false)
            }
        } catch (err: unknown) {
            if (signal.cancelled) return
            console.error("Error:", err)
            setError("An error occurred")
        } finally {
            if (!signal.cancelled) setIsLoading(false)
        }
    }, [token])

    // Load the invite once per token, and again when the signed-in user
    // changes (sign-in completing in this tab, or sign-out). `loadInvite`
    // only touches state after awaiting the network, so the lint rule's
    // "synchronous setState in effect" concern does not apply here.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        let current = { cancelled: false }
        void loadInvite(current)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return
            const userId = session?.user?.id ?? null
            if (loadedForUserId.current === undefined || userId === loadedForUserId.current) return
            current.cancelled = true
            current = { cancelled: false }
            void loadInvite(current)
        })

        return () => {
            current.cancelled = true
            subscription.unsubscribe()
        }
    }, [loadInvite])
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleProfileComplete = async () => {
        // Re-check profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from("users_public")
                .select("name, username")
                .eq("id", user.id)
                .maybeSingle()

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
            setJustJoined(true)

            // If user hasn't completed onboarding, mark it as complete now
            if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
                await completeOnboarding.mutateAsync()
            }

            toast.success(result.message || "Successfully joined the project!")

            // Land in the newly joined project, in the highest role held there.
            const nextRole = await selectJoinedProject(result.project_id)
            const destination = homeRouteForRole(nextRole)
            setTimeout(() => {
                router.push(destination)
            }, 1500)
        } catch (err: unknown) {
            console.error("Failed to accept invite:", err)
            // The hook already unwraps the edge-function body; normalise
            // anyway so a thrown non-function error is handled the same way.
            const fnError = err instanceof EdgeFunctionError
                ? err
                : await toEdgeFunctionError(err, "Failed to accept invite. Please try again.")
            const profileIncomplete =
                fnError.body?.needs_profile === true ||
                /profile incomplete/i.test(fnError.message)
            if (profileIncomplete) {
                setNeedsProfile(true)
                toast.error("Please complete your profile first")
            } else {
                toast.error(fnError.message)
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
                    <p className="text-[14px] text-muted-foreground">Loading invite...</p>
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
        const projectName = project?.name ?? "this project"
        const isHelperInvite = inviteData?.invite_type === "helper"
        const title = justJoined
            ? isHelperInvite
                ? "Congratulations! You are now a validated helper"
                : `Welcome to ${projectName}`
            : `You're already part of ${projectName}`
        const description = justJoined
            ? isHelperInvite
                ? `Someone from the project core team has added you as a validated helper to ${projectName}. You can now accept incoming tickets to this project.`
                : `You've joined ${projectName} ${inviteRoleLabel(inviteData?.invite_type)}.`
            : `This invite is for ${projectName}, which you are already a member of. Open your dashboard to continue.`
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex flex-col items-start gap-4 mb-2 text-left">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <CardTitle>{title}</CardTitle>
                        </div>
                        <CardDescription className="text-left">{description}</CardDescription>
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
                    projectName={project?.name ?? "the project"}
                    onComplete={handleProfileComplete}
                />
            </div>
        )
    }

    const inviteTypeLabel = inviteRoleLabel(inviteData?.invite_type)

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">You&apos;ve been invited!</CardTitle>
                    <CardDescription className="text-sm mt-2">
                        Join {project?.name ?? "this project"} {inviteTypeLabel}
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
                                    <LogIn className="w-4 h-4" />
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
                                        <Loader2 className="w-4 h-4 animate-spin" />
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
