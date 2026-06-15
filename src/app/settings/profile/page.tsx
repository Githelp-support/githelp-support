"use client"

import { useState, useEffect } from "react"
import { Info, Landmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Logo } from "@/components/brand/logo"
import { useHelper, useUpdateUserProfile } from "@/hooks/useHelpers"
import { getAvatarColorHexForId } from "@/lib/constants"
import { supabase } from "@/lib/supabase/client"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useUser } from "@/contexts/user-context"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { linkGitHubIdentity } from "@/lib/supabase/auth"

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

export default function ProfileSettingsPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [gitHubConnected, setGitHubConnected] = useState(false)
  const [gitHubUsername, setGitHubUsername] = useState<string | null>(null)

  const { user } = useUser()
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: helperId, isLoading: currentHelperLoading } = useCurrentHelper(projectId)
  const { data: helperData, isLoading: helperLoading } = useHelper(helperId ?? "")

  const updateUserProfile = useUpdateUserProfile()

  // Sync local form state when helper data loads
  useEffect(() => {
    if (helperData) {
      setName(helperData.user?.name ?? "")
      setEmail(helperData.user?.email ?? "")
    }
  }, [helperData])

  // GitHub connection status, display username, and auto-sync to users_public when empty
  useEffect(() => {
    const checkGitHub = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setGitHubConnected(false)
        setGitHubUsername(null)
        return
      }

      const providers: string[] = session.user.app_metadata?.providers ?? []
      const isConnected = providers.includes("github")
      setGitHubConnected(isConnected)

      if (!isConnected) {
        setGitHubUsername(null)
        return
      }

      const githubIdentity = session.user.identities?.find(
        (identity) => identity.provider === "github"
      )
      const idData = githubIdentity?.identity_data as
        | Record<string, unknown>
        | undefined
      const fromIdentity =
        (typeof idData?.user_name === "string" ? idData.user_name : undefined) ??
        (typeof idData?.preferred_username === "string"
          ? idData.preferred_username
          : undefined)
      const ghUsername =
        fromIdentity ??
        (session.user.user_metadata?.user_name as string | undefined) ??
        null

      setGitHubUsername(ghUsername)

      if (ghUsername && user?.id && !helperData?.user?.username) {
        updateUserProfile.mutate({
          userId: user.id,
          updates: { username: ghUsername },
        })
      }
    }
    void checkGitHub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, helperData?.user?.username])

  const handleSaveProfile = async () => {
    if (!user?.id) return
    await updateUserProfile.mutateAsync({
      userId: user.id,
      updates: { name: name || undefined, email: email || undefined },
    })
  }

  const isLoading = currentHelperLoading || (!!projectId && !!helperId && helperLoading)

  if (!projectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile for the selected project" />
          <main className="flex-1 overflow-auto px-8 py-6">
            <p className="text-muted-foreground">Select a project to view and edit your helper profile.</p>
          </main>
        </div>
      </div>
    )
  }

  if (!currentHelperLoading && projectId && helperId === null) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile for the selected project" />
          <main className="flex-1 overflow-auto px-8 py-6">
            <p className="text-muted-foreground">You are not registered as a helper in this project.</p>
          </main>
        </div>
      </div>
    )
  }

  if (isLoading || !helperData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile" />
          <main className="flex-1 overflow-auto px-8 py-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  const displayName = helperData.user?.name || "Unknown"
  const displayAvatar = (displayName || "U")[0].toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="My profile" subtitle="View and edit your profile details" />

        <main className="flex-1 overflow-auto px-8 py-6">
          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-12 h-12 rounded-[16.5px] flex items-center justify-center text-[21px] font-medium text-foreground shrink-0"
              style={{ backgroundColor: getAvatarColorHexForId(helperData.user_id ?? helperData.helper_id) }}
            >
              {displayAvatar}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-base font-semibold text-foreground">{displayName}</h1>
            </div>
          </div>

          {/* Editable contact information */}
          <section className="mb-[34px] rounded-[10px] py-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Contact information</h2>
            <div className="space-y-4">
              <div className="flex gap-5">
                <FormField label="Display name" className="flex-1 max-w-md">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-background"
                  />
                </FormField>
                <FormField label="GitHub username" className="flex-1 max-w-md pl-5">
                  <div className="flex items-center gap-2">
                    <GithubIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                    {gitHubConnected ? (
                      <span className="text-sm text-foreground font-medium">
                        {gitHubUsername ?? "Connected"}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => linkGitHubIdentity()}
                        className="text-white hover:opacity-90"
                        style={{ backgroundColor: "#24292e" }}
                      >
                        <GithubIcon className="w-4 h-4" />
                        Connect with GitHub
                      </Button>
                    )}
                  </div>
                </FormField>
              </div>
              <FormField label="Email" className="max-w-md">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="bg-background"
                />
              </FormField>
              <Button
                onClick={handleSaveProfile}
                disabled={updateUserProfile.isPending}
                variant="outline"
                className="border-[rgba(0,0,0,0.06)]"
                style={{ marginTop: "22px" }}
              >
                {updateUserProfile.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save profile details"
                )}
              </Button>
            </div>
          </section>

          {/* Payment details (user role only) */}
          {user?.role === "user" && (
            <div className="bg-card rounded-lg py-6">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Payment details</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="mt-8 flex flex-col gap-10">
                {/* Stripe → GitHub connection */}
                <div className="flex items-center gap-1">
                  <div className="flex size-[42px] shrink-0 items-center justify-center bg-[#635bff] rounded-[14px]">
                    <img
                      src="/images/stripe-svg.svg"
                      alt="Stripe"
                      className="size-[22px] object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-0.5">
                    <span className="size-1 rounded-full bg-muted-foreground/40" />
                    <span className="size-1 rounded-full bg-muted-foreground/40" />
                    <span className="size-1 rounded-full bg-muted-foreground/40" />
                  </div>
                  <div className="flex size-[42px] shrink-0 items-center justify-center bg-[#24292f] rounded-[14px]">
                    <Logo className="size-6 text-[#24292f]" variant="dark" />
                  </div>
                </div>

                <p className="max-w-[502px] text-sm leading-normal tracking-tight text-text-muted">
                  Go to Stripe to set up payment details
                </p>

                <Button
                  className="w-fit px-5 py-2.5 text-[13px] font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
                  onClick={() => {
                    // TODO: wire up Stripe payment setup flow
                  }}
                >
                  <Landmark className="w-4 h-4" />
                  Set up payment with Stripe
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
